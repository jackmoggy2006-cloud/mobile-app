# Inkwell Terraria

Play **Terraria** as **Cuphead**, **Mugman**, or **Ms. Chalice** — picked on character create, with their Cuphead starter kit (Peashooter, EX, parry, dash/roll, Chalice double-jump). Sprites and kits come from **your own Cuphead install**; Melty starts your Terraria.

## What you need

- Terraria (Steam) **1.4.5+**
- Cuphead (Steam)
- [Melty](https://melty.gg) — press Play (one click)

## Controls (Cuphead kit)

| Action | Input |
| --- | --- |
| Peashooter | Mouse left |
| EX (full meter) | Mouse right |
| Parry | `X` or `Z` |
| Dash / Chalice roll | Left Shift |
| Chalice double-jump | Space (in air) |

## How it works

- **Terraria** is the host: `InkwellWorld.exe` loads your `Terraria.exe` in-process and Harmony-patches it (same idea as Terranoita / Stickmin Fate). No tModLoader.
- **Cuphead** is secondary: Melty finds your copy, `CupPrepare` stages the player atlas into a cache, and the mod reads that cache. Nothing from Cuphead is uploaded in the Melty package.

## Build (developers)

```bash
python tools/preflight.py --gate 1a
python tools/gen_cs.py --gate 1a
export PATH="$HOME/.dotnet:$PATH"
dotnet build InkwellWorld.sln -c Release
# Package:
./scripts/package.sh
```

`InkwellWorld.Game` does **not** need Terraria at compile time (runtime reflection). Launch testing needs Windows + Steam Terraria + Cuphead.

## License

Code: MIT. Cuphead and Terraria belong to their publishers — this mashup only reads the copies you already own.
