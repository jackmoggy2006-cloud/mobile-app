using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;

namespace InkwellWorld.Game
{
    /// <summary>
    /// Cuphead PNGs → Texture2D. Load ONLY from Update/Activate (never from Draw).
    /// Failed loads are cached so we do not retry every frame (that caused the lag).
    /// </summary>
    static class CupheadSprites
    {
        const int MaxIdleFrames = 6;
        const int MaxAnimFrames = 4;

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
        static MethodInfo _drawSimple; // Draw(tex, Vector2, Color)
        static readonly Dictionary<string, object> Textures = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, AnimSet> Sets = new Dictionary<string, AnimSet>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, string> FailReason = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        static readonly HashSet<string> LoadAttempted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static int _pngCount = -1;
        static bool _loading;
        static string _lastDrawError;

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

        public static string StatusLine()
        {
            if (Entry.Cache == null || !Entry.Cache.Ready)
                return "cache NOT ready: " + (Entry.Cache?.Message ?? "?");
            if (_pngCount < 0) RefreshPngCount();
            string fail = FailReason.Count > 0 ? " fail=" + string.Join(",", FailReason.Keys) : "";
            string derr = _lastDrawError != null ? " drawErr=" + _lastDrawError : "";
            return "pngs=" + _pngCount + " loaded=" + Sets.Count
                + " ch=" + HasKit("cuphead") + " mm=" + HasKit("mugman") + " ms=" + HasKit("chalice")
                + fail + derr;
        }

        public static void RefreshPngCount()
        {
            _pngCount = 0;
            try
            {
                if (Entry.Cache != null && Directory.Exists(Entry.Cache.Root))
                    _pngCount = Directory.GetFiles(Entry.Cache.Root, "*.png", SearchOption.AllDirectories).Length;
            }
            catch { }
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
            RefreshPngCount();
            Entry.Log("CupheadSprites init FromStream=" + (_fromStream != null) + " | " + StatusLine());
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

        public static void EnsureLoaded() { /* no-op: kits load via EnsureKit from Update only */ }

        /// <summary>Call from Update/Activate only — never from Draw.</summary>
        public static bool EnsureKit(string kitId)
        {
            if (string.IsNullOrEmpty(kitId)) return false;
            if (HasKit(kitId)) return true;
            if (FailReason.ContainsKey(kitId)) return false; // do not retry (lag fix)
            if (LoadAttempted.Contains(kitId) || _loading) return false;
            if (Entry.Cache == null || !Entry.Cache.Ready)
            {
                FailReason[kitId] = "cache";
                return false;
            }

            CupheadCache.CharacterArt art;
            if (!Entry.Cache.Characters.TryGetValue(kitId, out art) || art == null)
            {
                FailReason[kitId] = "no-art";
                return false;
            }

            object gd = GetGraphicsDevice();
            if (gd == null) return false; // device not ready — allow retry later (not marked failed)
            if (_fromStream == null)
            {
                FailReason[kitId] = "no-FromStream";
                Entry.Log("CupheadSprites: Texture2D.FromStream missing");
                return false;
            }

            LoadAttempted.Add(kitId);
            _loading = true;
            try
            {
                var set = new AnimSet();
                int loaded = 0;
                // Idle first (enough for avatar). Other anims optional.
                LoadAnim(set, art, "idle", MaxIdleFrames, gd, ref loaded);
                foreach (string anim in new[] { "run", "jump", "shoot", "dash" })
                    LoadAnim(set, art, anim, MaxAnimFrames, gd, ref loaded);

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

                if (set.Anims.Count > 0)
                {
                    Sets[kitId] = set;
                    RefreshPngCount();
                    Entry.Log("CupheadSprites kit OK " + kitId + " anims=" + set.Anims.Count + " tex=" + loaded);
                    Entry.BannerMessage = "Cuphead art ready: " + kitId + " (" + loaded + " frames)";
                    Entry.BannerFrames = 60 * 6;
                    return true;
                }

                FailReason[kitId] = "decode0";
                Entry.Log("CupheadSprites kit EMPTY " + kitId + " paths=" + (art.FrameCount) + " | " + StatusLine());
                Entry.BannerMessage = "No Cuphead PNGs decoded for " + kitId + " — pngs=" + _pngCount + ". Delete cache + Play.";
                Entry.BannerFrames = 60 * 12;
                return false;
            }
            catch (Exception ex)
            {
                FailReason[kitId] = "ex";
                Entry.Log("EnsureKit " + kitId + ": " + ex.GetBaseException().Message);
                return false;
            }
            finally
            {
                _loading = false;
            }
        }

        static void LoadAnim(AnimSet set, CupheadCache.CharacterArt art, string anim, int cap, object gd, ref int loaded)
        {
            List<string> paths;
            if (art.Animations == null || !art.Animations.TryGetValue(anim, out paths) || paths == null) return;
            var list = new List<object>();
            int n = 0;
            foreach (var path in paths)
            {
                if (n >= cap) break;
                var tex = LoadTex(path, gd);
                if (tex != null) { list.Add(tex); n++; loaded++; }
            }
            if (list.Count > 0) set.Anims[anim] = list;
        }

        static object LoadTex(string path, object gd)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
            if (Textures.TryGetValue(path, out var cached)) return cached;
            if (_fromStream == null) return null;
            try
            {
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
                Entry.Log("FromStream " + Path.GetFileName(path) + ": " + ex.GetBaseException().Message);
                return null;
            }
        }

        public static object GetPortrait(string kitId)
        {
            if (!HasKit(kitId) && !FailReason.ContainsKey(kitId))
                EnsureKit(kitId);
            AnimSet set;
            if (!Sets.TryGetValue(kitId, out set)) return null;
            if (set.Portrait != null) return set.Portrait;
            List<object> idle;
            if (set.Anims.TryGetValue("idle", out idle) && idle.Count > 0) return idle[0];
            return null;
        }

        /// <summary>Draw only — never loads. Returns true if Cuphead frame was drawn.</summary>
        public static bool TryDrawPlayer(object player)
        {
            string name = (string)Reflect.GetField(player, "name");
            string kit = KitStore.Get(name);
            if (string.IsNullOrEmpty(kit))
                kit = Entry.PendingCreateKit ?? KitStore.GetActive();
            if (string.IsNullOrEmpty(kit) || !HasKit(kit)) return false;

            AnimSet set = Sets[kit];
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
            if (st.Timer >= 5)
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
            float px = Reflect.Vec(pos, "X");
            float py = Reflect.Vec(pos, "Y");
            float sx = Reflect.Vec(screen, "X");
            float sy = Reflect.Vec(screen, "Y");
            int width = (int)(Reflect.GetField(player, "width") ?? 20);
            int height = (int)(Reflect.GetField(player, "height") ?? 42);
            int dir = (int)(Reflect.GetField(player, "direction") ?? 1);

            int tw = (int)AccessTools.Property(tex.GetType(), "Width").GetValue(tex);
            int th = (int)AccessTools.Property(tex.GetType(), "Height").GetValue(tex);
            float scale = (height * 1.4f) / Math.Max(8, th);
            if (scale > 1.4f) scale = 1.4f;
            if (scale < 0.25f) scale = 0.25f;

            float dx = px - sx + width * 0.5f;
            float dy = py - sy + height;
            object fx = dir < 0 ? _fxFlip : _fxNone;

            try
            {
                ResolveDrawMethods(spriteBatch);
                if (_drawRich != null && _vector2 != null && fx != null)
                {
                    object origin = Activator.CreateInstance(_vector2, tw * 0.5f, (float)th);
                    object vpos = Activator.CreateInstance(_vector2, dx, dy);
                    _drawRich.Invoke(spriteBatch, new object[] { tex, vpos, null, _white, 0f, origin, scale, fx, 0f });
                    _lastDrawError = null;
                    return true;
                }
                if (_drawSimple != null && _vector2 != null)
                {
                    // Fallback: no flip/scale — still proves art path
                    object vpos = Activator.CreateInstance(_vector2, dx - tw * 0.5f, dy - th);
                    _drawSimple.Invoke(spriteBatch, new object[] { tex, vpos, _white });
                    _lastDrawError = null;
                    return true;
                }
                _lastDrawError = "no-Draw-overload";
                return false;
            }
            catch (Exception ex)
            {
                _lastDrawError = ex.GetBaseException().Message;
                return false;
            }
        }

        static void ResolveDrawMethods(object spriteBatch)
        {
            if (_drawRich != null || _drawSimple != null) return;
            foreach (var m in spriteBatch.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance))
            {
                if (m.Name != "Draw") continue;
                var ps = m.GetParameters();
                if (_drawRich == null && ps.Length == 9 && ps[7].ParameterType.Name.Contains("SpriteEffects"))
                    _drawRich = m;
                if (_drawSimple == null && ps.Length == 3
                    && (ps[1].ParameterType.Name == "Vector2" || ps[1].Name.IndexOf("Vector", StringComparison.Ordinal) >= 0))
                    _drawSimple = m;
            }
        }

        static string PickAnim(object player)
        {
            try
            {
                object vel = Reflect.GetField(player, "velocity");
                float vx = Reflect.Vec(vel, "X");
                float vy = Reflect.Vec(vel, "Y");
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
