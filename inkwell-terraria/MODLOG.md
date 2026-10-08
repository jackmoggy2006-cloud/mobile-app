# Inkwell Terraria — MODLOG

## Idea
Terraria host; on character create pick Cuphead / Mugman / Ms. Chalice from the player's Cuphead install; spawn with full starter kit (Peashooter, EX, parry, dash/roll, Chalice double-jump). Solo.

## Route
Same as Terranoita / Stickmin Fate: `InkwellWorld.exe` next to `Terraria.exe`, load Terraria in-process, Harmony patches, no tModLoader (Melty does not auto-install it). Cuphead via Melty `ownCopies` + `CupPrepare` (Silksong: Cuphead Edition pattern).

## Stages
- **1a**: create picks, kit store, combat/mobility, Cuphead cache required message, package + Melty recipe
- **1b**: Cuphead atlas drawn over the player (Texture2D from prepared PNGs)
- **2**: more weapons / charms from Cuphead

## Build machine notes
Cloud Linux agent: no Steam Terraria/Cuphead installed. Game.dll uses runtime reflection (no Terraria reference). In-game verification needs the creator's Windows Steam copies via Melty Play.

## Melty
- modId: `7d185668-fed0-4f0c-82cf-29286ea223dd`
- slug: `inkwell-terraria`
- Studio: https://melty.gg/studio/7d185668-fed0-4f0c-82cf-29286ea223dd
- Release 0.1.0–0.3.1: draft uploads; avatar extract was too loose (junk frames + Terraria body still drawn)
- Release **0.3.2**: named `cuphead_`/`mugman_`/`chalice_` sprites only; `atlas_chalice` + mugshots; DrawPlayer **prefix** hides Terraria body; `extracted.v6.ok` forces re-prepare. Cuphead must be **installed**, not running.
- Release **0.3.3**: black-screen fix — removed per-pixel ImageSharp Activator load + StatusLine↔EnsureLoaded recursion; lazy FromStream per kit; DrawPlayer only for local player.
- Release **0.3.4**: hook **LegacyPlayerRenderer.DrawPlayer** (1.4 actual draw path); Main.DrawPlayer alone never ran so avatars never appeared.
- Release **0.3.5**: lag fix — never load PNGs from Draw; cache failed loads; create-screen batch Begin removed; draw Cuphead in postfix + hide vanilla via shadow=1.
