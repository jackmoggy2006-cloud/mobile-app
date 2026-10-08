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
- Release 0.1.0: draft, one_click yes, awaiting screenshot + Play-to-publish on creator PC
