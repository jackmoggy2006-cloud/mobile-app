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

LAUNCH="$ROOT/src/InkwellWorld.Launcher/bin/Release/net48"
GAME="$ROOT/src/InkwellWorld.Game/bin/Release/net48"
cp -f "$LAUNCH/InkwellWorld.exe" "$OUT/"
cp -f "$LAUNCH/InkwellWorld.exe.config" "$OUT/" 2>/dev/null || true
cp -f "$LAUNCH/"*.dll "$OUT/" 2>/dev/null || true
cp -f "$GAME/InkwellWorld.Game.dll" "$OUT/"
# Game deps (Harmony, ImageSharp, etc.)
cp -f "$GAME/"*.dll "$OUT/" 2>/dev/null || true
cp -f "$ROOT/src/InkwellWorld.Core/bin/Release/netstandard2.0/InkwellWorld.Core.dll" "$OUT/"
# Launcher deps already copied; avoid overwriting InkwellWorld.exe
ls "$OUT"/*.dll | wc -l

dotnet publish "$ROOT/src/CupPrepare/CupPrepare.csproj" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o "$OUT/prepare"
cp -f "$ROOT/src/CupPrepare/prepare_cuphead.py" "$OUT/prepare/"
cp -f "$ROOT/README.md" "$OUT/"

# Windows embeddable Python + UnityPy (reuse prior bundle when present)
chmod +x "$ROOT/scripts/bundle_python.sh"
if [ -f "$ROOT/dist/python-bundle/python.exe" ]; then
  mkdir -p "$OUT/prepare/python"
  cp -a "$ROOT/dist/python-bundle/." "$OUT/prepare/python/"
else
  "$ROOT/scripts/bundle_python.sh" "$ROOT/dist/python-bundle"
  mkdir -p "$OUT/prepare/python"
  cp -a "$ROOT/dist/python-bundle/." "$OUT/prepare/python/"
fi

VER=0.3.1
ZIP="$ROOT/dist/inkwell-terraria-${VER}.zip"
rm -f "$ZIP"
( cd "$OUT" && zip -r "$ZIP" . -x '*.pdb' )
echo "Packed $ZIP"
unzip -l "$ZIP" | head -50
du -h "$ZIP"
