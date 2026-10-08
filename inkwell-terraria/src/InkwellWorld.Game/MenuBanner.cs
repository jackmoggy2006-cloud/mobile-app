using System;
using System.Reflection;
using HarmonyLib;

namespace InkwellWorld.Game
{
    static class MenuBanner
    {
        static Assembly _terraria;
        static Type _main;

        public static void Patch(Harmony harmony, Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            MethodInfo doUpdate = AccessTools.Method(_main, "DoUpdate");
            if (doUpdate != null)
                harmony.Patch(doUpdate, postfix: new HarmonyMethod(typeof(MenuBanner), nameof(Tick)));
            MethodInfo draw = AccessTools.Method(_main, "DrawInterface");
            if (draw == null)
                draw = AccessTools.Method(_main, "DrawMenu");
            if (draw != null)
                harmony.Patch(draw, postfix: new HarmonyMethod(typeof(MenuBanner), nameof(Draw)));
        }

        static void Tick()
        {
            if (Entry.BannerFrames > 0)
                Entry.BannerFrames--;
        }

        static void Draw()
        {
            if (Entry.BannerFrames <= 0 || string.IsNullOrEmpty(Entry.BannerMessage)) return;
            try
            {
                var spriteBatch = Reflect.GetStatic(_main, "spriteBatch");
                var font = Reflect.GetStatic(_main, "fontMouseText");
                if (spriteBatch == null || font == null) return;
                Type utils = _terraria.GetType("Terraria.Utils");
                Type colorT = _terraria.GetType("Microsoft.Xna.Framework.Color")
                    ?? Type.GetType("Microsoft.Xna.Framework.Color, Microsoft.Xna.Framework");
                Type v2 = _terraria.GetType("Microsoft.Xna.Framework.Vector2")
                    ?? Type.GetType("Microsoft.Xna.Framework.Vector2, Microsoft.Xna.Framework");
                if (utils == null || colorT == null || v2 == null) return;
                object color = Activator.CreateInstance(colorT, (byte)255, (byte)220, (byte)80, (byte)255);
                object pos = Activator.CreateInstance(v2, 40f, 40f);
                foreach (var m in utils.GetMethods(BindingFlags.Static | BindingFlags.Public))
                {
                    if (m.Name != "DrawBorderString") continue;
                    var ps = m.GetParameters();
                    if (ps.Length < 4) continue;
                    object[] args = new object[ps.Length];
                    args[0] = spriteBatch;
                    args[1] = Entry.BannerMessage;
                    args[2] = pos;
                    args[3] = color;
                    for (int i = 4; i < ps.Length; i++)
                        args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType == typeof(float) ? 1f : 0);
                    m.Invoke(null, args);
                    break;
                }
            }
            catch (Exception) { }
        }
    }
}
