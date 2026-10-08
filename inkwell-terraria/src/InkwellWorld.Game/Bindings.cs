using System;
using System.Reflection;
using HarmonyLib;

namespace InkwellWorld.Game
{
    /// <summary>Keyboard bindings: X = parry, LeftShift = dash, Space = jump, mouse = shot/EX.</summary>
    static class Bindings
    {
        static Type _keys;
        static MethodInfo _isDown;
        static object _x, _leftShift, _space, _z;

        static void Ensure()
        {
            if (_isDown != null) return;
            _keys = Type.GetType("Microsoft.Xna.Framework.Input.Keyboard, Microsoft.Xna.Framework.Input")
                ?? Type.GetType("Microsoft.Xna.Framework.Input.Keyboard, Microsoft.Xna.Framework");
            Type key = Type.GetType("Microsoft.Xna.Framework.Input.Keys, Microsoft.Xna.Framework.Input")
                ?? Type.GetType("Microsoft.Xna.Framework.Input.Keys, Microsoft.Xna.Framework");
            if (_keys == null || key == null)
            {
                // Terraria embeds / redirects input — also try Terraria.GameInput
                return;
            }
            _isDown = AccessTools.Method(_keys, "GetState");
            _x = Enum.Parse(key, "X");
            _z = Enum.Parse(key, "Z");
            _leftShift = Enum.Parse(key, "LeftShift");
            _space = Enum.Parse(key, "Space");
        }

        static bool Down(object key)
        {
            Ensure();
            if (_isDown == null || key == null) return false;
            object state = _isDown.Invoke(null, null);
            MethodInfo isDown = AccessTools.Method(state.GetType(), "IsKeyDown");
            return (bool)isDown.Invoke(state, new[] { key });
        }

        public static bool ParryDown()
        {
            Ensure();
            return Down(_x) || Down(_z);
        }

        public static bool DashDown()
        {
            Ensure();
            return Down(_leftShift);
        }

        public static bool JumpDown()
        {
            Ensure();
            if (Down(_space)) return true;
            // Terraria controlJump
            try
            {
                var main = AccessTools.TypeByName("Terraria.Main");
                var p = Reflect.GetStatic(main, "player");
                if (p is Array arr)
                {
                    int my = (int)Reflect.GetStatic(main, "myPlayer");
                    object plr = arr.GetValue(my);
                    return (bool)(Reflect.GetField(plr, "controlJump") ?? false);
                }
            }
            catch (Exception) { }
            return false;
        }

        public static bool MouseLeft()
        {
            try
            {
                var main = AccessTools.TypeByName("Terraria.Main");
                return (bool)(Reflect.GetStatic(main, "mouseLeft") ?? false);
            }
            catch { return false; }
        }

        public static bool MouseRight()
        {
            try
            {
                var main = AccessTools.TypeByName("Terraria.Main");
                return (bool)(Reflect.GetStatic(main, "mouseRight") ?? false);
            }
            catch { return false; }
        }
    }
}
