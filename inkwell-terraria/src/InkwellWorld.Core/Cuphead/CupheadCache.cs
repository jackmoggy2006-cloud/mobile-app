using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace InkwellWorld.Cuphead
{
    /// <summary>
    /// Reads Melty/CupPrepare output. ready.json v2 includes animations{ idle:[...], run:[...], ... }.
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
            public Dictionary<string, List<string>> Animations = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            public int FrameCount;
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
                int frames = 0;
                foreach (var kv in cache.Characters) frames += kv.Value.FrameCount;
                if (frames == 0)
                {
                    return new CupheadCache(cacheDir, false,
                        "Cuphead was found but player sprites were not extracted. Update Inkwell Terraria and press Play again (CupPrepare needs prepare/python).");
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
            foreach (string id in new[] { "cuphead", "mugman", "chalice" })
            {
                string key = "\"" + id + "\"";
                int at = json.IndexOf(key, StringComparison.OrdinalIgnoreCase);
                if (at < 0) continue;
                // Limit search to this character's object (until next sibling or end)
                int objStart = json.IndexOf('{', at);
                if (objStart < 0) continue;
                int depth = 0, objEnd = objStart;
                for (int i = objStart; i < json.Length; i++)
                {
                    if (json[i] == '{') depth++;
                    else if (json[i] == '}')
                    {
                        depth--;
                        if (depth == 0) { objEnd = i; break; }
                    }
                }
                string body = json.Substring(objStart, objEnd - objStart + 1);
                var art = new CharacterArt();
                art.PortraitPath = Rel(FindString(body, "\"portrait\""));
                art.FramePaths = RelAll(FindStringArray(body, "\"frames\""));
                art.FrameCount = art.FramePaths.Count;
                // animations object
                int animAt = body.IndexOf("\"animations\"", StringComparison.Ordinal);
                if (animAt >= 0)
                {
                    foreach (string anim in new[] { "idle", "run", "jump", "shoot", "dash", "duck", "parry", "ex", "hit" })
                    {
                        var frames = RelAll(FindStringArray(body, "\"" + anim + "\""));
                        if (frames.Count > 0)
                            art.Animations[anim] = frames;
                    }
                }
                if (art.FrameCount == 0 && art.Animations.Count > 0)
                {
                    foreach (var kv in art.Animations)
                        art.FramePaths.AddRange(kv.Value);
                    art.FrameCount = art.FramePaths.Count;
                }
                Characters[id] = art;
            }
        }

        string Rel(string rel)
        {
            if (string.IsNullOrEmpty(rel)) return null;
            return Path.Combine(Root, rel.Replace('/', Path.DirectorySeparatorChar));
        }

        List<string> RelAll(List<string> rels)
        {
            var list = new List<string>();
            foreach (var r in rels)
            {
                string p = Rel(r);
                if (!string.IsNullOrEmpty(p)) list.Add(p);
            }
            return list;
        }

        static string FindString(string json, string key)
        {
            int k = json.IndexOf(key, StringComparison.Ordinal);
            if (k < 0) return null;
            int colon = json.IndexOf(':', k);
            int q1 = json.IndexOf('"', colon + 1);
            if (q1 < 0) return null;
            int q2 = json.IndexOf('"', q1 + 1);
            if (q2 < 0) return null;
            return json.Substring(q1 + 1, q2 - q1 - 1);
        }

        static List<string> FindStringArray(string json, string key)
        {
            var list = new List<string>();
            int k = json.IndexOf(key, StringComparison.Ordinal);
            if (k < 0) return list;
            int lb = json.IndexOf('[', k);
            if (lb < 0) return list;
            int rb = json.IndexOf(']', lb);
            if (rb < 0) return list;
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
