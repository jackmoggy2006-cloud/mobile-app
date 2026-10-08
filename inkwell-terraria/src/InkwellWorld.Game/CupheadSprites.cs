using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;

namespace InkwellWorld.Game
{
    /// <summary>
    /// Loads prepared Cuphead PNGs into Texture2D (FromStream — never per-pixel Activator)
    /// and draws animated avatars. Lazy: only the active kit, capped frame counts.
    /// </summary>
    static class CupheadSprites
    {
        const int MaxIdleFrames = 12;
        const int MaxAnimFrames = 8;

        static Assembly _terraria;
        static Type _main;
        static Type _texture2D;
        static Type _color;
        static Type _vector2;
        static Type _spriteEffects;
        static object _white;
        static object _fxNone, _fxFlip;
        static MethodInfo _fromStream;
        static MethodInfo _drawRich;
        static readonly Dictionary<string, object> Textures = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, AnimSet> Sets = new Dictionary<string, AnimSet>(StringComparer.OrdinalIgnoreCase);
        static int _retryLog;
        static bool _loading; // re-entrancy guard

        sealed class AnimSet
        {
            public Dictionary<string, List<object>> Anims = new Dictionary<string, List<object>>(StringComparer.OrdinalIgnoreCase);
            public object Portrait;
        }

        sealed class AnimState
        {
            public string Anim = "idle";
            public int Frame;
            public int Timer;
        }

        static readonly Dictionary<int, AnimState> Play = new Dictionary<int, AnimState>();

        public static bool HasKit(string kitId) =>
            !string.IsNullOrEmpty(kitId) && Sets.ContainsKey(kitId) && Sets[kitId].Anims.Count > 0;

        /// <summary>Disk/status only — must NOT call EnsureLoaded (avoids stack overflow).</summary>
        public static string StatusLine()
        {
            if (Entry.Cache == null || !Entry.Cache.Ready)
                return "Cuphead cache NOT ready: " + (Entry.Cache?.Message ?? "?");
            int pngs = 0;
            try
            {
                if (Directory.Exists(Entry.Cache.Root))
                    pngs = Directory.GetFiles(Entry.Cache.Root, "*.png", SearchOption.AllDirectories).Length;
            }
            catch { }
            return "cache=" + Entry.Cache.Root + " pngs=" + pngs + " loadedSets=" + Sets.Count
                + " cuphead=" + HasKit("cuphead") + " mugman=" + HasKit("mugman") + " chalice=" + HasKit("chalice");
        }

        static Type FindType(string fullName)
        {
            var t = Type.GetType(fullName)
                ?? Type.GetType(fullName + ", Microsoft.Xna.Framework")
                ?? Type.GetType(fullName + ", Microsoft.Xna.Framework.Graphics")
                ?? Type.GetType(fullName + ", FNA");
            if (t != null) return t;
            if (_terraria != null)
            {
                t = _terraria.GetType(fullName);
                if (t != null) return t;
            }
            foreach (var a in AppDomain.CurrentDomain.GetAssemblies())
            {
                try { t = a.GetType(fullName); if (t != null) return t; }
                catch { }
            }
            return null;
        }

        public static void Init(Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            _texture2D = FindType("Microsoft.Xna.Framework.Graphics.Texture2D");
            _color = FindType("Microsoft.Xna.Framework.Color");
            _vector2 = FindType("Microsoft.Xna.Framework.Vector2");
            _spriteEffects = FindType("Microsoft.Xna.Framework.Graphics.SpriteEffects");
            Entry.Log("CupheadSprites types tex=" + (_texture2D != null) + " color=" + (_color != null)
                + " fromStream=" + (_texture2D != null));
            if (_color != null)
                _white = _color.GetProperty("White")?.GetValue(null)
                    ?? Activator.CreateInstance(_color, (byte)255, (byte)255, (byte)255, (byte)255);
            if (_spriteEffects != null)
            {
                _fxNone = Enum.Parse(_spriteEffects, "None");
                _fxFlip = Enum.Parse(_spriteEffects, "FlipHorizontally");
            }
            if (_texture2D != null)
            {
                foreach (var m in _texture2D.GetMethods(BindingFlags.Public | BindingFlags.Static))
                    if (m.Name == "FromStream" && m.GetParameters().Length >= 2) { _fromStream = m; break; }
            }
            Entry.Log("CupheadSprites FromStream=" + (_fromStream != null) + " | " + StatusLine());
        }

        static object GetGraphicsDevice()
        {
            object graphics = Reflect.GetStatic(_main, "graphics");
            if (graphics != null)
            {
                var gd = AccessTools.Property(graphics.GetType(), "GraphicsDevice")?.GetValue(graphics)
                    ?? Reflect.GetField(graphics, "GraphicsDevice");
                if (gd != null) return gd;
            }
            object instance = Reflect.GetStatic(_main, "instance");
            if (instance != null)
            {
                var gd = AccessTools.Property(instance.GetType(), "GraphicsDevice")?.GetValue(instance)
                    ?? Reflect.GetField(instance, "GraphicsDevice");
                if (gd != null) return gd;
            }
            return null;
        }

        /// <summary>Lightweight: only check device; do not load every PNG.</summary>
        public static void EnsureLoaded()
        {
            // Kept for call sites — portraits/kits load lazily via EnsureKit.
            if (Entry.Cache == null || !Entry.Cache.Ready)
            {
                if (_retryLog-- <= 0)
                {
                    Entry.Log("CupheadSprites: " + StatusLine());
                    _retryLog = 300;
                }
            }
        }

        /// <summary>Load one kit's frames (capped). Safe to call every frame.</summary>
        public static bool EnsureKit(string kitId)
        {
            if (string.IsNullOrEmpty(kitId)) return false;
            if (HasKit(kitId)) return true;
            if (_loading) return false;
            if (Entry.Cache == null || !Entry.Cache.Ready) return false;

            CupheadCache.CharacterArt art;
            if (!Entry.Cache.Characters.TryGetValue(kitId, out art) || art == null) return false;

            object gd = GetGraphicsDevice();
            if (gd == null) return false;
            if (_fromStream == null)
            {
                if (_retryLog-- <= 0)
                {
                    Entry.Log("CupheadSprites: Texture2D.FromStream missing — cannot load PNGs");
                    _retryLog = 300;
                }
                return false;
            }

            _loading = true;
            try
            {
                var set = new AnimSet();
                int loaded = 0;
                if (art.Animations != null)
                {
                    foreach (var anim in art.Animations)
                    {
                        int cap = string.Equals(anim.Key, "idle", StringComparison.OrdinalIgnoreCase)
                            ? MaxIdleFrames : MaxAnimFrames;
                        var list = new List<object>();
                        int n = 0;
                        foreach (var path in anim.Value)
                        {
                            if (n >= cap) break;
                            var tex = LoadTex(path, gd);
                            if (tex != null) { list.Add(tex); n++; loaded++; }
                        }
                        if (list.Count > 0) set.Anims[anim.Key] = list;
                    }
                }
                if (set.Anims.Count == 0 && art.FramePaths != null)
                {
                    var list = new List<object>();
                    int n = 0;
                    foreach (var path in art.FramePaths)
                    {
                        if (n >= MaxIdleFrames) break;
                        var tex = LoadTex(path, gd);
                        if (tex != null) { list.Add(tex); n++; loaded++; }
                    }
                    if (list.Count > 0) set.Anims["idle"] = list;
                }
                if (!string.IsNullOrEmpty(art.PortraitPath))
                    set.Portrait = LoadTex(art.PortraitPath, gd);

                if (set.Anims.Count > 0 || set.Portrait != null)
                {
                    Sets[kitId] = set;
                    Entry.Log("CupheadSprites kit " + kitId + " ready anims=" + set.Anims.Count + " tex=" + loaded);
                    Entry.BannerMessage = "Cuphead art: " + kitId + " (" + loaded + " frames). Body replaced.";
                    Entry.BannerFrames = 60 * 5;
                    return set.Anims.Count > 0;
                }
                Entry.Log("CupheadSprites kit " + kitId + " empty — " + StatusLine());
                return false;
            }
            catch (Exception ex)
            {
                Entry.Log("CupheadSprites EnsureKit failed: " + ex.GetBaseException().Message);
                return false;
            }
            finally
            {
                _loading = false;
            }
        }

        static object LoadTex(string path, object gd)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
            if (Textures.TryGetValue(path, out var cached)) return cached;
            if (_fromStream == null) return null;
            try
            {
                // MemoryStream copy: some FNA FromStream implementations dispose/own the stream oddly
                byte[] bytes = File.ReadAllBytes(path);
                using (var ms = new MemoryStream(bytes))
                {
                    object tex = _fromStream.Invoke(null, new object[] { gd, ms });
                    if (tex != null) Textures[path] = tex;
                    return tex;
                }
            }
            catch (Exception ex)
            {
                Entry.Log("FromStream fail " + Path.GetFileName(path) + ": " + ex.GetBaseException().Message);
                return null;
            }
        }

        public static object GetPortrait(string kitId)
        {
            if (!EnsureKit(kitId)) return null;
            AnimSet set;
            if (!Sets.TryGetValue(kitId, out set)) return null;
            if (set.Portrait != null) return set.Portrait;
            List<object> idle;
            if (set.Anims.TryGetValue("idle", out idle) && idle.Count > 0) return idle[0];
            return null;
        }

        public static bool TryDrawPlayer(object player)
        {
            string name = (string)Reflect.GetField(player, "name");
            string kit = KitStore.Get(name);
            if (string.IsNullOrEmpty(kit))
                kit = Entry.PendingCreateKit ?? KitStore.GetActive();
            if (string.IsNullOrEmpty(kit)) return false;
            if (!EnsureKit(kit)) return false;

            AnimSet set;
            if (!Sets.TryGetValue(kit, out set) || set.Anims.Count == 0) return false;

            int who = (int)(Reflect.GetField(player, "whoAmI") ?? 0);
            AnimState st;
            if (!Play.TryGetValue(who, out st))
                Play[who] = st = new AnimState();

            string want = PickAnim(player);
            if (want != st.Anim) { st.Anim = want; st.Frame = 0; st.Timer = 0; }
            List<object> frames;
            if (!set.Anims.TryGetValue(st.Anim, out frames) || frames.Count == 0)
                if (!set.Anims.TryGetValue("idle", out frames) || frames.Count == 0)
                    return false;

            st.Timer++;
            if (st.Timer >= (st.Anim == "run" || st.Anim == "shoot" ? 4 : 6))
            {
                st.Timer = 0;
                st.Frame = (st.Frame + 1) % frames.Count;
            }
            object tex = frames[st.Frame % frames.Count];
            object spriteBatch = Reflect.GetStatic(_main, "spriteBatch");
            if (spriteBatch == null || tex == null) return false;

            object pos = Reflect.GetField(player, "position");
            object screen = Reflect.GetStatic(_main, "screenPosition");
            if (pos == null || screen == null) return false;
            float px = (float)pos.GetType().GetField("X").GetValue(pos);
            float py = (float)pos.GetType().GetField("Y").GetValue(pos);
            float sx = (float)screen.GetType().GetField("X").GetValue(screen);
            float sy = (float)screen.GetType().GetField("Y").GetValue(screen);
            int width = (int)(Reflect.GetField(player, "width") ?? 20);
            int height = (int)(Reflect.GetField(player, "height") ?? 42);
            int dir = (int)(Reflect.GetField(player, "direction") ?? 1);

            int tw = (int)AccessTools.Property(tex.GetType(), "Width").GetValue(tex);
            int th = (int)AccessTools.Property(tex.GetType(), "Height").GetValue(tex);
            float scale = (height * 1.5f) / Math.Max(8, th);
            if (scale > 1.5f) scale = 1.5f;
            if (scale < 0.2f) scale = 0.2f;

            object fx = dir < 0 ? _fxFlip : _fxNone;
            try
            {
                if (_drawRich == null)
                {
                    foreach (var m in spriteBatch.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance))
                    {
                        if (m.Name != "Draw") continue;
                        var ps = m.GetParameters();
                        if (ps.Length == 9 && ps[7].ParameterType.Name.Contains("SpriteEffects"))
                        { _drawRich = m; break; }
                    }
                }
                if (_drawRich == null || _vector2 == null) return false;
                object origin = Activator.CreateInstance(_vector2, tw * 0.5f, (float)th);
                object vpos = Activator.CreateInstance(_vector2, px - sx + width * 0.5f, py - sy + height);
                _drawRich.Invoke(spriteBatch, new object[] { tex, vpos, null, _white, 0f, origin, scale, fx, 0f });
                return true;
            }
            catch (Exception ex)
            {
                Entry.Log("Cuphead draw: " + ex.GetBaseException().Message);
                return false;
            }
        }

        static string PickAnim(object player)
        {
            try
            {
                object vel = Reflect.GetField(player, "velocity");
                float vx = (float)vel.GetType().GetField("X").GetValue(vel);
                float vy = (float)vel.GetType().GetField("Y").GetValue(vel);
                if (Math.Abs(vy) > 0.8f) return "jump";
                bool shooting = (bool)(Reflect.GetStatic(_main, "mouseLeft") ?? false);
                if (shooting) return "shoot";
                if (Math.Abs(vx) > 0.4f) return "run";
                return "idle";
            }
            catch { return "idle"; }
        }
    }
}
