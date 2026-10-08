using System;
using System.Reflection;
using HarmonyLib;

namespace InkwellWorld.Game
{
    static class Reflect
    {
        public static Type Type(Assembly asm, string name) =>
            asm.GetType(name, true);

        public static MethodInfo Method(Type t, string name, params Type[] args)
        {
            var m = args == null || args.Length == 0
                ? AccessTools.Method(t, name)
                : AccessTools.Method(t, name, args);
            if (m == null)
                throw new MissingMethodException(t.FullName, name);
            return m;
        }

        public static object GetField(object obj, string name)
        {
            if (obj == null) return null;
            var f = AccessTools.Field(obj.GetType(), name);
            if (f != null) return f.GetValue(obj);
            var p = AccessTools.Property(obj.GetType(), name);
            return p?.GetValue(obj, null);
        }

        public static void SetField(object obj, string name, object value)
        {
            if (obj == null) return;
            var f = AccessTools.Field(obj.GetType(), name);
            if (f != null) { f.SetValue(obj, value); return; }
            var p = AccessTools.Property(obj.GetType(), name);
            p?.SetValue(obj, value, null);
        }

        public static object GetStatic(Type t, string name)
        {
            var f = AccessTools.Field(t, name);
            if (f != null) return f.GetValue(null);
            var p = AccessTools.Property(t, name);
            return p?.GetValue(null, null);
        }

        public static void SetStatic(Type t, string name, object value)
        {
            var f = AccessTools.Field(t, name);
            if (f != null) { f.SetValue(null, value); return; }
            var p = AccessTools.Property(t, name);
            p?.SetValue(null, value, null);
        }

        public static float Vec(object vector, string axis)
        {
            if (vector == null) return 0f;
            object v = GetField(vector, axis);
            if (v == null) return 0f;
            return Convert.ToSingle(v);
        }
    }
}
