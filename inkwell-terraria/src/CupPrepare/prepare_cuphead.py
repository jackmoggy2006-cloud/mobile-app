#!/usr/bin/env python3
"""Extract real Cuphead player Sprites into Melty cache with animation clips.

atlas_player is the player-only bundle: classify by path/name; leftovers → cuphead.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ANIM_RULES = [
    ("dash", ["dash", "dodge", "roll", "slide"]),
    ("parry", ["parry", "slap"]),
    ("ex", ["ex_", "_ex", "super", "energy"]),
    ("shoot", ["shoot", "fire", "attack", "peashooter", "weapon", "aim"]),
    ("duck", ["duck", "crouch"]),
    ("jump", ["jump", "air", "fall", "flop"]),
    ("run", ["run", "walk", "jog", "sprint"]),
    ("hit", ["hit", "hurt", "damage"]),
    ("idle", ["idle", "stand", "neutral", "breath", "intro"]),
]


def find_sources(cuphead: Path) -> list[Path]:
    found: list[Path] = []
    for c in [
        cuphead / "Cuphead_Data" / "StreamingAssets" / "AssetBundles" / "atlas_player",
        cuphead / "Cuphead_Data" / "sharedassets8.assets",
        cuphead / "raw" / "atlas_player",
        cuphead / "atlas_player",
        cuphead / "sharedassets8.assets",
    ]:
        if c.exists():
            found.append(c)
    if cuphead.is_dir():
        for p in cuphead.rglob("*"):
            if not p.is_file():
                continue
            n = p.name.lower()
            if n == "atlas_player" or n.startswith("atlas_player") or (
                n.startswith("sharedassets") and n.endswith(".assets")
            ):
                if p not in found:
                    found.append(p)
    return found


def classify_char(name: str, path: str = "") -> str | None:
    blob = (path + " " + name).lower().replace("-", "_").replace("\\", "/")
    # Order: most specific first
    if any(t in blob for t in ("chalice", "mschalice", "ms_chalice", "chs_", "/chalice", "dlc_chalice")):
        return "chalice"
    if any(t in blob for t in ("mugman", "/mm/", "_mm_", "mm_", "player_mm", "mug_man")):
        return "mugman"
    if any(t in blob for t in ("cuphead", "cup_head", "player_cuphead", "/ch/", "player/cup")):
        return "cuphead"
    return None


def classify_anim(name: str, path: str = "") -> str:
    blob = (path + " " + name).lower()
    for anim, keys in ANIM_RULES:
        if any(k in blob for k in keys):
            return anim
    return "idle"


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def extract(sources: list[Path], out: Path) -> dict:
    import UnityPy

    buckets: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    dump_lines: list[str] = []
    seen: set[str] = set()

    for src in sources:
        print("Loading", src)
        try:
            env = UnityPy.load(str(src))
        except Exception as ex:
            print("Skip", src, ex, file=sys.stderr)
            continue

        # Prefer container paths (often include cuphead/mugman folders)
        containers = []
        try:
            containers = list(getattr(env, "container", {}).items())
        except Exception:
            containers = []

        def handle(obj, path_hint: str, name_hint: str = ""):
            if obj.type.name not in ("Sprite", "Texture2D"):
                return
            try:
                data = obj.read()
            except Exception:
                return
            name = name_hint or getattr(data, "name", None) or getattr(data, "m_Name", "") or ""
            key = f"{path_hint}|{name}|{obj.type.name}|{getattr(obj, 'path_id', '')}"
            if not name or key in seen:
                return
            if obj.type.name == "Texture2D":
                # Skip giant atlas sheets; prefer Sprite crops
                try:
                    w = int(getattr(data, "m_Width", 0) or 0)
                    if w > 1024 or "atlas" in name.lower():
                        dump_lines.append(f"SKIP_TEX\t{path_hint}\t{name}\t{w}")
                        return
                except Exception:
                    pass
            try:
                img = data.image
            except Exception:
                return
            if img is None:
                return
            seen.add(key)
            cid = classify_char(name, path_hint)
            # atlas_player is player-only: unclassified → cuphead
            if cid is None and "atlas_player" in str(src).lower():
                cid = "cuphead"
            if cid is None:
                dump_lines.append(f"UNCLASS\t{path_hint}\t{name}")
                return
            anim = classify_anim(name, path_hint)
            dump_lines.append(f"OK\t{cid}\t{anim}\t{path_hint}\t{name}")
            buckets[cid][anim].append((name, img))

        for path, obj in containers:
            handle(obj, str(path))
        for obj in env.objects:
            handle(obj, "")

    (out / "names_dump.txt").write_text("\n".join(dump_lines)[:2_000_000], encoding="utf-8")
    print("Wrote names_dump.txt lines=", len(dump_lines))

    characters = {}
    for cid in ("cuphead", "mugman", "chalice"):
        anims = buckets.get(cid) or {}
        char_dir = out / cid
        char_dir.mkdir(parents=True, exist_ok=True)
        anim_out = {}
        all_frames = []
        for anim, frames in anims.items():
            frames.sort(key=lambda t: natural_key(t[0]))
            (char_dir / anim).mkdir(parents=True, exist_ok=True)
            rels = []
            for i, (name, img) in enumerate(frames):
                if img.mode != "RGBA":
                    img = img.convert("RGBA")
                rel = f"{cid}/{anim}/{i:03d}.png"
                img.save(out / rel)
                rels.append(rel)
                all_frames.append(rel)
            if rels:
                anim_out[anim] = rels
        portrait_rel = ""
        if "idle" in anim_out and anim_out["idle"]:
            portrait_rel = anim_out["idle"][len(anim_out["idle"]) // 2]
        elif all_frames:
            portrait_rel = all_frames[0]
        if portrait_rel:
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
    print("Sources:", [str(s) for s in sources])
    if not sources:
        print("No Cuphead atlas/sharedassets under " + str(cuphead), file=sys.stderr)
        (out / "prepare_error.txt").write_text("no sources under " + str(cuphead), encoding="utf-8")
        return 2

    try:
        characters = extract(sources, out)
    except Exception as ex:
        print("Extract failed:", ex, file=sys.stderr)
        (out / "prepare_error.txt").write_text(repr(ex), encoding="utf-8")
        return 3

    if not any(c.get("frameCount", 0) > 0 for c in characters.values()):
        print("No sprites extracted — see names_dump.txt", file=sys.stderr)
        return 4

    ready = {"version": 2, "characters": characters, "sources": [str(s) for s in sources]}
    (out / "ready.json").write_text(json.dumps(ready, indent=2), encoding="utf-8")
    print("Wrote", out / "ready.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
