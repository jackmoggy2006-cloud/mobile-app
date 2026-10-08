using System;
using System.IO;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;
using InkwellWorld.Generated;

namespace InkwellWorld.Game
{
    /// <summary>
    /// Keys 1/2/3 (or clicks) create real saved players named Cuphead / Mugman / Ms. Chalice
    /// with kits bound — does not rely on Terraria's random vanity roller.
    /// </summary>
    static class CharacterCreate
    {
        static Assembly _terraria;
        static Type _main;
        static Type _player;
        static Type _uiCreate;
        static FieldInfo _menuMode;
        static FieldInfo _gameMenu;
        static FieldInfo _uiPlayer;
        static int _lastLoggedMode = int.MinValue;
        static int _logCooldown;
        static int _createGuard; // debounce
        static bool _portraitsTried;

        public static void Patch(Harmony harmony, Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            _player = Reflect.Type(terraria, "Terraria.Player");
            _menuMode = AccessTools.Field(_main, "menuMode");
            _gameMenu = AccessTools.Field(_main, "gameMenu");

            MethodInfo drawMenu = AccessTools.Method(_main, "DrawMenu");
            harmony.Patch(drawMenu, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(DrawMenuPostfix)));

            MethodInfo doUpdate = AccessTools.Method(_main, "DoUpdate");
            if (doUpdate != null)
                harmony.Patch(doUpdate, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(UpdatePostfix)));

            _uiCreate = terraria.GetType("Terraria.GameContent.UI.States.UICharacterCreation");
            if (_uiCreate != null)
            {
                _uiPlayer = AccessTools.Field(_uiCreate, "_player")
                    ?? AccessTools.Field(_uiCreate, "player");
                MethodInfo uiDraw = AccessTools.Method(_uiCreate, "Draw");
                if (uiDraw != null)
                    harmony.Patch(uiDraw, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(UiCreateDrawPostfix)));
                Entry.Log("CharacterCreate: UICharacterCreation hooked");
            }

            Type uiSelect = terraria.GetType("Terraria.GameContent.UI.States.UICharacterSelect");
            if (uiSelect != null)
            {
                MethodInfo selDraw = AccessTools.Method(uiSelect, "Draw");
                if (selDraw != null)
                    harmony.Patch(selDraw, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(UiSelectDrawPostfix)));
                Entry.Log("CharacterCreate: UICharacterSelect hooked");
            }

            MethodInfo savePlayer = AccessTools.Method(_player, "SavePlayer");
            if (savePlayer != null)
                harmony.Patch(savePlayer, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(SavePlayerPostfix)));

            bool sprites = Entry.Cache != null && Entry.Cache.Ready;
            Entry.BannerMessage = sprites
                ? "Inkwell: enter a world → F1 Cuphead / F2 Mugman / F3 Chalice (real Cuphead art replaces Terraria body)"
                : (Entry.Cache?.Message ?? "Cuphead sprites not ready — delete Melty own/cuphead/cache and Play again (game need NOT be open)");
            Entry.BannerFrames = 60 * 25;
            Entry.Log("CharacterCreate patched; cacheReady=" + sprites);
        }

        static bool InMenus()
        {
            try { return _gameMenu != null && (bool)_gameMenu.GetValue(null); }
            catch { return true; }
        }

        static bool OnCreateOrSelect(int mode) =>
            mode == 0 || mode == 1 || mode == 2 || mode == 3 || mode == 888 || mode == 1000;

        static void UpdatePostfix()
        {
            try
            {
                if (!InMenus()) return;
                if (_createGuard > 0) _createGuard--;

                int mode = (int)_menuMode.GetValue(null);
                if (_logCooldown-- <= 0)
                {
                    _logCooldown = 90;
                    if (mode != _lastLoggedMode)
                    {
                        _lastLoggedMode = mode;
                        Entry.Log("menuMode=" + mode);
                    }
                }

                if (!OnCreateOrSelect(mode)) return;

                if (KeyJustPressed("D1") || KeyJustPressed("NumPad1") || KeyJustPressed("F1"))
                    QuickCreate(Characters.Get("cuphead"));
                else if (KeyJustPressed("D2") || KeyJustPressed("NumPad2") || KeyJustPressed("F2"))
                    QuickCreate(Characters.Get("mugman"));
                else if (KeyJustPressed("D3") || KeyJustPressed("NumPad3") || KeyJustPressed("F3"))
                    QuickCreate(Characters.Get("chalice"));
            }
            catch (Exception ex)
            {
                Entry.Log("CreateUpdate: " + ex);
            }
        }

        static bool KeyJustPressed(string keyName)
        {
            try
            {
                Type keyboard = Type.GetType("Microsoft.Xna.Framework.Input.Keyboard, Microsoft.Xna.Framework.Input")
                    ?? Type.GetType("Microsoft.Xna.Framework.Input.Keyboard, Microsoft.Xna.Framework");
                Type keys = Type.GetType("Microsoft.Xna.Framework.Input.Keys, Microsoft.Xna.Framework.Input")
                    ?? Type.GetType("Microsoft.Xna.Framework.Input.Keys, Microsoft.Xna.Framework");
                if (keyboard == null || keys == null) return false;
                object state = AccessTools.Method(keyboard, "GetState").Invoke(null, null);
                object key = Enum.Parse(keys, keyName);
                bool down = (bool)AccessTools.Method(state.GetType(), "IsKeyDown").Invoke(state, new[] { key });
                if (!down) return false;
                object old = Reflect.GetStatic(_main, "oldKeyState");
                if (old != null)
                    return !(bool)AccessTools.Method(old.GetType(), "IsKeyDown").Invoke(old, new[] { key });
                return true;
            }
            catch { return false; }
        }

        /// <summary>Create (or refresh) a .plr for this Cuphead kit and bind the kit store.</summary>
        static void QuickCreate(CharacterDef ch)
        {
            if (_createGuard > 0) return;
            _createGuard = 30;
            if (Entry.Cache == null || !Entry.Cache.Ready)
            {
                Entry.BannerMessage = Entry.Cache?.Message ?? "Cuphead not ready";
                Entry.BannerFrames = 60 * 8;
                Entry.Log("QuickCreate blocked: cache not ready");
                return;
            }

            try
            {
                object player = Activator.CreateInstance(_player);
                // Player() may need Setup or similar — call common init helpers if present
                MethodInfo reset = AccessTools.Method(_player, "ResetStats")
                    ?? AccessTools.Method(_player, "SetupDefault");
                reset?.Invoke(player, null);

                string name = ch.DisplayName; // "Cuphead", "Mugman", "Ms. Chalice"
                Reflect.SetField(player, "name", name);
                Reflect.SetField(player, "Male", ch.Id != "chalice");
                Reflect.SetField(player, "hair", ch.SkinHair);
                Reflect.SetField(player, "skinVariant", ch.SkinVariant);
                Reflect.SetField(player, "hairColor", MakeColor(15, 15, 15));
                Reflect.SetField(player, "eyeColor", MakeColor(20, 20, 20));
                Reflect.SetField(player, "skinColor", MakeColor(255, 230, 200));
                Reflect.SetField(player, "shirtColor", MakeColor(ch.Id == "mugman" ? 50 : 200, 40, 40));
                Reflect.SetField(player, "underShirtColor", MakeColor(220, 50, 50));
                Reflect.SetField(player, "pantsColor", MakeColor(40, 40, 140));
                Reflect.SetField(player, "shoeColor", MakeColor(20, 20, 20));

                string path = PlayerFilePath(name);
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                // Remove old file so SavePlayer overwrites cleanly
                if (File.Exists(path))
                {
                    try { File.Delete(path); } catch { }
                    string bak = path + ".bak";
                    if (File.Exists(bak)) try { File.Delete(bak); } catch { }
                }

                bool saved = TrySavePlayer(player, path);
                KitStore.Set(name, ch.Id);
                Entry.PendingCreateKit = ch.Id;

                // Also apply onto UI create draft if open
                object draft = FindCreatePlayer();
                if (draft != null)
                {
                    Reflect.SetField(draft, "name", name);
                    Reflect.SetField(draft, "Male", ch.Id != "chalice");
                    Reflect.SetField(draft, "hair", ch.SkinHair);
                    Reflect.SetField(draft, "skinVariant", ch.SkinVariant);
                }

                TryReloadPlayerList();
                Entry.BannerMessage = saved
                    ? ("Created " + name + " — pick them in Single Player. Peashooter + Cuphead art ready.")
                    : ("Kit " + name + " bound — finish Create and name them exactly \"" + name + "\".");
                Entry.BannerFrames = 60 * 12;
                Entry.Log("QuickCreate " + ch.Id + " path=" + path + " saved=" + saved);
            }
            catch (Exception ex)
            {
                Entry.Log("QuickCreate FATAL " + ex);
                Entry.BannerMessage = "Could not create " + ch.DisplayName + ": " + ex.GetBaseException().Message;
                Entry.BannerFrames = 60 * 10;
            }
        }

        static string PlayerFilePath(string name)
        {
            // Terraria.PlayerPath or Program.SavePath + /Players/
            string playersDir = null;
            try
            {
                playersDir = (string)Reflect.GetStatic(_main, "PlayerPath");
            }
            catch { }
            if (string.IsNullOrEmpty(playersDir))
            {
                string save = null;
                try
                {
                    Type program = _terraria.GetType("Terraria.Program");
                    save = (string)AccessTools.Field(program, "SavePath")?.GetValue(null);
                }
                catch { }
                if (string.IsNullOrEmpty(save))
                    save = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "My Games", "Terraria");
                playersDir = Path.Combine(save, "Players");
            }
            // Sanitize like Terraria
            foreach (char c in Path.GetInvalidFileNameChars())
                name = name.Replace(c, '_');
            return Path.Combine(playersDir, name + ".plr");
        }

        static bool TrySavePlayer(object player, string path)
        {
            // Overloads vary: SavePlayer(Player, string, bool) / (bool cloud) / static helpers
            foreach (var m in _player.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.NonPublic))
            {
                if (m.Name != "SavePlayer") continue;
                var ps = m.GetParameters();
                try
                {
                    if (ps.Length == 2 && ps[0].ParameterType == _player && ps[1].ParameterType == typeof(string))
                    {
                        m.Invoke(null, new[] { player, path });
                        return File.Exists(path);
                    }
                    if (ps.Length >= 3 && ps[0].ParameterType == _player && ps[1].ParameterType == typeof(string))
                    {
                        object[] args = new object[ps.Length];
                        args[0] = player;
                        args[1] = path;
                        for (int i = 2; i < ps.Length; i++)
                            args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue
                                : (ps[i].ParameterType == typeof(bool) ? (object)false : Activator.CreateInstance(ps[i].ParameterType));
                        m.Invoke(null, args);
                        return File.Exists(path);
                    }
                }
                catch (Exception ex)
                {
                    Entry.Log("SavePlayer overload failed: " + ex.GetBaseException().Message);
                }
            }
            // PlayerFileData API (1.4)
            Type pfd = _terraria.GetType("Terraria.IO.PlayerFileData");
            if (pfd != null)
            {
                try
                {
                    object data = Activator.CreateInstance(pfd, path, false);
                    AccessTools.Property(pfd, "Player")?.SetValue(data, player);
                    AccessTools.Method(pfd, "Save")?.Invoke(data, null);
                    AccessTools.Method(pfd, "CreateAndSave", new[] { _player })?.Invoke(null, new[] { player });
                    MethodInfo createAndSave = null;
                    foreach (var m in pfd.GetMethods(BindingFlags.Public | BindingFlags.Static))
                        if (m.Name == "CreateAndSave") createAndSave = m;
                    createAndSave?.Invoke(null, new[] { player });
                    if (File.Exists(path)) return true;
                }
                catch (Exception ex)
                {
                    Entry.Log("PlayerFileData: " + ex.GetBaseException().Message);
                }
            }
            return File.Exists(path);
        }

        static void TryReloadPlayerList()
        {
            try
            {
                MethodInfo load = AccessTools.Method(_main, "LoadPlayers")
                    ?? AccessTools.Method(_player, "LoadPlayers");
                load?.Invoke(null, null);
                // Fancy UI character select refresh
                object menuUi = Reflect.GetStatic(_main, "MenuUI");
                Type uiSelect = _terraria.GetType("Terraria.GameContent.UI.States.UICharacterSelect");
                if (menuUi != null && uiSelect != null)
                {
                    object state = Activator.CreateInstance(uiSelect);
                    AccessTools.Method(menuUi.GetType(), "SetState", new[] { state.GetType().BaseType ?? state.GetType() })
                        ?.Invoke(menuUi, new[] { state });
                    // Try SetState(UIState)
                    foreach (var m in menuUi.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance))
                    {
                        if (m.Name != "SetState" || m.GetParameters().Length != 1) continue;
                        try { m.Invoke(menuUi, new[] { state }); break; } catch { }
                    }
                }
            }
            catch (Exception ex)
            {
                Entry.Log("ReloadPlayers: " + ex.GetBaseException().Message);
            }
        }

        static void DrawMenuPostfix(object __instance)
        {
            try
            {
                int mode = (int)_menuMode.GetValue(null);
                if (!OnCreateOrSelect(mode)) return;
                DrawPickerOverlay(null, mode == 0);
            }
            catch (Exception ex) { Entry.Log("DrawMenu: " + ex.Message); }
        }

        static void UiCreateDrawPostfix(object __instance, object spriteBatch)
        {
            try { DrawPickerOverlay(__instance, false); }
            catch (Exception ex) { Entry.Log("UICreate.Draw: " + ex.Message); }
        }

        static void UiSelectDrawPostfix(object __instance, object spriteBatch)
        {
            try { DrawPickerOverlay(null, false); }
            catch (Exception ex) { Entry.Log("UISelect.Draw: " + ex.Message); }
        }

        static void DrawPickerOverlay(object uiCreateInstance, bool titleOnly)
        {
            object spriteBatch = Reflect.GetStatic(_main, "spriteBatch");
            object font = Reflect.GetStatic(_main, "fontMouseText") ?? Reflect.GetStatic(_main, "fontDeathText");
            if (spriteBatch == null || font == null) return;
            // Do NOT SpriteBatch.Begin here — breaks Terraria's UI batch and causes lag.

            int sh = (int)(Reflect.GetStatic(_main, "screenHeight") ?? 600);
            int x0 = 24;
            int y0 = Math.Max(24, sh - 150);

            if (Entry.Cache == null || !Entry.Cache.Ready)
            {
                DrawText(spriteBatch, font, Entry.Cache?.Message ?? "Cuphead required", x0, y0, 1f, 0.35f, 0.35f);
                return;
            }

            if (titleOnly)
            {
                DrawText(spriteBatch, font, "Inkwell World — Single Player, then press 1/2/3 to create Cuphead / Mugman / Chalice", x0, 28, 1f, 0.95f, 0.45f);
                return;
            }

            DrawText(spriteBatch, font, "CREATE CUPHEAD KIT — 1/2/3  |  " + CupheadSprites.StatusLine(), x0, y0 - 22, 1f, 0.95f, 0.4f);

            int mouseX = (int)(Reflect.GetStatic(_main, "mouseX") ?? 0);
            int mouseY = (int)(Reflect.GetStatic(_main, "mouseY") ?? 0);
            bool click = (bool)(Reflect.GetStatic(_main, "mouseLeftRelease") ?? false);

            // Portraits: load at most one kit attempt per overlay call (avoids create-screen lag).
            if (!_portraitsTried)
            {
                _portraitsTried = true;
                foreach (var ch in Characters.All)
                    if (ch.Stage == "1a") CupheadSprites.EnsureKit(ch.Id);
            }

            int i = 0;
            foreach (var ch in Characters.All)
            {
                if (ch.Stage != "1a") continue;
                int x = x0 + i * 180;
                int y = y0;
                bool over = mouseX >= x && mouseX < x + 170 && mouseY >= y - 56 && mouseY < y + 50;
                object portrait = CupheadSprites.HasKit(ch.Id) ? CupheadSprites.GetPortrait(ch.Id) : null;
                if (portrait != null)
                    DrawPortrait(spriteBatch, portrait, x, y - 56, 48, 48);
                float r = over ? 1f : 0.85f;
                float g = over ? 0.95f : 0.75f;
                float b = over ? 0.3f : 0.95f;
                DrawText(spriteBatch, font, (i + 1) + ") " + ch.DisplayName, x, y, r, g, b);
                DrawText(spriteBatch, font, "creates save file", x, y + 20, 0.65f, 0.65f, 0.65f);
                if (over && click)
                    QuickCreate(ch);
                i++;
            }
        }

        static void TryBeginSpriteBatch(object spriteBatch)
        {
            try { AccessTools.Method(spriteBatch.GetType(), "Begin", Type.EmptyTypes)?.Invoke(spriteBatch, null); }
            catch { }
        }

        static void DrawPortrait(object spriteBatch, object tex, int x, int y, int w, int h)
        {
            try
            {
                Type rectT = _terraria.GetType("Microsoft.Xna.Framework.Rectangle")
                    ?? Type.GetType("Microsoft.Xna.Framework.Rectangle, Microsoft.Xna.Framework");
                Type colorT = _terraria.GetType("Microsoft.Xna.Framework.Color")
                    ?? Type.GetType("Microsoft.Xna.Framework.Color, Microsoft.Xna.Framework");
                if (rectT == null || colorT == null) return;
                object dest = Activator.CreateInstance(rectT, x, y, w, h);
                object white = colorT.GetProperty("White")?.GetValue(null)
                    ?? Activator.CreateInstance(colorT, (byte)255, (byte)255, (byte)255, (byte)255);
                foreach (var m in spriteBatch.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (m.Name != "Draw") continue;
                    var ps = m.GetParameters();
                    if (ps.Length == 3 && ps[1].ParameterType == rectT)
                    {
                        m.Invoke(spriteBatch, new[] { tex, dest, white });
                        return;
                    }
                }
            }
            catch { }
        }

        static object FindCreatePlayer()
        {
            try
            {
                object menuUi = Reflect.GetStatic(_main, "MenuUI");
                if (menuUi != null)
                {
                    object state = Reflect.GetField(menuUi, "CurrentState")
                        ?? AccessTools.Property(menuUi.GetType(), "CurrentState")?.GetValue(menuUi);
                    if (state != null && _uiCreate != null && _uiCreate.IsInstanceOfType(state) && _uiPlayer != null)
                        return _uiPlayer.GetValue(state);
                }
            }
            catch { }
            return null;
        }

        static object MakeColor(int r, int g, int b)
        {
            Type color = _terraria.GetType("Microsoft.Xna.Framework.Color")
                ?? Type.GetType("Microsoft.Xna.Framework.Color, Microsoft.Xna.Framework");
            if (color == null) return null;
            return Activator.CreateInstance(color, (byte)r, (byte)g, (byte)b, (byte)255);
        }

        static void SavePlayerPostfix(object __instance)
        {
            try
            {
                string name = (string)Reflect.GetField(__instance, "name");
                if (string.IsNullOrEmpty(name)) return;
                // Bind by exact display names or pending kit
                foreach (var ch in Characters.All)
                {
                    if (string.Equals(name, ch.DisplayName, StringComparison.OrdinalIgnoreCase))
                    {
                        KitStore.Set(name, ch.Id);
                        Entry.Log("Saved kit " + ch.Id + " for " + name);
                        return;
                    }
                }
                if (!string.IsNullOrEmpty(Entry.PendingCreateKit))
                {
                    KitStore.Set(name, Entry.PendingCreateKit);
                    Entry.Log("Saved pending kit " + Entry.PendingCreateKit + " for " + name);
                }
            }
            catch (Exception ex) { Entry.Log("SavePlayer: " + ex.Message); }
        }

        static void DrawText(object spriteBatch, object font, string text, int x, int y, float r, float g, float b)
        {
            Type utils = _terraria.GetType("Terraria.Utils");
            object color = MakeColor((int)(r * 255), (int)(g * 255), (int)(b * 255));
            object pos = MakeVector2(x, y);
            if (utils != null && color != null && pos != null)
            {
                foreach (var m in utils.GetMethods(BindingFlags.Static | BindingFlags.Public))
                {
                    if (m.Name != "DrawBorderString") continue;
                    var ps = m.GetParameters();
                    if (ps.Length < 4) continue;
                    object[] args = new object[ps.Length];
                    args[0] = spriteBatch; args[1] = text; args[2] = pos; args[3] = color;
                    for (int i = 4; i < ps.Length; i++)
                        args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType == typeof(float) ? 1f : 0);
                    try { m.Invoke(null, args); return; } catch { }
                }
            }
        }

        static object MakeVector2(float x, float y)
        {
            Type v2 = _terraria.GetType("Microsoft.Xna.Framework.Vector2")
                ?? Type.GetType("Microsoft.Xna.Framework.Vector2, Microsoft.Xna.Framework");
            if (v2 == null) return null;
            return Activator.CreateInstance(v2, x, y);
        }
    }
}
