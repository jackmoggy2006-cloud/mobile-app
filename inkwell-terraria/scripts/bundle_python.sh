#!/usr/bin/env bash
# Download Windows embeddable CPython + Windows UnityPy wheels into prepare/python
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/dist/package/prepare/python}"
VER=3.11.9
ZIP="python-${VER}-embed-amd64.zip"
URL="https://www.python.org/ftp/python/${VER}/${ZIP}"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Fetching $URL"
curl -fsSL "$URL" -o "$TMP/$ZIP"
rm -rf "$DEST"
mkdir -p "$DEST"
unzip -q "$TMP/$ZIP" -d "$DEST"

# Enable site-packages
PTH=$(ls "$DEST"/python*._pth | head -1)
printf '%s\n' "python311.zip" "." "Lib\\site-packages" "import site" > "$PTH"

PIP_TARGET="$DEST/Lib/site-packages"
mkdir -p "$PIP_TARGET" "$TMP/wheels"
echo "Downloading Windows wheels (cp311 win_amd64)"
python3 -m pip download UnityPy Pillow -d "$TMP/wheels" \
  --platform win_amd64 --python-version 311 --only-binary=:all:
# Also grab any transitive deps pip resolved
for w in "$TMP/wheels"/*.whl; do
  echo "Unpack $(basename "$w")"
  unzip -qo "$w" -d "$PIP_TARGET"
done

# Sanity: UnityPy import path present
test -d "$PIP_TARGET/UnityPy" -o -d "$PIP_TARGET/unitypy" -o -n "$(ls "$PIP_TARGET" | rg -i unitypy || true)"
ls "$DEST" | head
echo "site-packages:" && ls "$PIP_TARGET" | head -20
echo "Bundled python at $DEST"
