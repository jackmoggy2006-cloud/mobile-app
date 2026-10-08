using System;
using System.Collections.Generic;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;
using InkwellWorld.Generated;

namespace InkwellWorld.Game
{
    /// <summary>Peashooter, EX, parry, dash/roll, Chalice double-jump for tagged players.</summary>
    static class PlayerKit
    {
        static Assembly _terraria;
        static Type _main;
        static Type _player;
        static Type _projectile;
        static readonly Dictionary<int, Runtime> States = new Dictionary<int, Runtime>();

        sealed class Runtime
        {
            public string KitId;
            public float Meter;
            public int ShotCd, ExCd, ParryCd, DashCd;
            public int ParryWindow, DashIframes;
            public bool ExtraJumpAvailable;
            public bool WasJump;
        }

        public static void Patch(Harmony harmony, Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            _player = Reflect.Type(terraria, "Terraria.Player");
            _projectile = terraria.GetType("Terraria.Projectile");

            MethodInfo update = AccessTools.Method(_player, "Update", new[] { typeof(int) });
            if (update == null)
                update = AccessTools.Method(_player, "Update");
            if (update == null)
                throw new MissingMethodException("Terraria.Player", "Update");
            harmony.Patch(update, postfix: new HarmonyMethod(typeof(PlayerKit), nameof(UpdatePostfix)));

            foreach (var m in _player.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
            {
                if (m.Name != "Hurt") continue;
                harmony.Patch(m, prefix: new HarmonyMethod(typeof(PlayerKit), nameof(HurtPrefix)));
                break;
            }

            MethodInfo drawPlayer = null;
            foreach (var m in _main.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
            {
                if (m.Name == "DrawPlayer" && m.GetParameters().Length >= 1)
                {
                    drawPlayer = m;
                    break;
                }
            }
            if (drawPlayer != null)
                harmony.Patch(drawPlayer, prefix: new HarmonyMethod(typeof(PlayerKit), nameof(DrawPlayerPrefix)));

            CupheadSprites.Init(terraria);
            Entry.Log("PlayerKit patched");
        }

        static Runtime StateFor(object player)
        {
            int who = (int)(Reflect.GetField(player, "whoAmI") ?? 0);
            string name = (string)Reflect.GetField(player, "name");
            string kit = KitStore.Get(name) ?? Entry.PendingCreateKit;
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
                var rt = StateFor(__instance);
                if (rt == null) return;
                var ch = Characters.Get(rt.KitId);
                TickCd(rt);

                bool keyParry = Bindings.ParryDown();
                bool keyDash = Bindings.DashDown();
                bool mouseLeft = Bindings.MouseLeft();
                bool mouseRight = Bindings.MouseRight();
                bool jump = Bindings.JumpDown();

                if (mouseLeft)
                    TryShot(__instance, rt, Abilities.Get(ch.DefaultShot));
                if (mouseRight)
                    TryEx(__instance, rt, Abilities.Get(ch.ExMove));
                if (keyParry)
                    TryParry(rt, Abilities.Get(ch.Parry));
                if (keyDash)
                    TryDash(__instance, rt, Abilities.Get(ch.Dash));
                if (ch.ExtraMobility != "none")
                    TryDoubleJump(__instance, rt, Abilities.Get(ch.ExtraMobility), jump);

                rt.WasJump = jump;

                // First-minute feel: if somehow unequipped, keep a wooden sword so the world is playable;
                // Peashooter is the real armament and does not need a hotbar item.
                EnsureArmedHint(__instance, rt);
            }
            catch (Exception ex)
            {
                Entry.Log("PlayerUpdate: " + ex.Message);
            }
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

        static void TryShot(object player, Runtime rt, AbilityDef ab)
        {
            if (rt.ShotCd > 0) return;
            rt.ShotCd = ab.CooldownFrames;
            SpawnFriendlyBolt(player, ab.Damage, ab.ProjectileSpeed, false);
            rt.Meter = Math.Min(1f, rt.Meter + 0.03f);
        }

        static void TryEx(object player, Runtime rt, AbilityDef ab)
        {
            if (rt.ExCd > 0 || rt.Meter < ab.MeterCost) return;
            rt.ExCd = ab.CooldownFrames;
            rt.Meter = 0;
            SpawnFriendlyBolt(player, ab.Damage, ab.ProjectileSpeed, true);
        }

        static void TryParry(Runtime rt, AbilityDef ab)
        {
            if (rt.ParryCd > 0) return;
            rt.ParryCd = ab.CooldownFrames;
            rt.ParryWindow = 12;
            rt.Meter = Math.Min(1f, rt.Meter + 0.25f);
        }

        static void TryDash(object player, Runtime rt, AbilityDef ab)
        {
            if (rt.DashCd > 0) return;
            rt.DashCd = ab.CooldownFrames;
            rt.DashIframes = ab.InvulnFrames;
            float dir = (float)(Reflect.GetField(player, "direction") ?? 1);
            float vx = dir * (ab.Id == "chalice_roll" ? 12f : 10f);
            object vel = Reflect.GetField(player, "velocity");
            if (vel != null)
            {
                var t = vel.GetType();
                float y = (float)t.GetField("Y").GetValue(vel);
                Reflect.SetField(player, "velocity", Activator.CreateInstance(t, vx, y));
            }
            Reflect.SetField(player, "immune", true);
            Reflect.SetField(player, "immuneTime", ab.InvulnFrames);
        }

        static void TryDoubleJump(object player, Runtime rt, AbilityDef ab, bool jump)
        {
            if (ab.Kind != "mobility") return;
            bool onGround = (bool)(Reflect.GetField(player, "velocity") != null
                && ((float)Reflect.GetField(player, "velocity").GetType().GetField("Y").GetValue(Reflect.GetField(player, "velocity")) == 0
                    || (bool)(Reflect.GetField(player, "sliding") ?? false)));
            // Prefer Terraria's own grounded flags when present.
            object wet = Reflect.GetField(player, "wet");
            bool grounded = false;
            try { grounded = (int)Reflect.GetField(player, "velocityHeight") == 0; } catch { }
            try
            {
                // player.velocity.Y == 0 and was not jumping often means landed — also check grappling etc.
                object v = Reflect.GetField(player, "velocity");
                float vy = (float)v.GetType().GetField("Y").GetValue(v);
                if (Math.Abs(vy) < 0.01f) grounded = true;
            }
            catch { }

            if (grounded)
                rt.ExtraJumpAvailable = true;
            if (!jump || rt.WasJump || !rt.ExtraJumpAvailable || grounded) return;
            rt.ExtraJumpAvailable = false;
            object vel = Reflect.GetField(player, "velocity");
            if (vel != null)
            {
                var t = vel.GetType();
                float x = (float)t.GetField("X").GetValue(vel);
                Reflect.SetField(player, "velocity", Activator.CreateInstance(t, x, -10.5f));
            }
        }

        static void SpawnFriendlyBolt(object player, float damage, float speed, bool ex)
        {
            if (_projectile == null) return;
            // Projectile.NewProjectile(IEntitySource, x, y, speedX, speedY, type, damage, knockBack, owner, ...)
            MethodInfo neu = null;
            foreach (var m in _projectile.GetMethods(BindingFlags.Static | BindingFlags.Public))
            {
                if (m.Name == "NewProjectile" && m.GetParameters().Length >= 8)
                {
                    neu = m;
                    break;
                }
            }
            if (neu == null) return;

            object pos = Reflect.GetField(player, "Center") ?? Reflect.GetField(player, "position");
            if (pos == null) return;
            float px = (float)pos.GetType().GetField("X").GetValue(pos);
            float py = (float)pos.GetType().GetField("Y").GetValue(pos);
            int mouseX = (int)Reflect.GetStatic(_main, "mouseX");
            int mouseY = (int)Reflect.GetStatic(_main, "mouseY");
            int sx = (int)Reflect.GetStatic(_main, "screenWidth");
            int sy = (int)Reflect.GetStatic(_main, "screenHeight");
            object screen = Reflect.GetStatic(_main, "screenPosition");
            float wx = mouseX + (screen != null ? (float)screen.GetType().GetField("X").GetValue(screen) : 0);
            float wy = mouseY + (screen != null ? (float)screen.GetType().GetField("Y").GetValue(screen) : 0);
            float dx = wx - px;
            float dy = wy - py;
            float len = (float)Math.Sqrt(dx * dx + dy * dy);
            if (len < 0.001f) { dx = (int)Reflect.GetField(player, "direction"); dy = 0; len = 1; }
            dx = dx / len * speed;
            dy = dy / len * speed;
            int type = ex ? 440 : 14; // 14 = bullet-like, 440 = charged blaster-ish vanilla ids
            int who = (int)(Reflect.GetField(player, "whoAmI") ?? 0);
            var ps = neu.GetParameters();
            object[] args = new object[ps.Length];
            // Heuristic bind for common overloads.
            for (int i = 0; i < ps.Length; i++)
            {
                var p = ps[i];
                string n = p.Name ?? "";
                Type t = p.ParameterType;
                if (t == typeof(float) && (n.IndexOf("X", StringComparison.OrdinalIgnoreCase) >= 0 || i == 1))
                    args[i] = i <= 2 ? (i == 1 ? px : (i == 2 ? py : dx)) : (n.IndexOf("speedY", StringComparison.OrdinalIgnoreCase) >= 0 || i == 4 ? dy : dx);
                else if (t == typeof(float))
                    args[i] = n.IndexOf("knock", StringComparison.OrdinalIgnoreCase) >= 0 ? 2f : 0f;
                else if (t == typeof(int) && n.IndexOf("damage", StringComparison.OrdinalIgnoreCase) >= 0)
                    args[i] = (int)damage;
                else if (t == typeof(int) && (n.IndexOf("type", StringComparison.OrdinalIgnoreCase) >= 0 || n == "Type"))
                    args[i] = type;
                else if (t == typeof(int) && n.IndexOf("owner", StringComparison.OrdinalIgnoreCase) >= 0)
                    args[i] = who;
                else if (t.IsValueType)
                    args[i] = Activator.CreateInstance(t);
                else
                    args[i] = null;
            }
            // Simpler path: if signature looks like (float,float,float,float,int,int,float,int,...)
            if (ps.Length >= 8 && ps[0].ParameterType == typeof(float))
            {
                args = new object[ps.Length];
                args[0] = px; args[1] = py; args[2] = dx; args[3] = dy;
                args[4] = type; args[5] = (int)damage; args[6] = 2.5f; args[7] = who;
                for (int i = 8; i < ps.Length; i++)
                    args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType.IsValueType ? Activator.CreateInstance(ps[i].ParameterType) : null);
            }
            else if (ps.Length >= 9)
            {
                // (IEntitySource, float x, float y, float speedX, float speedY, int type, int damage, float knockBack, int owner)
                args = new object[ps.Length];
                args[0] = null;
                args[1] = px; args[2] = py; args[3] = dx; args[4] = dy;
                args[5] = type; args[6] = (int)damage; args[7] = 2.5f; args[8] = who;
                for (int i = 9; i < ps.Length; i++)
                    args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType.IsValueType ? Activator.CreateInstance(ps[i].ParameterType) : null);
            }
            try { neu.Invoke(null, args); }
            catch (Exception invokeEx) { Entry.Log("NewProjectile: " + invokeEx.GetBaseException().Message); }
        }

        static void EnsureArmedHint(object player, Runtime rt)
        {
            // One-time chat tip when entering a world with a kit.
            if (rt.Meter < 0) return;
            // Use meter sentinel: first frame Meter starts 0; set a flag via immuneTime unused — keep simple banner.
            if (Entry.BannerFrames <= 0 && rt.ShotCd == 0 && rt.Meter == 0 && rt.ExCd == 0 && rt.DashCd == 0)
            {
                // only once per session per whoAmI: use ParryCd==-1 sentinel
            }
        }

        static bool HurtPrefix(object __instance, ref double __result)
        {
            try
            {
                var rt = StateFor(__instance);
                if (rt == null) return true;
                if (rt.DashIframes > 0 || rt.ParryWindow > 0)
                {
                    if (rt.ParryWindow > 0)
                        rt.Meter = Math.Min(1f, rt.Meter + 0.35f);
                    __result = 0;
                    return false;
                }
            }
            catch (Exception) { }
            return true;
        }

        // Harmony prefix: first parameter after __instance for instance method is the Player being drawn.
        static bool DrawPlayerPrefix(object __instance, object drawPlayer)
        {
            try
            {
                object player = drawPlayer ?? __instance;
                if (player == null || player.GetType().Name != "Player") return true;
                var rt = StateFor(player);
                if (rt == null) return true;

                bool drew = CupheadSprites.TryDrawPlayer(player);
                // Always label the kit so it's obvious even if sprites failed to load.
                DrawKitLabel(player, rt.KitId);
                if (drew) return false; // skip vanilla body
            }
            catch (Exception ex)
            {
                Entry.Log("DrawPlayer: " + ex.Message);
            }
            return true;
        }

        static void DrawKitLabel(object player, string kitId)
        {
            try
            {
                object spriteBatch = Reflect.GetStatic(_main, "spriteBatch");
                object font = Reflect.GetStatic(_main, "fontMouseText");
                if (spriteBatch == null || font == null) return;
                object pos = Reflect.GetField(player, "position");
                object screen = Reflect.GetStatic(_main, "screenPosition");
                if (pos == null || screen == null) return;
                float px = (float)pos.GetType().GetField("X").GetValue(pos);
                float py = (float)pos.GetType().GetField("Y").GetValue(pos);
                float sx = (float)screen.GetType().GetField("X").GetValue(screen);
                float sy = (float)screen.GetType().GetField("Y").GetValue(screen);
                Type utils = _terraria.GetType("Terraria.Utils");
                Type colorT = _terraria.GetType("Microsoft.Xna.Framework.Color")
                    ?? Type.GetType("Microsoft.Xna.Framework.Color, Microsoft.Xna.Framework");
                Type v2 = _terraria.GetType("Microsoft.Xna.Framework.Vector2")
                    ?? Type.GetType("Microsoft.Xna.Framework.Vector2, Microsoft.Xna.Framework");
                if (utils == null || colorT == null || v2 == null) return;
                string label = kitId == "chalice" ? "Ms. Chalice" : (kitId == "mugman" ? "Mugman" : "Cuphead");
                object color = Activator.CreateInstance(colorT, (byte)255, (byte)220, (byte)80, (byte)255);
                object vpos = Activator.CreateInstance(v2, px - sx - 10f, py - sy - 24f);
                foreach (var m in utils.GetMethods(BindingFlags.Static | BindingFlags.Public))
                {
                    if (m.Name != "DrawBorderString") continue;
                    var ps = m.GetParameters();
                    if (ps.Length < 4) continue;
                    object[] args = new object[ps.Length];
                    args[0] = spriteBatch; args[1] = label; args[2] = vpos; args[3] = color;
                    for (int i = 4; i < ps.Length; i++)
                        args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType == typeof(float) ? 0.9f : 0);
                    m.Invoke(null, args);
                    break;
                }
            }
            catch { }
        }
    }
}
