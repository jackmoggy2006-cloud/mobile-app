using System;
using System.Reflection;
using HarmonyLib;
using InkwellWorld.Cuphead;
using InkwellWorld.Generated;

namespace InkwellWorld.Game
{
    /// <summary>
    /// On character create (menuMode ~2 create flow), offer Cuphead / Mugman / Ms. Chalice.
    /// Uses Terraria's existing create Player and tags the kit in KitStore when saved.
    /// </summary>
    static class CharacterCreate
    {
        // Terraria menuMode values (1.4.x): 1 title, 888 character select, 2 create character (varies by version).
        // We detect create by looking for Main.menuMode in a known create set and drawing buttons.
        static Assembly _terraria;
        static Type _main;
        static Type _player;
        static FieldInfo _menuMode;
        static FieldInfo _pendingPlayer;
        static int _hover;

        public static void Patch(Harmony harmony, Assembly terraria)
        {
            _terraria = terraria;
            _main = Reflect.Type(terraria, "Terraria.Main");
            _player = Reflect.Type(terraria, "Terraria.Player");
            _menuMode = AccessTools.Field(_main, "menuMode");
            // Common field names across 1.4: pendingCharacter / Player awaiting create — try several.
            _pendingPlayer = AccessTools.Field(_main, "PendingPlayer")
                ?? AccessTools.Field(_main, "loadPlayer")
                ?? AccessTools.Field(_player, "SavedPlayer");

            MethodInfo drawMenu = AccessTools.Method(_main, "DrawMenu");
            if (drawMenu == null)
                throw new MissingMethodException("Terraria.Main", "DrawMenu");
            harmony.Patch(drawMenu, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(DrawMenuPostfix)));

            MethodInfo savePlayer = AccessTools.Method(_player, "SavePlayer");
            if (savePlayer != null)
                harmony.Patch(savePlayer, postfix: new HarmonyMethod(typeof(CharacterCreate), nameof(SavePlayerPostfix)));

            Entry.Log("CharacterCreate patched");
        }

        static void DrawMenuPostfix(object __instance /* Main not needed */)
        {
            try
            {
                int mode = (int)_menuMode.GetValue(null);
                // Character creation modes observed on 1.4.5: 2 (create), 888→create transitions.
                // Also show on character select (1 / 888) as a clear entry: "New Cuphead character".
                bool createish = mode == 2 || mode == 1000 || mode == 888;
                if (!createish) return;

                var spriteBatch = Reflect.GetStatic(_main, "spriteBatch");
                var font = Reflect.GetStatic(_main, "fontMouseText") ?? Reflect.GetStatic(_main, "fontDeathText");
                if (spriteBatch == null || font == null) return;

                int sw = (int)Reflect.GetStatic(_main, "screenWidth");
                int x0 = Math.Max(40, sw / 2 - 220);
                int y0 = 120;
                DrawText(spriteBatch, font, "Inkwell World — pick a Cuphead fighter", x0, y0 - 28, 1f, 1f, 0.55f);

                if (Entry.Cache == null || !Entry.Cache.Ready)
                {
                    DrawText(spriteBatch, font, Entry.Cache?.Message ?? "Cuphead required", x0, y0, 1f, 0.4f, 0.4f);
                    return;
                }

                _hover = -1;
                var mouseX = (int)Reflect.GetStatic(_main, "mouseX");
                var mouseY = (int)Reflect.GetStatic(_main, "mouseY");
                bool click = (bool)(Reflect.GetStatic(_main, "mouseLeftRelease") ?? false)
                    && (bool)(Reflect.GetStatic(_main, "mouseLeft") ?? false);

                int i = 0;
                foreach (var ch in Characters.All)
                {
                    if (ch.Stage != "1a") continue;
                    int x = x0 + (i % 3) * 150;
                    int y = y0 + (i / 3) * 70;
                    bool over = mouseX >= x && mouseX < x + 140 && mouseY >= y && mouseY < y + 56;
                    if (over) _hover = i;
                    float g = over ? 1f : 0.75f;
                    DrawText(spriteBatch, font, "[" + ch.DisplayName + "]", x, y, g, g, over ? 0.2f : 0.9f);
                    DrawText(spriteBatch, font, "armed spawn", x, y + 22, 0.7f, 0.7f, 0.7f);
                    if (over && click)
                        ApplyKit(ch);
                    i++;
                }
            }
            catch (Exception ex)
            {
                Entry.Log("DrawMenu: " + ex.Message);
            }
        }

        static void ApplyKit(CharacterDef ch)
        {
            Entry.PendingCreateKit = ch.Id;
            Entry.BannerMessage = ch.DisplayName + " selected — finish naming & create. You spawn with Peashooter ready.";
            Entry.BannerFrames = 60 * 6;

            // Best-effort: tint the pending create player with fallback hair/skin from the sheet.
            object player = null;
            if (_pendingPlayer != null)
                player = _pendingPlayer.IsStatic ? _pendingPlayer.GetValue(null) : null;
            // Also try Main.LocalPlayer during create (some builds keep the draft there).
            if (player == null)
                player = Reflect.GetStatic(_main, "PendingPlayer") ?? Reflect.GetStatic(_main, "LocalPlayer");
            if (player != null)
            {
                try
                {
                    Reflect.SetField(player, "hair", ch.SkinHair);
                    Reflect.SetField(player, "skinVariant", ch.SkinVariant);
                    Reflect.SetField(player, "hairColor", MakeColor(20, 20, 20));
                    Reflect.SetField(player, "shirtColor", MakeColor(ch.Id == "mugman" ? 40 : 180, 40, 40));
                    Reflect.SetField(player, "pantsColor", MakeColor(30, 30, 120));
                    Reflect.SetField(player, "shoeColor", MakeColor(20, 20, 20));
                    string name = (string)Reflect.GetField(player, "name");
                    if (!string.IsNullOrEmpty(name))
                        KitStore.Set(name, ch.Id);
                }
                catch (Exception ex)
                {
                    Entry.Log("ApplyKit vanity: " + ex.Message);
                }
            }
            Entry.Log("Selected kit " + ch.Id);
        }

        static object MakeColor(int r, int g, int b)
        {
            // Microsoft.Xna.Framework.Color may be in Terraria's load context.
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
            // Terraria.Utils.DrawBorderString or spriteBatch.DrawString — try Utils first.
            Type utils = _terraria.GetType("Terraria.Utils");
            MethodInfo drawBorder = null;
            if (utils != null)
            {
                foreach (var m in utils.GetMethods(BindingFlags.Static | BindingFlags.Public))
                {
                    if (m.Name == "DrawBorderString" && m.GetParameters().Length >= 5)
                    {
                        drawBorder = m;
                        break;
                    }
                }
            }
            object color = MakeColor((int)(r * 255), (int)(g * 255), (int)(b * 255));
            object pos = MakeVector2(x, y);
            if (drawBorder != null && color != null && pos != null)
            {
                // DrawBorderString(SpriteBatch, string, Vector2, Color, float scale=1, float anchorx=0, float anchory=0, int maxChars=-1)
                var ps = drawBorder.GetParameters();
                object[] args = new object[ps.Length];
                args[0] = spriteBatch;
                args[1] = text;
                args[2] = pos;
                args[3] = color;
                for (int i = 4; i < ps.Length; i++)
                    args[i] = ps[i].HasDefaultValue ? ps[i].DefaultValue : (ps[i].ParameterType == typeof(float) ? 1f : 0);
                drawBorder.Invoke(null, args);
                return;
            }
            // Fallback: SpriteBatch.DrawString(SpriteFont, string, Vector2, Color)
            MethodInfo drawString = AccessTools.Method(spriteBatch.GetType(), "DrawString",
                new[] { font.GetType(), typeof(string), pos.GetType(), color.GetType() });
            drawString?.Invoke(spriteBatch, new[] { font, text, pos, color });
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
