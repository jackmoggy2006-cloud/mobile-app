#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.dotnet:${PATH}"

python3 tools/preflight.py --gate 1a
python3 tools/gen_cs.py --gate 1a

dotnet build "$ROOT/InkwellWorld.sln" -c Release

OUT="$ROOT/dist/package"
rm -rf "$OUT"
mkdir -p "$OUT/prepare"

# Launcher + Game (net48 x86) — copy build output
LAUNCH="$ROOT/src/InkwellWorld.Launcher/bin/Release/net48"
GAME="$ROOT/src/InkwellWorld.Game/bin/Release/net48"
cp -f "$LAUNCH/InkwellWorld.exe" "$OUT/"
cp -f "$LAUNCH/InkwellWorld.exe.config" "$OUT/" 2>/dev/null || true
cp -f "$LAUNCH/"*.dll "$OUT/" 2>/dev/null || true
cp -f "$GAME/InkwellWorld.Game.dll" "$OUT/"
cp -f "$GAME/0Harmony.dll" "$OUT/" 2>/dev/null || cp -f "$GAME/Harmony.dll" "$OUT/" 2>/dev/null || true
# Core is referenced by Game/Launcher — copy if not merged
cp -f "$ROOT/src/InkwellWorld.Core/bin/Release/netstandard2.0/InkwellWorld.Core.dll" "$OUT/"

# CupPrepare as self-contained win-x64 for Melty prepare on Windows PCs
dotnet publish "$ROOT/src/CupPrepare/CupPrepare.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "$OUT/prepare"
cp -f "$ROOT/src/CupPrepare/prepare_cuphead.py" "$OUT/prepare/"
cp -f "$ROOT/README.md" "$OUT/"

VER=0.1.0
ZIP="$ROOT/dist/inkwell-terraria-${VER}.zip"
rm -f "$ZIP"
( cd "$OUT" && zip -r "$ZIP" . )
echo "Packed $ZIP"
unzip -l "$ZIP" | head -40
