using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace CupPrepare;

/// <summary>
/// Melty prepare: extract real Cuphead Sprites via bundled Python+UnityPy.
/// Prefers the full Steam Cuphead install (complete atlas) over Melty's partial copy.
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

        Directory.CreateDirectory(outDir);

        // Prefer full Steam install for complete sprites; fall back to Melty-staged folder.
        string extractFrom = FindSteamCuphead() ?? cuphead;
        if (!Directory.Exists(extractFrom))
        {
            Console.Error.WriteLine("Cuphead folder missing: " + extractFrom);
            return 3;
        }
        Console.WriteLine("Extracting from: " + extractFrom);
        File.WriteAllText(Path.Combine(outDir, "extract_source.txt"), extractFrom);

        string here = AppContext.BaseDirectory;
        string script = Path.Combine(here, "prepare_cuphead.py");
        if (!File.Exists(script))
        {
            Console.Error.WriteLine("prepare_cuphead.py missing next to CupPrepare.exe");
            return 4;
        }

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
                psi.ArgumentList.Add(extractFrom);
                psi.ArgumentList.Add("--out");
                psi.ArgumentList.Add(outDir);
                string site = Path.Combine(here, "python", "Lib", "site-packages");
                if (Directory.Exists(site))
                    psi.Environment["PYTHONPATH"] = site;

                Console.WriteLine("Running " + py);
                using var p = Process.Start(psi);
                if (p == null) continue;
                string stdout = p.StandardOutput.ReadToEnd();
                string stderr = p.StandardError.ReadToEnd();
                if (!p.WaitForExit(300_000))
                {
                    try { p.Kill(); } catch { }
                    continue;
                }
                Console.WriteLine(stdout);
                if (!string.IsNullOrWhiteSpace(stderr)) Console.Error.WriteLine(stderr);
                if (p.ExitCode == 0 && File.Exists(Path.Combine(outDir, "ready.json")))
                {
                    // v6 = named cuphead_/mugman_/chalice_ sprites only (+ atlas_chalice)
                    File.WriteAllText(Path.Combine(outDir, "extracted.v6.ok"), DateTime.UtcNow.ToString("o"));
                    File.WriteAllText(Path.Combine(outDir, "extracted.v5.ok"), DateTime.UtcNow.ToString("o"));
                    File.WriteAllText(Path.Combine(outDir, "extracted.v4.ok"), DateTime.UtcNow.ToString("o"));
                    File.WriteAllText(Path.Combine(outDir, "extracted.ok"), DateTime.UtcNow.ToString("o"));
                    Console.WriteLine("CupPrepare OK (v6 named player sprites)");
                    return 0;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(py + ": " + ex.Message);
            }
        }

        // Do NOT write a fake ready.json — Melty must retry prepare (no extracted.v6.ok).
        Console.Error.WriteLine("Sprite extract failed — Cuphead does not need to be running; Melty needs atlas_player on disk.");
        File.WriteAllText(Path.Combine(outDir, "prepare_error.txt"),
            "extract failed — install Cuphead on Steam (not running). Delete this cache folder and Play again.");
        return 1;
    }

    /// <summary>Locate Steam Cuphead (app 268910) via libraryfolders.vdf. Game does not need to be running.</summary>
    static string? FindSteamCuphead()
    {
        var roots = new List<string>();
        string? prog = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        if (!string.IsNullOrEmpty(prog))
            roots.Add(Path.Combine(prog, "Steam"));
        string? pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        if (!string.IsNullOrEmpty(pf))
            roots.Add(Path.Combine(pf, "Steam"));
        string? home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (!string.IsNullOrEmpty(home))
        {
            roots.Add(Path.Combine(home, "Steam"));
            roots.Add(Path.Combine(home, "AppData", "Local", "Steam"));
        }
        // Steam registry InstallPath (Windows)
        try
        {
            using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam")
                ?? Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Valve\Steam")
                ?? Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Valve\Steam");
            string? install = key?.GetValue("SteamPath") as string ?? key?.GetValue("InstallPath") as string;
            if (!string.IsNullOrEmpty(install) && !roots.Contains(install))
                roots.Insert(0, install.Replace('/', Path.DirectorySeparatorChar));
        }
        catch { /* non-Windows or no registry */ }

        string? best = null;
        long bestScore = -1;
        foreach (var steam in roots)
        {
            foreach (var cup in EnumerateCupheadLibraries(steam))
            {
                long score = ScoreCupheadInstall(cup);
                if (score > bestScore)
                {
                    bestScore = score;
                    best = cup;
                }
            }
        }
        if (best != null)
            Console.WriteLine("Found Steam Cuphead at " + best + " (score=" + bestScore + ")");
        return best;
    }

    static IEnumerable<string> EnumerateCupheadLibraries(string steam)
    {
        string vdf = Path.Combine(steam, "steamapps", "libraryfolders.vdf");
        if (File.Exists(vdf))
        {
            string text = File.ReadAllText(vdf);
            foreach (Match m in Regex.Matches(text, "\"path\"\\s+\"([^\"]+)\""))
            {
                string lib = m.Groups[1].Value.Replace("\\\\", "\\");
                string cup = Path.Combine(lib, "steamapps", "common", "Cuphead");
                if (Directory.Exists(Path.Combine(cup, "Cuphead_Data")))
                    yield return cup;
            }
        }
        string fallback = Path.Combine(steam, "steamapps", "common", "Cuphead");
        if (Directory.Exists(Path.Combine(fallback, "Cuphead_Data")))
            yield return fallback;
    }

    /// <summary>Prefer installs that include atlas_player + atlas_chalice.</summary>
    static long ScoreCupheadInstall(string cup)
    {
        string bundles = Path.Combine(cup, "Cuphead_Data", "StreamingAssets", "AssetBundles");
        long score = 0;
        foreach (var name in new[] { "atlas_player", "atlas_chalice", "atlas_mugshots" })
        {
            string p = Path.Combine(bundles, name);
            if (File.Exists(p))
            {
                try { score += new FileInfo(p).Length; } catch { score += 1; }
            }
        }
        return score;
    }
}
