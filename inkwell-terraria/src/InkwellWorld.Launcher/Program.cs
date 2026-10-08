using System;
using System.IO;
using System.Linq;
using System.Reflection;

namespace InkwellWorld.Launcher
{
    /// <summary>
    /// InkwellWorld.exe sits next to Terraria.exe. Loads Terraria in-process, starts the mod, runs WindowsLaunch.Main.
    /// Melty settings write CacheDir into %LOCALAPPDATA%/InkwellWorld/settings.cfg.
    /// </summary>
    static class Program
    {
        const string TerrariaSteamAppId = "105600";

        [STAThread]
        static int Main(string[] args)
        {
            string here = AppDomain.CurrentDomain.BaseDirectory;
            Log.Open();
            Log.Write("InkwellWorld launcher " + typeof(Program).Assembly.GetName().Version + ", folder " + here);
            try
            {
                string cacheDir = null;
                var passThrough = new System.Collections.Generic.List<string>();
                for (int i = 0; i < args.Length; i++)
                {
                    if (args[i] == "--cuphead-cache" && i + 1 < args.Length)
                        cacheDir = args[++i];
                    else
                        passThrough.Add(args[i]);
                }
                cacheDir = cacheDir
                    ?? Environment.GetEnvironmentVariable("INKWELL_CUPHEAD_CACHE")
                    ?? ReadSetting("CacheDir");
                Log.Write("Cuphead cache: " + (cacheDir ?? "(not given)"));

                string terrariaExe = Path.Combine(here, "Terraria.exe");
                if (!File.Exists(terrariaExe))
                    throw new FileNotFoundException("Terraria.exe is not next to InkwellWorld.exe", terrariaExe);

                if (Environment.GetEnvironmentVariable("SteamAppId") == null)
                    Environment.SetEnvironmentVariable("SteamAppId", TerrariaSteamAppId);
                if (Environment.GetEnvironmentVariable("SteamGameId") == null)
                    Environment.SetEnvironmentVariable("SteamGameId", TerrariaSteamAppId);
                Environment.CurrentDirectory = here;

                Assembly terraria = Assembly.Load(new AssemblyName("Terraria"));
                AppDomain.CurrentDomain.AssemblyResolve += (s, e) => ResolveEmbedded(terraria, e.Name);
                Log.Write("Loaded " + terraria.FullName);

                StartMod(here, terraria, cacheDir);

                MethodInfo entry = terraria.GetType("Terraria.WindowsLaunch", true)
                    .GetMethod("Main", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
                if (entry == null)
                    throw new MissingMethodException("Terraria.WindowsLaunch", "Main");
                Log.Write("Starting Terraria");
                entry.Invoke(null, new object[] { passThrough.ToArray() });
                Log.Write("Terraria exited");
                return 0;
            }
            catch (Exception ex)
            {
                Exception show = ex is TargetInvocationException tie && tie.InnerException != null ? tie.InnerException : ex;
                Log.Write("FATAL " + show);
                return 1;
            }
            finally
            {
                Log.Close();
            }
        }

        static string ReadSetting(string key)
        {
            try
            {
                string path = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "InkwellWorld", "settings.cfg");
                if (!File.Exists(path)) return null;
                foreach (string line in File.ReadAllLines(path))
                {
                    int eq = line.IndexOf('=');
                    if (eq <= 0) continue;
                    if (string.Equals(line.Substring(0, eq).Trim(), key, StringComparison.OrdinalIgnoreCase))
                        return line.Substring(eq + 1).Trim();
                }
            }
            catch (Exception) { }
            return null;
        }

        static void StartMod(string here, Assembly terraria, string cacheDir)
        {
            string gameDll = Path.Combine(here, "InkwellWorld.Game.dll");
            if (!File.Exists(gameDll))
            {
                Log.Write("InkwellWorld.Game.dll missing: starting plain Terraria");
                return;
            }
            // Load Game from the same folder; it only needs Harmony + Core (no compile-time Terraria ref).
            Assembly mod = Assembly.LoadFrom(gameDll);
            MethodInfo start = mod.GetType("InkwellWorld.Game.Entry", true)
                .GetMethod("Start", BindingFlags.Static | BindingFlags.Public);
            start.Invoke(null, new object[] { terraria, cacheDir, (Action<string>)Log.Write });
        }

        static Assembly ResolveEmbedded(Assembly terraria, string fullName)
        {
            string name = new AssemblyName(fullName).Name;
            var loaded = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == name);
            if (loaded != null)
                return loaded;
            string resource = terraria.GetManifestResourceNames()
                .FirstOrDefault(r => r.EndsWith("." + name + ".dll", StringComparison.OrdinalIgnoreCase));
            if (resource == null)
                return null;
            using (var s = terraria.GetManifestResourceStream(resource))
            {
                var bytes = new byte[s.Length];
                int read = 0;
                while (read < bytes.Length)
                    read += s.Read(bytes, read, bytes.Length - read);
                Log.Write("Resolved " + name + " from Terraria.exe resource " + resource);
                return Assembly.Load(bytes);
            }
        }
    }

    static class Log
    {
        static StreamWriter _w;
        static readonly object Gate = new object();

        public static string Folder => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InkwellWorld", "logs");

        public static void Open()
        {
            try
            {
                Directory.CreateDirectory(Folder);
                string latest = Path.Combine(Folder, "latest.log");
                if (File.Exists(latest))
                    File.Copy(latest, Path.Combine(Folder, "previous.log"), true);
                _w = new StreamWriter(latest, false) { AutoFlush = true };
            }
            catch (Exception) { _w = null; }
        }

        public static void Write(string line)
        {
            lock (Gate)
            {
                string text = DateTime.Now.ToString("HH:mm:ss.fff") + " " + line;
                try { _w?.WriteLine(text); } catch (Exception) { }
                Console.WriteLine(text);
            }
        }

        public static void Close()
        {
            lock (Gate)
            {
                _w?.Dispose();
                _w = null;
            }
        }
    }
}
