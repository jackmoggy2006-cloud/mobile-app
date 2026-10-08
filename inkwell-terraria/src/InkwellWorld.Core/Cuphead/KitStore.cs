using System;
using System.Collections.Generic;
using System.IO;

namespace InkwellWorld.Cuphead
{
    /// <summary>
    /// Maps player names → kit ids, plus a global "active" kit applied to the local player in-world (F1/F2/F3).
    /// </summary>
    public static class KitStore
    {
        public static string DataDir => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InkwellWorld");

        public static string PathFile => Path.Combine(DataDir, "kits.txt");
        public static string ActiveFile => Path.Combine(DataDir, "active_kit.txt");

        static readonly Dictionary<string, string> Map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        static bool Loaded;
        static string _active;

        public static void Set(string playerName, string characterId)
        {
            EnsureLoaded();
            if (string.IsNullOrEmpty(characterId)) return;
            if (!string.IsNullOrEmpty(playerName))
                Map[playerName] = characterId;
            SetActive(characterId);
            Save();
        }

        public static void SetActive(string characterId)
        {
            EnsureLoaded();
            if (string.IsNullOrEmpty(characterId)) return;
            _active = characterId;
            try
            {
                Directory.CreateDirectory(DataDir);
                File.WriteAllText(ActiveFile, characterId.Trim());
            }
            catch { }
        }

        public static string GetActive()
        {
            EnsureLoaded();
            return _active;
        }

        public static string Get(string playerName)
        {
            EnsureLoaded();
            if (string.IsNullOrEmpty(playerName)) return null;
            string id;
            if (Map.TryGetValue(playerName, out id)) return id;
            // Fuzzy: name contains cuphead / mugman / chalice
            string n = playerName.ToLowerInvariant();
            if (n.Contains("chalice")) return "chalice";
            if (n.Contains("mugman") || n == "mm") return "mugman";
            if (n.Contains("cuphead") || n == "cup") return "cuphead";
            // Do NOT fall back to global active here — that made every menu preview
            // a Cuphead draw and could skip vanilla DrawPlayer for the whole UI.
            return null;
        }

        static void EnsureLoaded()
        {
            if (Loaded) return;
            Loaded = true;
            try
            {
                if (File.Exists(PathFile))
                {
                    foreach (string line in File.ReadAllLines(PathFile))
                    {
                        int eq = line.IndexOf('=');
                        if (eq <= 0) continue;
                        Map[line.Substring(0, eq).Trim()] = line.Substring(eq + 1).Trim();
                    }
                }
                if (File.Exists(ActiveFile))
                    _active = File.ReadAllText(ActiveFile).Trim();
            }
            catch { }
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
                if (!string.IsNullOrEmpty(_active))
                    File.WriteAllText(ActiveFile, _active);
            }
            catch { }
        }
    }
}
