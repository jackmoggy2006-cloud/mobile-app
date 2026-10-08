#!/usr/bin/env python3
"""Extract real Cuphead player Sprites into a Melty cache with animation clips.

Usage:
  python prepare_cuphead.py --cuphead <Cuphead folder or Melty own/cuphead> --out <cache dir>

Writes:
  ready.json
  <char>/portrait.png
  <char>/<anim>/000.png ...
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

# Character id -> name tokens that appear in Cuphead sprite asset names
CHAR_TOKENS = {
    "cuphead": [r"\bcuphead\b", r"\bcup_head\b", r"(^|_)ch_(?!alice)"],
    "mugman": [r"\bmugman\b", r"\bmm\b", r"(^|_)mm_"],
    "chalice": [r"\bchalice\b", r"\bmschalice\b", r"\bms_chalice\b", r"\bchalice_"],
}

# Animation bucket <- substrings in sprite name (first match wins)
ANIM_RULES = [
    ("dash", ["dash", "dodge", "roll", "slide"]),
    ("parry", ["parry", "slap"]),
    ("ex", ["ex_", "_ex", "super", "energy_beam"]),
    ("shoot", ["shoot", "fire", "attack", "peashooter", "weapon"]),
    ("duck", ["duck", "crouch"]),
    ("jump", ["jump", "air", "fall"]),
    ("run", ["run", "walk", "jog"]),
    ("hit", ["hit", "hurt", "damage"]),
    ("idle", ["idle", "stand", "neutral", "breath"]),
]


def find_sources(cuphead: Path) -> list[Path]:
    found: list[Path] = []
    candidates = [
        cuphead / "Cuphead_Data" / "StreamingAssets" / "AssetBundles" / "atlas_player",
        cuphead / "Cuphead_Data" / "sharedassets8.assets",
        cuphead / "raw" / "atlas_player",
        cuphead / "atlas_player",
        cuphead / "sharedassets8.assets",
    ]
    for c in candidates:
        if c.exists():
            found.append(c)
    # Melty ownCopies may flatten under cuphead/
    for p in cuphead.rglob("*"):
        if not p.is_file():
            continue
        name = p.name.lower()
        if name == "atlas_player" or name.startswith("atlas_player"):
            if p not in found:
                found.append(p)
        if name.startswith("sharedassets") and name.endswith(".assets"):
            if p not in found:
                found.append(p)
    return found


def classify_char(name: str) -> str | None:
    n = name.lower().replace("-", "_")
    # Prefer more specific first
    for cid, patterns in (
        ("chalice", CHAR_TOKENS["chalice"]),
        ("mugman", CHAR_TOKENS["mugman"]),
        ("cuphead", CHAR_TOKENS["cuphead"]),
    ):
        for pat in patterns:
            if re.search(pat, n, re.I):
                return cid
    return None


def classify_anim(name: str) -> str:
    n = name.lower()
    for anim, keys in ANIM_RULES:
        if any(k in n for k in keys):
            return anim
    return "idle"


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def extract(sources: list[Path], out: Path) -> dict:
    try:
        import UnityPy
    except ImportError:
        print("UnityPy missing", file=sys.stderr)
        raise

    # char -> anim -> list of (sort_name, PIL image)
    buckets: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    seen_names: set[str] = set()

    for src in sources:
        print("Loading", src)
        try:
            env = UnityPy.load(str(src))
        except Exception as ex:
            print("Skip", src, ex, file=sys.stderr)
            continue
        for obj in env.objects:
            if obj.type.name not in ("Sprite", "Texture2D"):
                continue
            try:
                data = obj.read()
            except Exception:
                continue
            name = getattr(data, "name", None) or getattr(data, "m_Name", "") or ""
            if not name or name in seen_names:
                continue
            cid = classify_char(name)
            if not cid:
                continue
            try:
                img = data.image
            except Exception:
                continue
            if img is None:
                continue
            # Prefer Sprite crops over full Texture2D sheets when both exist
            if obj.type.name == "Texture2D" and any(
                classify_char(n) == cid for n in seen_names
            ):
                # still allow unique texture names that look like frames
                if "atlas" in name.lower() or img.width > 512:
                    continue
            seen_names.add(name)
            anim = classify_anim(name)
            buckets[cid][anim].append((name, img))

    characters = {}
    for cid in ("cuphead", "mugman", "chalice"):
        anims = buckets.get(cid) or {}
        char_dir = out / cid
        char_dir.mkdir(parents=True, exist_ok=True)
        anim_out = {}
        all_frames = []
        portrait_rel = ""
        for anim, frames in anims.items():
            frames.sort(key=lambda t: natural_key(t[0]))
            adir = char_dir / anim
            adir.mkdir(parents=True, exist_ok=True)
            rels = []
            for i, (name, img) in enumerate(frames):
                # Normalize: RGBA, reasonable size kept as-is (game scales)
                if img.mode != "RGBA":
                    img = img.convert("RGBA")
                rel = f"{cid}/{anim}/{i:03d}.png"
                img.save(out / rel)
                rels.append(rel)
                all_frames.append(rel)
            if rels:
                anim_out[anim] = rels
        # Portrait: prefer idle mid frame, else first of any
        if "idle" in anim_out and anim_out["idle"]:
            portrait_rel = anim_out["idle"][len(anim_out["idle"]) // 2]
        elif all_frames:
            portrait_rel = all_frames[0]
        if portrait_rel:
            # copy as portrait.png for stable path
            from shutil import copyfile

            copyfile(out / portrait_rel, char_dir / "portrait.png")
            portrait_rel = f"{cid}/portrait.png"
        characters[cid] = {
            "portrait": portrait_rel,
            "frames": all_frames,
            "animations": anim_out,
            "frameCount": len(all_frames),
        }
        print(f"{cid}: {len(all_frames)} frames, anims={list(anim_out.keys())}")
    return characters


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cuphead", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    cuphead = Path(args.cuphead)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    sources = find_sources(cuphead)
    if not sources:
        print("No Cuphead atlas/sharedassets under " + str(cuphead), file=sys.stderr)
        return 2

    try:
        characters = extract(sources, out)
    except Exception as ex:
        print("Extract failed:", ex, file=sys.stderr)
        return 3

    if not any(c.get("frameCount", 0) > 0 for c in characters.values()):
        print("No player sprites classified — check atlas contents", file=sys.stderr)
        return 4

    ready = {
        "version": 2,
        "characters": characters,
        "sources": [str(s) for s in sources],
    }
    (out / "ready.json").write_text(json.dumps(ready, indent=2), encoding="utf-8")
    print("Wrote", out / "ready.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
