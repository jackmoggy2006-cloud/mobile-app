using System;
using System.Collections.Generic;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;
using InkwellWorld.Generated;

namespace InkwellWorld.Game
{
    /// <summary>
    /// Cuphead kits on the local player. F1/F2/F3 (or active_kit) select the kit in-world.
    /// Abilities use Terraria player fields + Projectile.NewProjectile with EntitySource.
    /// </summary>
    static class PlayerKit
    {
        static Assembly _terraria;
        static Type _main;
        static Type _player;
        static Type _projectile;
        static Type _item;
        static MethodInfo _newProj;
        static MethodInfo _getSource;
        static int _abilityLogCd;
        static readonly Dictionary<int, Runtime> States = new Dictionary<int, Runtime>();

        sealed class Runtime
        {
            public string KitId;
            public float Meter;
            public int ShotCd, ExCd, ParryCd, DashCd;
            public int ParryWindow, DashIframes;
            public bool ExtraJumpAvailable = true;
            public bool WasJump;
            public bool WasDashKey;
            public int AnnounceCd;
        }

        public static void Patch(Harmony harmony, Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            _player = Reflect.Type(terraria, "Terraria.Player");
            _projectile = terraria.GetType("Terraria.Projectile");
            _item = terraria.GetType("Terraria.Item");

            // Resolve NewProjectile(IEntitySource, float, float, float, float, int, int, float, int, ...)
            if (_projectile != null)
            {
                foreach (var m in _projectile.GetMethods(BindingFlags.Public | BindingFlags.Static))
                {
                    if (m.Name != "NewProjectile") continue;
                    var ps = m.GetParameters();
                    if (ps.Length >= 9 && ps[0].ParameterType.Name.Contains("IEntitySource")
                        && ps[1].ParameterType == typeof(float))
                    {
                        _newProj = m;
                        break;
                    }
                }
                if (_newProj == null)
                {
                    foreach (var m in _projectile.GetMethods(BindingFlags.Public | BindingFlags.Static))
                        if (m.Name == "NewProjectile" && m.GetParameters().Length >= 8)
                        { _newProj = m; break; }
                }
            }
            _getSource = AccessTools.Method(_player, "GetSource_FromThis", Type.EmptyTypes)
                ?? AccessTools.Method(_player, "GetSource_Misc", new[] { typeof(string) });

            MethodInfo update = AccessTools.Method(_player, "Update", new[] { typeof(int) })
                ?? AccessTools.Method(_player, "Update");
            harmony.Patch(update, postfix: new HarmonyMethod(typeof(PlayerKit), nameof(UpdatePostfix)));

            foreach (var m in _player.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
            {
                if (m.Name != "Hurt") continue;
                harmony.Patch(m, prefix: new HarmonyMethod(typeof(PlayerKit), nameof(HurtPrefix)));
                break;
            }

            // Terraria 1.4: LegacyPlayerRenderer.DrawPlayer is the real path.
            // Prefix: make vanilla fully transparent (shadow=1) when Cuphead art is ready.
            // Postfix: draw Cuphead (spriteBatch is active — no load work here).
            int drawPatches = 0;
            Type legacy = terraria.GetType("Terraria.Graphics.Renderers.LegacyPlayerRenderer");
            if (legacy != null)
            {
                foreach (var m in legacy.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
                {
                    if (m.Name != "DrawPlayer") continue;
                    harmony.Patch(m,
                        prefix: new HarmonyMethod(typeof(PlayerKit), nameof(DrawPlayerHidePrefix)),
                        postfix: new HarmonyMethod(typeof(PlayerKit), nameof(DrawPlayerPostfix)));
                    drawPatches++;
                }
            }
            foreach (var m in _main.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
            {
                if (m.Name != "DrawPlayer") continue;
                harmony.Patch(m,
                    prefix: new HarmonyMethod(typeof(PlayerKit), nameof(DrawPlayerHidePrefix)),
                    postfix: new HarmonyMethod(typeof(PlayerKit), nameof(DrawPlayerPostfix)));
                drawPatches++;
            }

            CupheadSprites.Init(terraria);
            Entry.Log("PlayerKit patched; DrawPlayer hooks=" + drawPatches
                + " LegacyRenderer=" + (legacy != null)
                + " NewProjectile=" + (_newProj != null) + " GetSource=" + (_getSource != null));
        }

        static bool IsLocal(object player)
        {
            try
            {
                int who = (int)(Reflect.GetField(player, "whoAmI") ?? -1);
                int my = (int)(Reflect.GetStatic(_main, "myPlayer") ?? -2);
                return who == my;
            }
            catch { return false; }
        }

        static Runtime StateFor(object player)
        {
            int who = (int)(Reflect.GetField(player, "whoAmI") ?? 0);
            string name = (string)Reflect.GetField(player, "name");
            // Bound by character name first; global F1/F2/F3 active only for the local player.
            string kit = KitStore.Get(name);
            if (string.IsNullOrEmpty(kit) && IsLocal(player))
                kit = Entry.PendingCreateKit ?? KitStore.GetActive();
            if (string.IsNullOrEmpty(kit)) return null;
            Runtime rt;
            if (!States.TryGetValue(who, out rt) || rt.KitId != kit)
            {
                rt = new Runtime { KitId = kit, ExtraJumpAvailable = true };
                States[who] = rt;
            }
            return rt;
        }

        static void UpdatePostfix(object __instance)
        {
            try
            {
                if (!IsLocal(__instance)) return;

                // In-world kit select — works even if character create / saves failed
                if (KeyEdge("F1")) Activate(__instance, "cuphead");
                if (KeyEdge("F2")) Activate(__instance, "mugman");
                if (KeyEdge("F3")) Activate(__instance, "chalice");

                var rt = StateFor(__instance);
                if (rt == null)
                {
                    if (_abilityLogCd <= 0)
                    {
                        _abilityLogCd = 300;
                        Entry.BannerMessage = "Inkwell: press F1=Cuphead F2=Mugman F3=Ms.Chalice — " + CupheadSprites.StatusLine();
                        Entry.BannerFrames = 60 * 6;
                    }
                    else _abilityLogCd--;
                    return;
                }

                // Load art here (once), never inside Draw — that was the lag.
                CupheadSprites.EnsureKit(rt.KitId);

                var ch = Characters.Get(rt.KitId);
                TickCd(rt);
                ApplyPassive(__instance, rt, ch);

                bool mouseLeft = Bindings.MouseLeft() || Control(__instance, "controlUseItem");
                bool mouseRight = Bindings.MouseRight() || Control(__instance, "controlUseTile");
                bool jump = Bindings.JumpDown() || Control(__instance, "controlJump");
                bool dashKey = Bindings.DashDown();
                bool parryKey = Bindings.ParryDown();

                if (mouseLeft)
                    TryShot(__instance, rt, Abilities.Get(ch.DefaultShot));
                if (mouseRight)
                    TryEx(__instance, rt, Abilities.Get(ch.ExMove));
                if (parryKey)
                    TryParry(rt, Abilities.Get(ch.Parry));
                if (dashKey && !rt.WasDashKey)
                    TryDash(__instance, rt, Abilities.Get(ch.Dash));
                rt.WasDashKey = dashKey;

                if (ch.ExtraMobility != "none")
                    TryDoubleJump(__instance, rt, jump);
                rt.WasJump = jump;

                if (rt.AnnounceCd <= 0)
                {
                    rt.AnnounceCd = 600;
                    Entry.Log("Kit active " + rt.KitId + " meter=" + rt.Meter.ToString("0.00")
                        + " | " + CupheadSprites.StatusLine());
                }
                else rt.AnnounceCd--;
            }
            catch (Exception ex)
            {
                if (_abilityLogCd <= 0)
                {
                    _abilityLogCd = 120;
                    Entry.Log("PlayerUpdate: " + ex);
                }
                else _abilityLogCd--;
            }
        }

        static void Activate(object player, string kitId)
        {
            string name = (string)Reflect.GetField(player, "name");
            KitStore.Set(name, kitId);
            States.Remove((int)(Reflect.GetField(player, "whoAmI") ?? 0));
            Entry.PendingCreateKit = kitId;
            Entry.BannerMessage = "Kit: " + kitId + " — LMB shoot, RMB EX, Shift dash, X parry"
                + (kitId == "chalice" ? ", Space double-jump" : "");
            Entry.BannerFrames = 60 * 8;
            Entry.Log("Activated kit " + kitId + " on " + name);
            CupheadSprites.EnsureKit(kitId);
        }

        static bool Control(object player, string field)
        {
            try { return (bool)(Reflect.GetField(player, field) ?? false); }
            catch { return false; }
        }

        static bool KeyEdge(string key)
        {
            try
            {
                Type keyboard = Type.GetType("Microsoft.Xna.Framework.Input.Keyboard, Microsoft.Xna.Framework.Input")
                    ?? Type.GetType("Microsoft.Xna.Framework.Input.Keyboard, Microsoft.Xna.Framework");
                Type keys = Type.GetType("Microsoft.Xna.Framework.Input.Keys, Microsoft.Xna.Framework.Input")
                    ?? Type.GetType("Microsoft.Xna.Framework.Input.Keys, Microsoft.Xna.Framework");
                if (keyboard == null || keys == null) return false;
                object k = Enum.Parse(keys, key);
                object st = AccessTools.Method(keyboard, "GetState").Invoke(null, null);
                bool down = (bool)AccessTools.Method(st.GetType(), "IsKeyDown").Invoke(st, new[] { k });
                if (!down) return false;
                object old = Reflect.GetStatic(_main, "oldKeyState");
                if (old == null) return true;
                return !(bool)AccessTools.Method(old.GetType(), "IsKeyDown").Invoke(old, new[] { k });
            }
            catch { return false; }
        }

        static void TickCd(Runtime rt)
        {
            if (rt.ShotCd > 0) rt.ShotCd--;
            if (rt.ExCd > 0) rt.ExCd--;
            if (rt.ParryCd > 0) rt.ParryCd--;
            if (rt.DashCd > 0) rt.DashCd--;
            if (rt.ParryWindow > 0) rt.ParryWindow--;
            if (rt.DashIframes > 0) rt.DashIframes--;
        }

        /// <summary>Terraria-native passives that make movement feel like Cuphead.</summary>
        static void ApplyPassive(object player, Runtime rt, CharacterDef ch)
        {
            try
            {
                // Soft dash unlock (double-tap) in addition to Shift
                Reflect.SetField(player, "dashType", 2);
                if (ch.ExtraMobility != "none")
                {
                    Reflect.SetField(player, "hasJumpOption_Cloud", true);
                    Reflect.SetField(player, "canJumpAgain_Cloud", rt.ExtraJumpAvailable);
                }
                if (rt.DashIframes > 0 || rt.ParryWindow > 0)
                {
                    Reflect.SetField(player, "immune", true);
                    Reflect.SetField(player, "immuneTime", Math.Max(2, rt.DashIframes));
                }
            }
            catch { }
        }

        static void TryShot(object player, Runtime rt, AbilityDef ab)
        {
            if (rt.ShotCd > 0) return;
            rt.ShotCd = Math.Max(4, ab.CooldownFrames);
            if (SpawnBolt(player, (int)ab.Damage, ab.ProjectileSpeed, false))
                rt.Meter = Math.Min(1f, rt.Meter + 0.04f);
        }

        static void TryEx(object player, Runtime rt, AbilityDef ab)
        {
            if (rt.ExCd > 0 || rt.Meter < 0.99f) return;
            rt.ExCd = ab.CooldownFrames;
            rt.Meter = 0;
            SpawnBolt(player, (int)ab.Damage, ab.ProjectileSpeed, true);
            // Fan of 3
            SpawnBolt(player, (int)(ab.Damage * 0.7f), ab.ProjectileSpeed, true, -0.25f);
            SpawnBolt(player, (int)(ab.Damage * 0.7f), ab.ProjectileSpeed, true, 0.25f);
        }

        static void TryParry(Runtime rt, AbilityDef ab)
        {
            if (rt.ParryCd > 0) return;
            rt.ParryCd = ab.CooldownFrames;
            rt.ParryWindow = 14;
            rt.Meter = Math.Min(1f, rt.Meter + 0.3f);
            Entry.BannerMessage = "Parry!";
            Entry.BannerFrames = 30;
        }

        static void TryDash(object player, Runtime rt, AbilityDef ab)
        {
            if (rt.DashCd > 0) return;
            rt.DashCd = ab.CooldownFrames;
            rt.DashIframes = ab.InvulnFrames;
            float dir = (float)(int)(Reflect.GetField(player, "direction") ?? 1);
            // Prefer move direction if holding left/right
            if (Control(player, "controlLeft")) dir = -1;
            if (Control(player, "controlRight")) dir = 1;
            float vx = dir * (ab.Id == "chalice_roll" ? 14f : 12f);
            SetVel(player, vx, null);
            Reflect.SetField(player, "immune", true);
            Reflect.SetField(player, "immuneTime", ab.InvulnFrames);
        }

        static void TryDoubleJump(object player, Runtime rt, bool jump)
        {
            bool grounded = false;
            try
            {
                // Terraria: velocity.Y == 0 and not jumping often isn't enough; use carpet/wing flags
                object v = Reflect.GetField(player, "velocity");
                float vy = (float)v.GetType().GetField("Y").GetValue(v);
                // sliding / grappling / mounting skip
                if (Math.Abs(vy) < 0.05f) grounded = true;
                var mounting = Reflect.GetField(player, "mount");
                // Also: player.wingsLogic etc.
            }
            catch { }
            try
            {
                // Prefer official cloud jump consumption
                bool can = (bool)(Reflect.GetField(player, "canJumpAgain_Cloud") ?? false);
                if (grounded) { rt.ExtraJumpAvailable = true; Reflect.SetField(player, "canJumpAgain_Cloud", true); }
                if (!jump || rt.WasJump) return;
                if (!rt.ExtraJumpAvailable && !can) return;
                if (grounded) return;
                rt.ExtraJumpAvailable = false;
                Reflect.SetField(player, "canJumpAgain_Cloud", false);
                SetVel(player, null, -11.5f);
            }
            catch
            {
                if (!jump || rt.WasJump || !rt.ExtraJumpAvailable || grounded) return;
                rt.ExtraJumpAvailable = false;
                SetVel(player, null, -11.5f);
            }
        }

        static void SetVel(object player, float? x, float? y)
        {
            object vel = Reflect.GetField(player, "velocity");
            if (vel == null) return;
            var t = vel.GetType();
            float cx = (float)t.GetField("X").GetValue(vel);
            float cy = (float)t.GetField("Y").GetValue(vel);
            Reflect.SetField(player, "velocity", Activator.CreateInstance(t, x ?? cx, y ?? cy));
        }

        static bool SpawnBolt(object player, int damage, float speed, bool ex, float aimNudge = 0f)
        {
            if (_newProj == null)
            {
                if (_abilityLogCd <= 0) { Entry.Log("No NewProjectile method"); _abilityLogCd = 300; }
                return false;
            }
            object pos = Reflect.GetField(player, "Center");
            if (pos == null)
            {
                object p = Reflect.GetField(player, "position");
                int w = (int)(Reflect.GetField(player, "width") ?? 20);
                int h = (int)(Reflect.GetField(player, "height") ?? 42);
                float px0 = (float)p.GetType().GetField("X").GetValue(p) + w / 2f;
                float py0 = (float)p.GetType().GetField("Y").GetValue(p) + h / 2f;
                pos = Activator.CreateInstance(p.GetType(), px0, py0);
            }
            float px = (float)pos.GetType().GetField("X").GetValue(pos);
            float py = (float)pos.GetType().GetField("Y").GetValue(pos);
            object screen = Reflect.GetStatic(_main, "screenPosition");
            int mouseX = (int)(Reflect.GetStatic(_main, "mouseX") ?? 0);
            int mouseY = (int)(Reflect.GetStatic(_main, "mouseY") ?? 0);
            float wx = mouseX + (screen != null ? (float)screen.GetType().GetField("X").GetValue(screen) : 0);
            float wy = mouseY + (screen != null ? (float)screen.GetType().GetField("Y").GetValue(screen) : 0);
            float dx = wx - px;
            float dy = wy - py;
            // Rotate aim slightly for EX fan
            if (Math.Abs(aimNudge) > 0.001f)
            {
                float ang = (float)Math.Atan2(dy, dx) + aimNudge;
                dx = (float)Math.Cos(ang);
                dy = (float)Math.Sin(ang);
            }
            float len = (float)Math.Sqrt(dx * dx + dy * dy);
            if (len < 0.001f)
            {
                dx = (int)(Reflect.GetField(player, "direction") ?? 1);
                dy = 0;
                len = 1;
            }
            dx = dx / len * speed;
            dy = dy / len * speed;

            // Vanilla proj: 14=bullet, 440=charged blaster bolt, 20=green laser
            int type = ex ? 440 : 20;
            int who = (int)(Reflect.GetField(player, "whoAmI") ?? 0);

            object source = null;
            try
            {
                if (_getSource != null)
                {
                    if (_getSource.GetParameters().Length == 0)
                        source = _getSource.Invoke(player, null);
                    else
                        source = _getSource.Invoke(player, new object[] { "InkwellPeashooter" });
                }
            }
            catch { }

            var ps = _newProj.GetParameters();
            object[] args = new object[ps.Length];
            try
            {
                if (ps[0].ParameterType.Name.Contains("IEntitySource"))
                {
                    args[0] = source;
                    args[1] = px; args[2] = py; args[3] = dx; args[4] = dy;
                    args[5] = type; args[6] = damage; args[7] = 3f; args[8] = who;
                    for (int i = 9; i < ps.Length; i++)
                        args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue
                            : (ps[i].ParameterType.IsValueType ? Activator.CreateInstance(ps[i].ParameterType) : null);
                }
                else
                {
                    args[0] = px; args[1] = py; args[2] = dx; args[3] = dy;
                    args[4] = type; args[5] = damage; args[6] = 3f; args[7] = who;
                    for (int i = 8; i < ps.Length; i++)
                        args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue
                            : (ps[i].ParameterType.IsValueType ? Activator.CreateInstance(ps[i].ParameterType) : null);
                }
                _newProj.Invoke(null, args);
                return true;
            }
            catch (Exception invokeEx)
            {
                if (_abilityLogCd <= 0)
                {
                    Entry.Log("NewProjectile fail: " + invokeEx.GetBaseException().Message);
                    _abilityLogCd = 180;
                }
                return false;
            }
        }

        static bool HurtPrefix(object __instance)
        {
            try
            {
                var rt = StateFor(__instance);
                if (rt == null) return true;
                if (rt.DashIframes > 0 || rt.ParryWindow > 0)
                {
                    if (rt.ParryWindow > 0) rt.Meter = Math.Min(1f, rt.Meter + 0.35f);
                    return false; // skip hurt
                }
            }
            catch { }
            return true;
        }

        /// <summary>When Cuphead art is ready, force shadow=1 so the Terraria body is invisible.</summary>
        static void DrawPlayerHidePrefix(object[] __args)
        {
            try
            {
                object player = FindPlayerArg(__args);
                if (player == null) return;
                string name = (string)Reflect.GetField(player, "name");
                string kit = KitStore.Get(name);
                if (string.IsNullOrEmpty(kit) && IsLocal(player))
                    kit = Entry.PendingCreateKit ?? KitStore.GetActive();
                if (string.IsNullOrEmpty(kit) || !CupheadSprites.HasKit(kit)) return;
                // Legacy: (camera, player, pos, rot, origin, shadow, scale) — shadow is float near the end.
                // Main.DrawPlayer: (player, pos, rot, origin, shadow?, scale?) — find last float before optional scale.
                for (int i = __args.Length - 1; i >= 0; i--)
                {
                    if (__args[i] is float)
                    {
                        // Prefer the shadow slot (second-to-last float if two floats at end)
                        int shadowIdx = i;
                        if (i > 0 && __args[i - 1] is float) shadowIdx = i - 1;
                        __args[shadowIdx] = 1f; // fully transparent vanilla body
                        return;
                    }
                }
            }
            catch { }
        }

        /// <summary>Draw Cuphead after vanilla (spriteBatch is mid-pass). No loading here.</summary>
        static void DrawPlayerPostfix(object[] __args)
        {
            try
            {
                object player = FindPlayerArg(__args);
                if (player == null) return;
                string name = (string)Reflect.GetField(player, "name");
                string kit = KitStore.Get(name);
                if (string.IsNullOrEmpty(kit) && IsLocal(player))
                    kit = Entry.PendingCreateKit ?? KitStore.GetActive();
                if (string.IsNullOrEmpty(kit) || !CupheadSprites.HasKit(kit)) return;
                if (CupheadSprites.TryDrawPlayer(player) && IsLocal(player))
                {
                    var rt = StateFor(player);
                    if (rt != null) DrawKitLabel(player, rt.KitId, rt.Meter);
                }
            }
            catch (Exception ex)
            {
                if (_abilityLogCd <= 0) { Entry.Log("DrawPlayerPost: " + ex.Message); _abilityLogCd = 180; }
            }
        }

        static object FindPlayerArg(object[] args)
        {
            if (args == null) return null;
            for (int i = 0; i < args.Length; i++)
            {
                object a = args[i];
                if (a != null && a.GetType().Name == "Player") return a;
            }
            return null;
        }

        static void DrawKitLabel(object player, string kitId, float meter)
        {
            try
            {
                object spriteBatch = Reflect.GetStatic(_main, "spriteBatch");
                if (spriteBatch == null) return;
                object pos = Reflect.GetField(player, "position");
                object screen = Reflect.GetStatic(_main, "screenPosition");
                if (pos == null || screen == null) return;
                float px = Reflect.Vec(pos, "X");
                float py = Reflect.Vec(pos, "Y");
                float sx = Reflect.Vec(screen, "X");
                float sy = Reflect.Vec(screen, "Y");
                Type utils = _terraria.GetType("Terraria.Utils");
                Type colorT = _terraria.GetType("Microsoft.Xna.Framework.Color")
                    ?? Type.GetType("Microsoft.Xna.Framework.Color, Microsoft.Xna.Framework");
                Type v2 = _terraria.GetType("Microsoft.Xna.Framework.Vector2")
                    ?? Type.GetType("Microsoft.Xna.Framework.Vector2, Microsoft.Xna.Framework");
                if (utils == null || colorT == null || v2 == null) return;
                string label = (kitId == "chalice" ? "Ms. Chalice" : (kitId == "mugman" ? "Mugman" : "Cuphead"))
                    + "  EX " + (int)(meter * 100) + "%";
                object color = Activator.CreateInstance(colorT, (byte)255, (byte)220, (byte)80, (byte)255);
                object vpos = Activator.CreateInstance(v2, px - sx - 8f, py - sy - 28f);
                foreach (var m in utils.GetMethods(BindingFlags.Static | BindingFlags.Public))
                {
                    if (m.Name != "DrawBorderString") continue;
                    var ps = m.GetParameters();
                    if (ps.Length < 4) continue;
                    object[] args = new object[ps.Length];
                    args[0] = spriteBatch; args[1] = label; args[2] = vpos; args[3] = color;
                    for (int i = 4; i < ps.Length; i++)
                        args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType == typeof(float) ? 0.85f : 0);
                    m.Invoke(null, args);
                    break;
                }
            }
            catch { }
        }
    }
}
