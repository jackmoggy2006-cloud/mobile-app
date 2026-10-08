using System.Diagnostics;
using System.Text.Json;

namespace CupPrepare;

/// <summary>
/// Melty prepare step: extract real Cuphead player Sprites via bundled Python+UnityPy into cache/ready.json.
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

        Directory.CreateDirectory(outDir);
        string here = AppContext.BaseDirectory;
        string script = Path.Combine(here, "prepare_cuphead.py");
        if (!File.Exists(script))
        {
            Console.Error.WriteLine("prepare_cuphead.py missing next to CupPrepare.exe");
            return 4;
        }

        // Prefer bundled Windows embeddable Python (ships with UnityPy).
        string bundled = Path.Combine(here, "python", "python.exe");
        var pythons = new List<string>();
        if (File.Exists(bundled)) pythons.Add(bundled);
        pythons.AddRange(new[] { "python", "python3", "py" });

        foreach (var py in pythons)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = py,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                };
                psi.ArgumentList.Add(script);
                psi.ArgumentList.Add("--cuphead");
                psi.ArgumentList.Add(cup.FullName);
                psi.ArgumentList.Add("--out");
                psi.ArgumentList.Add(outDir);
                // Embeddable python: ensure local site-packages
                string site = Path.Combine(here, "python", "Lib", "site-packages");
                if (Directory.Exists(site))
                    psi.Environment["PYTHONPATH"] = site + (psi.Environment.ContainsKey("PYTHONPATH") && psi.Environment["PYTHONPATH"] is string cur && cur.Length > 0 ? Path.PathSeparator + cur : "");

                Console.WriteLine("Running " + py + " " + script);
                using var p = Process.Start(psi);
                if (p == null) continue;
                string stdout = p.StandardOutput.ReadToEnd();
                string stderr = p.StandardError.ReadToEnd();
                if (!p.WaitForExit(300_000))
                {
                    try { p.Kill(); } catch { }
                    Console.Error.WriteLine("Extractor timed out");
                    continue;
                }
                Console.WriteLine(stdout);
                if (!string.IsNullOrWhiteSpace(stderr)) Console.Error.WriteLine(stderr);
                if (p.ExitCode == 0 && File.Exists(Path.Combine(outDir, "ready.json")))
                {
                    // Marker Melty watches so an old stub ready.json does not skip re-extract.
                    File.WriteAllText(Path.Combine(outDir, "extracted.v3.ok"),
                        DateTime.UtcNow.ToString("o") + "\n");
                    // Keep legacy marker too
                    File.WriteAllText(Path.Combine(outDir, "extracted.ok"),
                        DateTime.UtcNow.ToString("o") + "\n");
                    Console.WriteLine("CupPrepare OK");
                    return 0;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(py + ": " + ex.Message);
            }
        }

        // Last-resort: stage raw atlas so the game can still message, but mark not fully extracted.
        Console.Error.WriteLine("Sprite extract failed — staging raw atlas only");
        string? atlas = FindAtlas(cup.FullName);
        string rawDir = Path.Combine(outDir, "raw");
        Directory.CreateDirectory(rawDir);
        if (atlas != null)
            File.Copy(atlas, Path.Combine(rawDir, "atlas_player"), true);

        var characters = new Dictionary<string, object>();
        foreach (var id in new[] { "cuphead", "mugman", "chalice" })
        {
            characters[id] = new Dictionary<string, object>
            {
                ["portrait"] = "",
                ["frames"] = new List<string>(),
                ["animations"] = new Dictionary<string, List<string>>(),
                ["frameCount"] = 0,
            };
        }
        var ready = new Dictionary<string, object?>
        {
            ["version"] = 2,
            ["characters"] = characters,
            ["error"] = "UnityPy extract did not produce frames. Reinstall mashup so prepare/python is present.",
        };
        File.WriteAllText(Path.Combine(outDir, "ready.json"),
            JsonSerializer.Serialize(ready, new JsonSerializerOptions { WriteIndented = true }));
        // Exit 0 so Melty continues, but the game will show a clear banner when frameCount==0.
        return 0;
    }

    static string? FindAtlas(string cuphead)
    {
        foreach (var c in new[]
                 {
                     Path.Combine(cuphead, "Cuphead_Data", "StreamingAssets", "AssetBundles", "atlas_player"),
                     Path.Combine(cuphead, "raw", "atlas_player"),
                     Path.Combine(cuphead, "atlas_player"),
                 })
            if (File.Exists(c)) return c;
        if (!Directory.Exists(cuphead)) return null;
        foreach (var f in Directory.EnumerateFiles(cuphead, "*", SearchOption.AllDirectories))
            if (Path.GetFileName(f).Equals("atlas_player", StringComparison.OrdinalIgnoreCase))
                return f;
        return null;
    }
}
