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
            var f = AccessTools.Field(obj.GetType(), name);
            return f?.GetValue(obj);
        }

        public static void SetField(object obj, string name, object value)
        {
            var f = AccessTools.Field(obj.GetType(), name);
            f?.SetValue(obj, value);
        }

        public static object GetStatic(Type t, string name)
        {
            var f = AccessTools.Field(t, name);
            return f?.GetValue(null);
        }

        public static void SetStatic(Type t, string name, object value)
        {
            var f = AccessTools.Field(t, name);
            f?.SetValue(null, value);
        }
    }
}
