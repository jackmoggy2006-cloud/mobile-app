using System;
using System.Linq;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;
using InkwellWorld.Generated;

namespace InkwellWorld.Game
{
    public static class Entry
    {
        public const string Stage = "1a";
        public static Action<string> Log = _ => { };
        public static CupheadCache Cache;
        public static string PendingCreateKit;
        public static string BannerMessage;
        public static int BannerFrames;

        static Harmony _harmony;
        static Assembly _terraria;

        public static void Start(Assembly terraria, string cacheDir, Action<string> log)
        {
            Log = log ?? Log;
            _terraria = terraria;
            Cache = CupheadCache.Open(cacheDir);
            if (!Cache.Ready)
            {
                BannerMessage = Cache.Message;
                BannerFrames = 60 * 12;
                Log("Cuphead: " + Cache.Message);
            }
            else
                Log("Cuphead cache ready with " + Cache.Characters.Count + " characters");

            // Subscribe to Main.OnEngineLoad before calling Terraria entry.
            Type main = terraria.GetType("Terraria.Main", true);
            EventInfo onLoad = main.GetEvent("OnEngineLoad", BindingFlags.Static | BindingFlags.Public);
            if (onLoad == null)
                throw new MissingMemberException("Terraria.Main", "OnEngineLoad");
            // Set SavePath like Terranoita before Main's static ctor runs.
            SetSavePath(terraria);
            var handler = (Action)ApplyPatches;
            onLoad.AddEventHandler(null, handler);
            Log("InkwellWorld subscribed to OnEngineLoad");
        }

        static void SetSavePath(Assembly terraria)
        {
            try
            {
                Type program = terraria.GetType("Terraria.Program", true);
                FieldInfo savePath = program.GetField("SavePath", BindingFlags.Static | BindingFlags.Public);
                if (savePath == null) return;
                var args = Environment.GetCommandLineArgs();
                int sd = Array.FindIndex(args, a => string.Equals(a, "-savedirectory", StringComparison.OrdinalIgnoreCase));
                string path = sd >= 0 && sd + 1 < args.Length
                    ? args[sd + 1]
                    : System.IO.Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "My Games", "Terraria");
                savePath.SetValue(null, path);
                Log("Terraria save folder: " + path);
            }
            catch (Exception ex)
            {
                Log("SavePath setup: " + ex.Message);
            }
        }

        static void ApplyPatches()
        {
            try
            {
                _harmony = new Harmony("gg.melty.inkwellworld");
                CupheadSprites.Init(_terraria);
                CharacterCreate.Patch(_harmony, _terraria);
                PlayerKit.Patch(_harmony, _terraria);
                MenuBanner.Patch(_harmony, _terraria);
                // Do NOT load all Cuphead textures here — that froze the game (black screen).
                // Frames load lazily when F1/F2/F3 or a named kit draws.
                foreach (var h in Hooks.All)
                {
                    if (h.Patch == "call") continue;
                    Log("hook planned " + h.Id + " -> " + h.Target);
                }
                Log("InkwellWorld patches applied: " + _harmony.GetPatchedMethods().Count());
            }
            catch (Exception ex)
            {
                Log("FATAL applying patches: " + ex);
            }
        }
    }
}
