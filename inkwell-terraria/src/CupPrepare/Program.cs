using System.Diagnostics;
using System.Text.Json;

namespace CupPrepare;

/// <summary>
/// Melty ownCopies prepare step: read the player's Cuphead folder, write a cache with ready.json.
/// Prefers UnityPy (prepare_cuphead.py beside this exe) for real atlas frames; otherwise copies the
/// player's atlas_player bundle into the cache so the mashup still uses real Cuphead files.
/// </summary>
static class Program
{
    static int Main(string[] args)
    {
        string? cuphead = null, outDir = null;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--cuphead" && i + 1 < args.Length) cuphead = args[++i];
            else if (args[i] == "--out" && i + 1 < args.Length) outDir = args[++i];
        }
        if (string.IsNullOrEmpty(cuphead) || string.IsNullOrEmpty(outDir))
        {
            Console.Error.WriteLine("Usage: CupPrepare --cuphead <dir> --out <dir>");
            return 2;
        }

        var cup = new DirectoryInfo(cuphead);
        if (!cup.Exists)
        {
            Console.Error.WriteLine("Cuphead folder missing: " + cuphead);
            return 3;
        }
        var data = new DirectoryInfo(Path.Combine(cup.FullName, "Cuphead_Data"));
        if (!data.Exists)
        {
            Console.Error.WriteLine("Cuphead_Data missing under " + cuphead);
            return 3;
        }

        Directory.CreateDirectory(outDir);

        // Prefer Python + UnityPy extractor shipped next to us.
        string script = Path.Combine(AppContext.BaseDirectory, "prepare_cuphead.py");
        if (File.Exists(script) && TryPython(script, cup.FullName, outDir))
        {
            if (File.Exists(Path.Combine(outDir, "ready.json")))
                return 0;
        }

        // Fallback: copy real Cuphead atlas into the cache and write ready.json (no look-alike art).
        string? atlas = FindAtlas(cup.FullName);
        string rawDir = Path.Combine(outDir, "raw");
        Directory.CreateDirectory(rawDir);
        if (atlas != null)
        {
            string dest = Path.Combine(rawDir, "atlas_player");
            File.Copy(atlas, dest, true);
            Console.WriteLine("Copied " + atlas + " -> " + dest);
        }

        // Also keep a pointer file for sharedassets that Melty already staged.
        foreach (var rel in new[]
                 {
                     "Cuphead_Data/sharedassets8.assets",
                     "Cuphead_Data/sharedassets8.resource",
                     "UnityPlayer.dll"
                 })
        {
            string src = Path.Combine(cup.FullName, rel.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(src))
            {
                string d = Path.Combine(rawDir, Path.GetFileName(src));
                File.Copy(src, d, true);
            }
        }

        var characters = new Dictionary<string, object>();
        foreach (var id in new[] { "cuphead", "mugman", "chalice" })
        {
            characters[id] = new Dictionary<string, object>
            {
                ["portrait"] = atlas != null ? "raw/atlas_player" : "",
                ["frames"] = new List<string>(),
                ["source"] = "cuphead-install"
            };
        }
        var ready = new Dictionary<string, object?>
        {
            ["version"] = 1,
            ["characters"] = characters,
            ["atlas"] = atlas,
            ["note"] = "Real Cuphead files staged. PNG frames appear when UnityPy prepare runs."
        };
        File.WriteAllText(Path.Combine(outDir, "ready.json"),
            JsonSerializer.Serialize(ready, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine("Wrote ready.json");
        return 0;
    }

    static string? FindAtlas(string cuphead)
    {
        string[] candidates =
        {
            Path.Combine(cuphead, "Cuphead_Data", "StreamingAssets", "AssetBundles", "atlas_player"),
            Path.Combine(cuphead, "Cuphead_Data", "StreamingAssets", "AssetBundles", "Atlas_Player"),
        };
        foreach (var c in candidates)
            if (File.Exists(c)) return c;
        string root = Path.Combine(cuphead, "Cuphead_Data", "StreamingAssets");
        if (!Directory.Exists(root)) return null;
        foreach (var f in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
            if (Path.GetFileName(f).Contains("atlas_player", StringComparison.OrdinalIgnoreCase))
                return f;
        return null;
    }

    static bool TryPython(string script, string cuphead, string outDir)
    {
        foreach (var py in new[] { "python3", "python", "py" })
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = py,
                    ArgumentList = { script, "--cuphead", cuphead, "--out", outDir },
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                };
                using var p = Process.Start(psi);
                if (p == null) continue;
                p.WaitForExit(120_000);
                Console.WriteLine(p.StandardOutput.ReadToEnd());
                var err = p.StandardError.ReadToEnd();
                if (!string.IsNullOrWhiteSpace(err)) Console.Error.WriteLine(err);
                if (p.ExitCode == 0) return true;
            }
            catch { /* try next */ }
        }
        return false;
    }
}
