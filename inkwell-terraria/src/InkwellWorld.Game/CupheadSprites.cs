using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;

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
        static Type _rectangle;
        static Type _spriteEffects;
        static object _white;
        static object _fxNone, _fxFlip;
        static MethodInfo _fromStream;
        static readonly Dictionary<string, object> Textures = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, AnimSet> Sets = new Dictionary<string, AnimSet>(StringComparer.OrdinalIgnoreCase);
        static bool _loaded;
        static bool _failed;

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

        public static void Init(Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            _texture2D = Type.GetType("Microsoft.Xna.Framework.Graphics.Texture2D, Microsoft.Xna.Framework.Graphics")
                ?? terraria.GetType("Microsoft.Xna.Framework.Graphics.Texture2D");
            _color = Type.GetType("Microsoft.Xna.Framework.Color, Microsoft.Xna.Framework")
                ?? terraria.GetType("Microsoft.Xna.Framework.Color");
            _vector2 = Type.GetType("Microsoft.Xna.Framework.Vector2, Microsoft.Xna.Framework")
                ?? terraria.GetType("Microsoft.Xna.Framework.Vector2");
            _rectangle = Type.GetType("Microsoft.Xna.Framework.Rectangle, Microsoft.Xna.Framework")
                ?? terraria.GetType("Microsoft.Xna.Framework.Rectangle");
            _spriteEffects = Type.GetType("Microsoft.Xna.Framework.Graphics.SpriteEffects, Microsoft.Xna.Framework.Graphics")
                ?? terraria.GetType("Microsoft.Xna.Framework.Graphics.SpriteEffects");
            if (_color != null)
                _white = _color.GetProperty("White")?.GetValue(null)
                    ?? Activator.CreateInstance(_color, (byte)255, (byte)255, (byte)255, (byte)255);
            if (_spriteEffects != null)
            {
                _fxNone = Enum.Parse(_spriteEffects, "None");
                _fxFlip = Enum.Parse(_spriteEffects, "FlipHorizontally");
            }
        }

        public static void EnsureLoaded()
        {
            if (_loaded || _failed) return;
            if (Entry.Cache == null || !Entry.Cache.Ready)
            {
                _failed = true;
                return;
            }
            try
            {
                object gd = null;
                object graphics = Reflect.GetStatic(_main, "graphics");
                if (graphics != null)
                    gd = AccessTools.Property(graphics.GetType(), "GraphicsDevice")?.GetValue(graphics)
                        ?? Reflect.GetField(graphics, "GraphicsDevice");
                if (gd == null)
                {
                    Entry.Log("CupheadSprites: GraphicsDevice not ready yet");
                    return;
                }
                if (_texture2D != null)
                {
                    foreach (var m in _texture2D.GetMethods(BindingFlags.Public | BindingFlags.Static))
                    {
                        if (m.Name == "FromStream" && m.GetParameters().Length >= 2)
                        {
                            _fromStream = m;
                            break;
                        }
                    }
                }
                foreach (var kv in Entry.Cache.Characters)
                    LoadCharacter(kv.Key, kv.Value, gd);
                _loaded = true;
                Entry.Log("CupheadSprites loaded for " + Sets.Count + " characters");
            }
            catch (Exception ex)
            {
                _failed = true;
                Entry.Log("CupheadSprites load failed: " + ex);
            }
        }

        static void LoadCharacter(string id, CupheadCache.CharacterArt art, object gd)
        {
            var set = new AnimSet();
            if (art.Animations != null && art.Animations.Count > 0)
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
        }

        static object LoadTex(string path, object gd)
        {
            if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
            if (Textures.TryGetValue(path, out var cached)) return cached;
            if (_fromStream == null) return null;
            using (var fs = File.OpenRead(path))
            {
                object tex = _fromStream.Invoke(null, new object[] { gd, fs });
                Textures[path] = tex;
                return tex;
            }
        }

        public static object GetPortrait(string kitId)
        {
            EnsureLoaded();
            AnimSet set;
            if (!Sets.TryGetValue(kitId, out set)) return null;
            if (set.Portrait != null) return set.Portrait;
            List<object> idle;
            if (set.Anims.TryGetValue("idle", out idle) && idle.Count > 0)
                return idle[0];
            return null;
        }

        public static bool TryDrawPlayer(object player)
        {
            EnsureLoaded();
            string name = (string)Reflect.GetField(player, "name");
            string kit = KitStore.Get(name) ?? Entry.PendingCreateKit;
            if (string.IsNullOrEmpty(kit)) return false;
            AnimSet set;
            if (!Sets.TryGetValue(kit, out set) || set.Anims.Count == 0) return false;

            int who = (int)(Reflect.GetField(player, "whoAmI") ?? 0);
            AnimState st;
            if (!Play.TryGetValue(who, out st))
                Play[who] = st = new AnimState();

            string want = PickAnim(player);
            if (want != st.Anim)
            {
                st.Anim = want;
                st.Frame = 0;
                st.Timer = 0;
            }
            List<object> frames;
            if (!set.Anims.TryGetValue(st.Anim, out frames) || frames.Count == 0)
            {
                if (!set.Anims.TryGetValue("idle", out frames) || frames.Count == 0)
                    return false;
            }
            st.Timer++;
            int rate = st.Anim == "run" || st.Anim == "shoot" ? 4 : 6;
            if (st.Timer >= rate)
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
            // Fit Cuphead art to roughly player height (keep aspect).
            float scale = (height * 1.35f) / Math.Max(8, th);
            if (scale > 1.2f) scale = 1.2f;
            if (scale < 0.25f) scale = 0.25f;

            float drawW = tw * scale;
            float drawH = th * scale;
            float dx = px - sx + width * 0.5f - drawW * 0.5f;
            float dy = py - sy + height - drawH;

            object fx = dir < 0 ? _fxFlip : _fxNone;
            try
            {
                // Draw(Texture2D, Vector2, Rectangle?, Color, float rotation, Vector2 origin, float scale, SpriteEffects, float layerDepth)
                MethodInfo rich = null;
                foreach (var m in spriteBatch.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (m.Name != "Draw") continue;
                    var ps = m.GetParameters();
                    if (ps.Length == 9 && ps[7].ParameterType.Name.Contains("SpriteEffects"))
                    {
                        rich = m;
                        break;
                    }
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
                bool mount = false;
                try { mount = (bool)(Reflect.GetField(Reflect.GetField(player, "mount"), "Active") ?? false); } catch { }
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
