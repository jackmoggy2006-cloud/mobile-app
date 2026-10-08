using System;
using System.Collections.Generic;
using System.IO;

namespace InkwellWorld.Cuphead
{
    /// <summary>Maps Terraria player names to Cuphead character ids under %LOCALAPPDATA%/InkwellWorld.</summary>
    public static class KitStore
    {
        public static string DataDir => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InkwellWorld");

        public static string PathFile => Path.Combine(DataDir, "kits.txt");

        static readonly Dictionary<string, string> Map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        static bool Loaded;

        public static void Set(string playerName, string characterId)
        {
            EnsureLoaded();
            if (string.IsNullOrEmpty(playerName) || string.IsNullOrEmpty(characterId)) return;
            Map[playerName] = characterId;
            Save();
        }

        public static string Get(string playerName)
        {
            EnsureLoaded();
            if (string.IsNullOrEmpty(playerName)) return null;
            string id;
            return Map.TryGetValue(playerName, out id) ? id : null;
        }

        static void EnsureLoaded()
        {
            if (Loaded) return;
            Loaded = true;
            try
            {
                if (!File.Exists(PathFile)) return;
                foreach (string line in File.ReadAllLines(PathFile))
                {
                    int eq = line.IndexOf('=');
                    if (eq <= 0) continue;
                    Map[line.Substring(0, eq).Trim()] = line.Substring(eq + 1).Trim();
                }
            }
            catch (Exception) { }
        }

        static void Save()
        {
            try
            {
                Directory.CreateDirectory(DataDir);
                var lines = new List<string>();
                foreach (var kv in Map)
                    lines.Add(kv.Key + "=" + kv.Value);
                File.WriteAllLines(PathFile, lines.ToArray());
            }
            catch (Exception) { }
        }
    }
}
