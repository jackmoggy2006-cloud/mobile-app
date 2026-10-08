using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace InkwellWorld.Cuphead
{
    /// <summary>
    /// Reads Melty/CupPrepare output under CacheDir. Never ships Cuphead files; only the player's prepared cache.
    /// ready.json shape:
    /// { "version": 1, "characters": { "cuphead": { "portrait": "cuphead_portrait.png", "frames": ["..."] }, ... } }
    /// </summary>
    public sealed class CupheadCache
    {
        public readonly string Root;
        public readonly bool Ready;
        public readonly string Message;
        public readonly Dictionary<string, CharacterArt> Characters = new Dictionary<string, CharacterArt>(StringComparer.OrdinalIgnoreCase);

        public sealed class CharacterArt
        {
            public string PortraitPath;
            public List<string> FramePaths = new List<string>();
        }

        public static CupheadCache Open(string cacheDir)
        {
            if (string.IsNullOrEmpty(cacheDir) || !Directory.Exists(cacheDir))
            {
                return new CupheadCache(cacheDir, false,
                    "Cuphead was not found. Install Cuphead on Steam, then press Play again in Melty.");
            }
            string ready = Path.Combine(cacheDir, "ready.json");
            if (!File.Exists(ready))
            {
                return new CupheadCache(cacheDir, false,
                    "Cuphead is installed but not ready yet. Melty should finish preparing it — try Play again.");
            }
            try
            {
                var cache = new CupheadCache(cacheDir, true, null);
                cache.ParseReady(File.ReadAllText(ready));
                if (cache.Characters.Count == 0)
                {
                    return new CupheadCache(cacheDir, false,
                        "Cuphead cache has no characters. Reinstall the mashup or repair Cuphead.");
                }
                return cache;
            }
            catch (Exception ex)
            {
                return new CupheadCache(cacheDir, false, "Could not read Cuphead cache: " + ex.Message);
            }
        }

        CupheadCache(string root, bool ready, string message)
        {
            Root = root;
            Ready = ready;
            Message = message;
        }

        void ParseReady(string json)
        {
            // Minimal JSON walk — avoid a NuGet dependency in Core.
            int chars = json.IndexOf("\"characters\"", StringComparison.Ordinal);
            if (chars < 0) return;
            foreach (string id in new[] { "cuphead", "mugman", "chalice" })
            {
                string key = "\"" + id + "\"";
                int at = json.IndexOf(key, chars, StringComparison.OrdinalIgnoreCase);
                if (at < 0) continue;
                var art = new CharacterArt();
                art.PortraitPath = FindStringAfter(json, at, "\"portrait\"");
                art.FramePaths = FindStringArrayAfter(json, at, "\"frames\"");
                if (!string.IsNullOrEmpty(art.PortraitPath))
                    art.PortraitPath = Path.Combine(Root, art.PortraitPath.Replace('/', Path.DirectorySeparatorChar));
                for (int i = 0; i < art.FramePaths.Count; i++)
                    art.FramePaths[i] = Path.Combine(Root, art.FramePaths[i].Replace('/', Path.DirectorySeparatorChar));
                Characters[id] = art;
            }
        }

        static string FindStringAfter(string json, int from, string key)
        {
            int k = json.IndexOf(key, from, StringComparison.Ordinal);
            if (k < 0) return null;
            int colon = json.IndexOf(':', k);
            int q1 = json.IndexOf('"', colon + 1);
            int q2 = json.IndexOf('"', q1 + 1);
            if (q1 < 0 || q2 < 0) return null;
            return json.Substring(q1 + 1, q2 - q1 - 1);
        }

        static List<string> FindStringArrayAfter(string json, int from, string key)
        {
            var list = new List<string>();
            int k = json.IndexOf(key, from, StringComparison.Ordinal);
            if (k < 0) return list;
            int lb = json.IndexOf('[', k);
            int rb = json.IndexOf(']', lb);
            if (lb < 0 || rb < 0) return list;
            string body = json.Substring(lb + 1, rb - lb - 1);
            var sb = new StringBuilder();
            bool inStr = false;
            for (int i = 0; i < body.Length; i++)
            {
                char c = body[i];
                if (c == '"' && (i == 0 || body[i - 1] != '\\'))
                {
                    if (inStr)
                    {
                        list.Add(sb.ToString());
                        sb.Clear();
                        inStr = false;
                    }
                    else inStr = true;
                    continue;
                }
                if (inStr) sb.Append(c);
            }
            return list;
        }
    }
}
