using System;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;
using InkwellWorld.Generated;

namespace InkwellWorld.Game
{
    /// <summary>
    /// Terraria 1.4.5 uses FancyUI (menuMode 888) + UICharacterCreation for create.
    /// DrawMenu alone is easy to miss under that UI — we patch UICharacterCreation.Draw,
    /// draw a menu banner on select/create, and accept keys 1/2/3.
    /// </summary>
    static class CharacterCreate
    {
        static Assembly _terraria;
        static Type _main;
        static Type _player;
        static Type _uiCreate;
        static FieldInfo _menuMode;
        static FieldInfo _gameMenu;
        static FieldInfo _uiPlayer; // UICharacterCreation._player
        static int _lastLoggedMode = int.MinValue;
        static int _logCooldown;

        public static void Patch(Harmony harmony, Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            _player = Reflect.Type(terraria, "Terraria.Player");
            _menuMode = AccessTools.Field(_main, "menuMode");
            _gameMenu = AccessTools.Field(_main, "gameMenu");

            MethodInfo drawMenu = AccessTools.Method(_main, "DrawMenu");
            if (drawMenu == null)
                throw new MissingMethodException("Terraria.Main", "DrawMenu");
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
                {
                    harmony.Patch(uiDraw, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(UiCreateDrawPostfix)));
                    Entry.Log("CharacterCreate: patched UICharacterCreation.Draw");
                }
                else
                    Entry.Log("CharacterCreate: UICharacterCreation.Draw not found");
            }
            else
                Entry.Log("CharacterCreate: UICharacterCreation type missing");

            Type uiSelect = terraria.GetType("Terraria.GameContent.UI.States.UICharacterSelect");
            if (uiSelect != null)
            {
                MethodInfo selDraw = AccessTools.Method(uiSelect, "Draw");
                if (selDraw != null)
                {
                    harmony.Patch(selDraw, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(UiSelectDrawPostfix)));
                    Entry.Log("CharacterCreate: patched UICharacterSelect.Draw");
                }
            }

            MethodInfo savePlayer = AccessTools.Method(_player, "SavePlayer");
            if (savePlayer != null)
                harmony.Patch(savePlayer, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(SavePlayerPostfix)));

            Entry.BannerMessage = Entry.Cache != null && Entry.Cache.Ready
                ? "Inkwell World: on character create press 1=Cuphead  2=Mugman  3=Ms.Chalice"
                : (Entry.Cache?.Message ?? "Cuphead required");
            Entry.BannerFrames = 60 * 20;
            Entry.Log("CharacterCreate patched");
        }

        static bool InMenus()
        {
            try { return _gameMenu != null && (bool)_gameMenu.GetValue(null); }
            catch { return true; }
        }

        static bool OnCreateOrSelect(int mode)
        {
            // MenuID: CharacterSelect=1, CharacterCreation=2, CharacterName=3, FancyUI=888
            return mode == 1 || mode == 2 || mode == 3 || mode == 888 || mode == 1000;
        }

        static void UpdatePostfix()
        {
            try
            {
                if (!InMenus()) return;
                int mode = (int)_menuMode.GetValue(null);
                if (_logCooldown-- <= 0)
                {
                    _logCooldown = 60;
                    if (mode != _lastLoggedMode)
                    {
                        _lastLoggedMode = mode;
                        Entry.Log("menuMode=" + mode + " (1=select 2=create 888=fancy UI)");
                    }
                }

                if (!OnCreateOrSelect(mode) && mode != 0) return;
                if (Entry.Cache == null || !Entry.Cache.Ready) return;

                // Number keys work even when our text is under another panel.
                if (KeyJustPressed("D1") || KeyJustPressed("NumPad1"))
                    ApplyKit(Characters.Get("cuphead"), null);
                else if (KeyJustPressed("D2") || KeyJustPressed("NumPad2"))
                    ApplyKit(Characters.Get("mugman"), null);
                else if (KeyJustPressed("D3") || KeyJustPressed("NumPad3"))
                    ApplyKit(Characters.Get("chalice"), null);
            }
            catch (Exception ex)
            {
                Entry.Log("CreateUpdate: " + ex.Message);
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
                // Prefer Terraria's own edge detection when available
                bool down = (bool)AccessTools.Method(state.GetType(), "IsKeyDown").Invoke(state, new[] { key });
                if (!down) return false;
                // Use Main.keyState / oldKeyState if present for edge
                object old = Reflect.GetStatic(_main, "oldKeyState");
                if (old != null)
                {
                    bool was = (bool)AccessTools.Method(old.GetType(), "IsKeyDown").Invoke(old, new[] { key });
                    return !was;
                }
                return down; // fallback: held (ApplyKit is idempotent enough)
            }
            catch { return false; }
        }

        static void DrawMenuPostfix(object __instance)
        {
            try
            {
                int mode = (int)_menuMode.GetValue(null);
                if (!OnCreateOrSelect(mode) && mode != 0) return;
                DrawPickerOverlay(null, mode == 0);
            }
            catch (Exception ex)
            {
                Entry.Log("DrawMenu: " + ex.Message);
            }
        }

        static void UiCreateDrawPostfix(object __instance, object spriteBatch)
        {
            try
            {
                DrawPickerOverlay(__instance, false);
            }
            catch (Exception ex)
            {
                Entry.Log("UICreate.Draw: " + ex.Message);
            }
        }

        static void UiSelectDrawPostfix(object __instance, object spriteBatch)
        {
            try
            {
                DrawPickerOverlay(null, false);
            }
            catch (Exception ex)
            {
                Entry.Log("UISelect.Draw: " + ex.Message);
            }
        }

        static void DrawPickerOverlay(object uiCreateInstance, bool titleOnly)
        {
            object spriteBatch = Reflect.GetStatic(_main, "spriteBatch");
            object font = Reflect.GetStatic(_main, "fontMouseText") ?? Reflect.GetStatic(_main, "fontDeathText");
            if (spriteBatch == null || font == null) return;

            // Ensure SpriteBatch is in a drawable state: Terraria UI often ends it; begin if needed.
            TryBeginSpriteBatch(spriteBatch);

            int sw = (int)(Reflect.GetStatic(_main, "screenWidth") ?? 800);
            int sh = (int)(Reflect.GetStatic(_main, "screenHeight") ?? 600);
            int x0 = 24;
            int y0 = Math.Max(24, sh - 130);

            if (Entry.Cache == null || !Entry.Cache.Ready)
            {
                DrawText(spriteBatch, font, Entry.Cache?.Message ?? "Cuphead required", x0, y0, 1f, 0.35f, 0.35f);
                return;
            }

            if (titleOnly)
            {
                DrawText(spriteBatch, font, "Inkwell World loaded — Single Player → New to pick Cuphead / Mugman / Chalice (or press 1/2/3)", x0, 28, 1f, 0.95f, 0.45f);
                return;
            }

            CupheadSprites.EnsureLoaded();
            DrawText(spriteBatch, font, "INKWELL WORLD — click portrait or press 1 / 2 / 3", x0, y0 - 22, 1f, 0.95f, 0.4f);
            if (!string.IsNullOrEmpty(Entry.PendingCreateKit))
                DrawText(spriteBatch, font, "Selected: " + Entry.PendingCreateKit + " (finish Create)", x0, y0 - 44, 0.5f, 1f, 0.5f);

            int mouseX = (int)(Reflect.GetStatic(_main, "mouseX") ?? 0);
            int mouseY = (int)(Reflect.GetStatic(_main, "mouseY") ?? 0);
            bool click = (bool)(Reflect.GetStatic(_main, "mouseLeftRelease") ?? false);

            int i = 0;
            foreach (var ch in Characters.All)
            {
                if (ch.Stage != "1a") continue;
                int x = x0 + i * 170;
                int y = y0;
                bool over = mouseX >= x && mouseX < x + 160 && mouseY >= y && mouseY < y + 72;
                bool selected = string.Equals(Entry.PendingCreateKit, ch.Id, StringComparison.OrdinalIgnoreCase);
                object portrait = CupheadSprites.GetPortrait(ch.Id);
                if (portrait != null)
                    DrawPortrait(spriteBatch, portrait, x, y - 56, 48, 48);
                float r = selected ? 1f : (over ? 1f : 0.85f);
                float g = selected ? 0.9f : (over ? 0.95f : 0.75f);
                float b = selected ? 0.2f : (over ? 0.35f : 0.95f);
                DrawText(spriteBatch, font, (i + 1) + ") " + ch.DisplayName, x, y, r, g, b);
                DrawText(spriteBatch, font, "real Cuphead art", x, y + 20, 0.7f, 0.7f, 0.7f);
                if (over && click)
                    ApplyKit(ch, uiCreateInstance);
                i++;
            }
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
            catch (Exception ex)
            {
                Entry.Log("portrait: " + ex.Message);
            }
        }

        static void TryBeginSpriteBatch(object spriteBatch)
        {
            try
            {
                // If End was already called, Begin again for our overlay. Ignore if already started.
                var begin = AccessTools.Method(spriteBatch.GetType(), "Begin", Type.EmptyTypes);
                begin?.Invoke(spriteBatch, null);
            }
            catch { /* already begun or wrong overload */ }
        }

        static void ApplyKit(CharacterDef ch, object uiCreateInstance)
        {
            Entry.PendingCreateKit = ch.Id;
            Entry.BannerMessage = ch.DisplayName + " selected — name them and Create. Peashooter ready on spawn.";
            Entry.BannerFrames = 60 * 8;
            Entry.Log("Selected kit " + ch.Id);

            object player = null;
            if (uiCreateInstance != null && _uiPlayer != null)
                player = _uiPlayer.GetValue(uiCreateInstance);
            if (player == null)
                player = FindCreatePlayer();

            if (player != null)
            {
                try
                {
                    Reflect.SetField(player, "hair", ch.SkinHair);
                    Reflect.SetField(player, "skinVariant", ch.SkinVariant);
                    Reflect.SetField(player, "hairColor", MakeColor(20, 20, 20));
                    Reflect.SetField(player, "shirtColor", MakeColor(ch.Id == "mugman" ? 40 : 180, 40, 40));
                    Reflect.SetField(player, "underShirtColor", MakeColor(ch.Id == "chalice" ? 220 : 200, 40, 40));
                    Reflect.SetField(player, "pantsColor", MakeColor(30, 30, 120));
                    Reflect.SetField(player, "shoeColor", MakeColor(20, 20, 20));
                    if (ch.Id == "chalice")
                        Reflect.SetField(player, "Male", false);
                    else
                        Reflect.SetField(player, "Male", true);
                    string name = (string)Reflect.GetField(player, "name");
                    if (!string.IsNullOrEmpty(name))
                        KitStore.Set(name, ch.Id);
                }
                catch (Exception ex)
                {
                    Entry.Log("ApplyKit vanity: " + ex.Message);
                }
            }
        }

        static object FindCreatePlayer()
        {
            // Walk MenuUI current state for _player
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
            return Reflect.GetStatic(_main, "PendingPlayer");
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
                if (string.IsNullOrEmpty(Entry.PendingCreateKit)) return;
                string name = (string)Reflect.GetField(__instance, "name");
                if (string.IsNullOrEmpty(name)) return;
                KitStore.Set(name, Entry.PendingCreateKit);
                Entry.Log("Saved kit " + Entry.PendingCreateKit + " for player " + name);
            }
            catch (Exception ex)
            {
                Entry.Log("SavePlayer: " + ex.Message);
            }
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
                    args[0] = spriteBatch;
                    args[1] = text;
                    args[2] = pos;
                    args[3] = color;
                    for (int i = 4; i < ps.Length; i++)
                        args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType == typeof(float) ? 1f : 0);
                    try { m.Invoke(null, args); return; }
                    catch { /* try next overload */ }
                }
            }
            if (pos == null || color == null) return;
            try
            {
                MethodInfo drawString = AccessTools.Method(spriteBatch.GetType(), "DrawString",
                    new[] { font.GetType(), typeof(string), pos.GetType(), color.GetType() });
                drawString?.Invoke(spriteBatch, new[] { font, text, pos, color });
            }
            catch { }
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
