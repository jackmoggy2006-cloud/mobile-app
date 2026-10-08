#!/usr/bin/env python3
"""Extract Cuphead player portraits/frames into a Melty cache.

Usage:
  python prepare_cuphead.py --cuphead <Cuphead folder> --out <cache dir>

Writes ready.json + PNG files. Safe to re-run.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path


CHAR_ALIASES = {
    "cuphead": ["cuphead", "player_cuphead", "Cuphead"],
    "mugman": ["mugman", "player_mugman", "Mugman"],
    "chalice": ["chalice", "mschalice", "ms_chalice", "player_chalice", "Chalice"],
}


def find_atlas(cuphead: Path) -> Path | None:
    candidates = [
        cuphead / "Cuphead_Data" / "StreamingAssets" / "AssetBundles" / "atlas_player",
        cuphead / "Cuphead_Data" / "StreamingAssets" / "AssetBundles" / "Atlas_Player",
    ]
    for c in candidates:
        if c.exists():
            return c
    # search shallow
    root = cuphead / "Cuphead_Data" / "StreamingAssets"
    if root.is_dir():
        for p in root.rglob("*"):
            if p.is_file() and "atlas_player" in p.name.lower():
                return p
    return None


def extract_with_unitypy(atlas: Path, out: Path) -> dict:
    try:
        import UnityPy
    except ImportError:
        print("UnityPy not installed; pip install UnityPy", file=sys.stderr)
        raise

    env = UnityPy.load(str(atlas))
    characters: dict[str, dict] = {k: {"portrait": "", "frames": []} for k in CHAR_ALIASES}
    for obj in env.objects:
        if obj.type.name not in ("Texture2D", "Sprite"):
            continue
        try:
            data = obj.read()
        except Exception:
            continue
        name = getattr(data, "name", None) or getattr(data, "m_Name", "") or ""
        name_l = name.lower()
        dest_id = None
        for cid, aliases in CHAR_ALIASES.items():
            if any(a.lower() in name_l for a in aliases):
                dest_id = cid
                break
        if not dest_id:
            continue
        try:
            img = data.image
        except Exception:
            continue
        if img is None:
            continue
        rel = f"{dest_id}/{name.replace('/', '_')}.png"
        path = out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path)
        if not characters[dest_id]["portrait"] and ("portrait" in name_l or "idle" in name_l or len(characters[dest_id]["frames"]) == 0):
            characters[dest_id]["portrait"] = rel
        characters[dest_id]["frames"].append(rel)

    # Ensure portrait set
    for cid, art in characters.items():
        if not art["portrait"] and art["frames"]:
            art["portrait"] = art["frames"][0]
    return characters


def write_stub(out: Path, cuphead: Path, atlas: Path | None) -> dict:
    """When UnityPy cannot decode, still mark ready with provenance so the mod can message clearly."""
    characters = {}
    for cid in CHAR_ALIASES:
        folder = out / cid
        folder.mkdir(parents=True, exist_ok=True)
        note = folder / "SOURCE.txt"
        note.write_text(
            f"Cuphead folder: {cuphead}\nAtlas: {atlas}\n"
            "Frames will appear after UnityPy extraction succeeds.\n",
            encoding="utf-8",
        )
        characters[cid] = {"portrait": f"{cid}/SOURCE.txt", "frames": []}
    return characters


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cuphead", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    cuphead = Path(args.cuphead)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    if not (cuphead / "Cuphead_Data").is_dir() and not (cuphead / "UnityPlayer.dll").exists():
        print("Not a Cuphead folder: " + str(cuphead), file=sys.stderr)
        return 2

    atlas = find_atlas(cuphead)
    characters = None
    if atlas is not None:
        try:
            characters = extract_with_unitypy(atlas, out)
            print("Extracted via UnityPy from", atlas)
        except Exception as ex:
            print("UnityPy extract failed:", ex, file=sys.stderr)
    if not characters or not any(c.get("frames") for c in characters.values()):
        characters = write_stub(out, cuphead, atlas)
        print("Wrote stub cache (install UnityPy for full sprites)")

    ready = {"version": 1, "characters": characters, "atlas": str(atlas) if atlas else None}
    (out / "ready.json").write_text(json.dumps(ready, indent=2), encoding="utf-8")
    print("Wrote", out / "ready.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
