using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace InkwellWorld.Game
{
    /// <summary>Loads prepared Cuphead PNGs into XNA/FNA Texture2D and draws animated avatars.</summary>
    static class CupheadSprites
    {
        static Assembly _terraria;
        static Type _main;
        static Type _texture2D;
        static Type _color;
        static Type _vector2;
        static Type _spriteEffects;
        static object _white;
        static object _fxNone, _fxFlip;
        static MethodInfo _fromStream;
        static MethodInfo _setData;
        static ConstructorInfo _texCtor;
        static readonly Dictionary<string, object> Textures = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, AnimSet> Sets = new Dictionary<string, AnimSet>(StringComparer.OrdinalIgnoreCase);
        static bool _loaded;
        static bool _failed;
        static int _retryLog;

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

        public static bool HasKit(string kitId)
        {
            EnsureLoaded();
            return !string.IsNullOrEmpty(kitId) && Sets.ContainsKey(kitId) && Sets[kitId].Anims.Count > 0;
        }

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
            EnsureLoaded();
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
            Entry.Log("CupheadSprites types tex=" + (_texture2D != null) + " color=" + (_color != null));
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
                foreach (var c in _texture2D.GetConstructors())
                {
                    var ps = c.GetParameters();
                    if (ps.Length == 3 && ps[1].ParameterType == typeof(int) && ps[2].ParameterType == typeof(int))
                    { _texCtor = c; break; }
                }
                foreach (var m in _texture2D.GetMethods(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (m.Name != "SetData" || !m.IsGenericMethodDefinition) continue;
                    try
                    {
                        _setData = m.MakeGenericMethod(_color);
                        break;
                    }
                    catch { }
                }
            }
        }

        static object GetGraphicsDevice()
        {
            // Main.graphics.GraphicsDevice
            object graphics = Reflect.GetStatic(_main, "graphics");
            if (graphics != null)
            {
                var gd = AccessTools.Property(graphics.GetType(), "GraphicsDevice")?.GetValue(graphics)
                    ?? Reflect.GetField(graphics, "GraphicsDevice");
                if (gd != null) return gd;
            }
            // Main.instance.GraphicsDevice (XNA Game)
            object instance = Reflect.GetStatic(_main, "instance");
            if (instance != null)
            {
                var gd = AccessTools.Property(instance.GetType(), "GraphicsDevice")?.GetValue(instance)
                    ?? Reflect.GetField(instance, "GraphicsDevice");
                if (gd != null) return gd;
            }
            return null;
        }

        public static void EnsureLoaded()
        {
            if (_loaded) return;
            if (Entry.Cache == null || !Entry.Cache.Ready)
            {
                if (_retryLog-- <= 0) { Entry.Log("CupheadSprites: " + StatusLine()); _retryLog = 180; }
                return;
            }
            try
            {
                object gd = GetGraphicsDevice();
                if (gd == null)
                {
                    if (_retryLog-- <= 0) { Entry.Log("CupheadSprites: GraphicsDevice not ready; " + StatusLine()); _retryLog = 120; }
                    return;
                }

                // Report disk state once
                if (_retryLog <= 0)
                {
                    Entry.Log("CupheadSprites loading… " + StatusLine());
                    _retryLog = 9999;
                }

                Sets.Clear();
                Textures.Clear();
                foreach (var kv in Entry.Cache.Characters)
                    LoadCharacter(kv.Key, kv.Value, gd);

                _loaded = Sets.Count > 0;
                Entry.Log(_loaded
                    ? "CupheadSprites LOADED sets=" + Sets.Count + " textures=" + Textures.Count
                    : "CupheadSprites EMPTY — PNGs missing or decode failed. " + StatusLine());
                if (_loaded)
                {
                    Entry.BannerMessage = "Cuphead art loaded (" + Textures.Count + " frames). F1/F2/F3 to switch.";
                    Entry.BannerFrames = 60 * 6;
                }
            }
            catch (Exception ex)
            {
                Entry.Log("CupheadSprites load failed: " + ex);
            }
        }

        static void LoadCharacter(string id, CupheadCache.CharacterArt art, object gd)
        {
            var set = new AnimSet();
            if (art.Animations != null)
            {
                foreach (var anim in art.Animations)
                {
                    var list = new List<object>();
                    foreach (var path in anim.Value)
                    {
                        var tex = LoadTex(path, gd);
                        if (tex != null) list.Add(tex);
                    }
                    if (list.Count > 0) set.Anims[anim.Key] = list;
                }
            }
            if (set.Anims.Count == 0 && art.FramePaths != null)
            {
                var list = new List<object>();
                foreach (var path in art.FramePaths)
                {
                    var tex = LoadTex(path, gd);
                    if (tex != null) list.Add(tex);
                }
                if (list.Count > 0) set.Anims["idle"] = list;
            }
            if (!string.IsNullOrEmpty(art.PortraitPath))
                set.Portrait = LoadTex(art.PortraitPath, gd);
            if (set.Anims.Count > 0 || set.Portrait != null)
                Sets[id] = set;
            Entry.Log("char " + id + " anims=" + set.Anims.Count + " framesTotal=" + art.FrameCount);
        }

        static object LoadTex(string path, object gd)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
            if (Textures.TryGetValue(path, out var cached)) return cached;

            // 1) ImageSharp → Texture2D.SetData (most reliable on FNA/XNA)
            object tex = LoadViaImageSharp(path, gd);
            if (tex == null && _fromStream != null)
            {
                try
                {
                    using (var fs = File.OpenRead(path))
                        tex = _fromStream.Invoke(null, new object[] { gd, fs });
                }
                catch (Exception ex)
                {
                    Entry.Log("FromStream fail " + Path.GetFileName(path) + ": " + ex.GetBaseException().Message);
                }
            }
            if (tex != null) Textures[path] = tex;
            return tex;
        }

        static object LoadViaImageSharp(string path, object gd)
        {
            if (_texCtor == null || _setData == null || _color == null) return null;
            try
            {
                using (var img = Image.Load<Rgba32>(path))
                {
                    object tex = _texCtor.Invoke(new object[] { gd, img.Width, img.Height });
                    Array colors = Array.CreateInstance(_color, img.Width * img.Height);
                    int i = 0;
                    img.ProcessPixelRows(accessor =>
                    {
                        for (int y = 0; y < accessor.Height; y++)
                        {
                            var row = accessor.GetRowSpan(y);
                            for (int x = 0; x < row.Length; x++)
                            {
                                var p = row[x];
                                colors.SetValue(Activator.CreateInstance(_color, p.R, p.G, p.B, p.A), i++);
                            }
                        }
                    });
                    _setData.Invoke(tex, new object[] { colors });
                    return tex;
                }
            }
            catch (Exception ex)
            {
                Entry.Log("ImageSharp fail " + Path.GetFileName(path) + ": " + ex.GetBaseException().Message);
                return null;
            }
        }

        public static object GetPortrait(string kitId)
        {
            EnsureLoaded();
            AnimSet set;
            if (!Sets.TryGetValue(kitId, out set)) return null;
            if (set.Portrait != null) return set.Portrait;
            List<object> idle;
            if (set.Anims.TryGetValue("idle", out idle) && idle.Count > 0) return idle[0];
            return null;
        }

        public static bool TryDrawPlayer(object player)
        {
            EnsureLoaded();
            string name = (string)Reflect.GetField(player, "name");
            string kit = KitStore.Get(name) ?? Entry.PendingCreateKit ?? KitStore.GetActive();
            if (string.IsNullOrEmpty(kit)) return false;
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
                MethodInfo rich = null;
                foreach (var m in spriteBatch.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (m.Name != "Draw") continue;
                    var ps = m.GetParameters();
                    if (ps.Length == 9 && ps[7].ParameterType.Name.Contains("SpriteEffects"))
                    { rich = m; break; }
                }
                if (rich == null) return false;
                object origin = Activator.CreateInstance(_vector2, tw * 0.5f, (float)th);
                object vpos = Activator.CreateInstance(_vector2, px - sx + width * 0.5f, py - sy + height);
                rich.Invoke(spriteBatch, new object[] { tex, vpos, null, _white, 0f, origin, scale, fx, 0f });
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
