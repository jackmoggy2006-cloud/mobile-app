#!/usr/bin/env python3
"""Extract real Cuphead / Mugman / Ms. Chalice Sprites into Melty cache.

Only named player sprites (cuphead_*, mugman_*, chalice_*) from atlas_player /
atlas_chalice / atlas_mugshots. Never dumps unclassified junk as the avatar.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

# Prefer run-and-gun level anims; skip plane / overworld / ghost for the main kit.
SKIP_SUBSTR = (
    "plane", "aero", "airplane", "overworld", "map_", "_map", "ghost",
    "death", "die_", "revive", "cheer", "win_", "lose", "trophy",
    "weapon_", "peashooter", "spread", "chaser", "lobber", "roundabout",
    "charge_", "crackshot", "converge", "twistup", "fx_", "_fx", "smoke",
    "bullet", "projectile", "spark", "flash", "impact",
)

ANIM_RULES = [
    ("dash", ["dash", "dodge", "roll", "slide"]),
    ("parry", ["parry", "slap"]),
    ("ex", ["_ex_", "ex_up", "ex_down", "ex_air", "super"]),
    ("shoot", ["shoot", "fire", "aim", "attack"]),
    ("duck", ["duck", "crouch"]),
    ("jump", ["jump", "air", "fall", "flop"]),
    ("run", ["run", "walk", "jog", "sprint"]),
    ("hit", ["hit", "hurt", "damage"]),
    ("idle", ["idle", "stand", "neutral", "breath"]),
]

CHAR_PREFIX = {
    "cuphead": re.compile(r"(^|[_/\s])cuphead([_/\s.]|$)|player_cuphead|cup_head", re.I),
    "mugman": re.compile(r"(^|[_/\s])mugman([_/\s.]|$)|player_mugman|mug_man|(^|[_/])mm_", re.I),
    "chalice": re.compile(
        r"(^|[_/\s])(chalice|mschalice|ms_chalice|legendary_chalice)([_/\s.]|$)|chs_|dlc_chalice",
        re.I,
    ),
}

MAX_FRAMES_PER_ANIM = 28
PLAYER_BUNDLES = ("atlas_player", "atlas_chalice", "atlas_mugshots", "atlas_player_replace")


def find_sources(cuphead: Path) -> list[Path]:
    found: list[Path] = []
    bundles = cuphead / "Cuphead_Data" / "StreamingAssets" / "AssetBundles"
    for name in PLAYER_BUNDLES:
        for base in (bundles, cuphead / "raw", cuphead, cuphead / "AssetBundles"):
            p = base / name
            if p.is_file() and p not in found:
                found.append(p)
    # Also accept Melty flat copies: own/cuphead/atlas_player
    if cuphead.is_dir():
        for p in cuphead.rglob("*"):
            if not p.is_file():
                continue
            n = p.name.lower()
            if any(n == b or n.startswith(b + ".") for b in PLAYER_BUNDLES):
                if p not in found:
                    found.append(p)
    return found


def classify_char(name: str, path: str, src: Path) -> str | None:
    blob = (path + " " + name).lower().replace("-", "_").replace("\\", "/")
    src_l = str(src).lower()

    # Bundle-level defaults (still require a sensible name later)
    if "atlas_chalice" in src_l and "plane" not in src_l:
        if CHAR_PREFIX["chalice"].search(blob) or "chalice" in blob or not any(
            CHAR_PREFIX[c].search(blob) for c in ("cuphead", "mugman")
        ):
            return "chalice"
    if "atlas_mugshots" in src_l:
        for cid, rx in CHAR_PREFIX.items():
            if rx.search(blob):
                return cid
        return None

    for cid, rx in CHAR_PREFIX.items():
        if rx.search(blob):
            return cid
    return None


def should_skip(name: str, path: str) -> bool:
    blob = (path + " " + name).lower()
    return any(s in blob for s in SKIP_SUBSTR)


def classify_anim(name: str, path: str) -> str:
    blob = (path + " " + name).lower()
    if "mugshot" in blob or "portrait" in blob or "icon" in blob:
        return "portrait"
    for anim, keys in ANIM_RULES:
        if any(k in blob for k in keys):
            return anim
    return "idle"


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def usable_image(img) -> bool:
    if img is None:
        return False
    try:
        w, h = img.size
    except Exception:
        return False
    if w < 8 or h < 8 or w > 900 or h > 900:
        return False
    # Reject near-empty / fully transparent frames
    try:
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        # Sample alpha
        extrema = img.getextrema()
        if extrema and len(extrema) >= 4:
            a_min, a_max = extrema[3]
            if a_max < 8:
                return False
    except Exception:
        pass
    return True


def extract(sources: list[Path], out: Path) -> dict:
    import UnityPy

    buckets: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    dump_lines: list[str] = []
    seen: set[str] = set()
    stats = {"sprites": 0, "ok": 0, "skip": 0, "unclass": 0, "badimg": 0}

    for src in sources:
        print("Loading", src)
        try:
            env = UnityPy.load(str(src))
        except Exception as ex:
            print("Skip", src, ex, file=sys.stderr)
            continue

        containers = []
        try:
            containers = list(getattr(env, "container", {}).items())
        except Exception:
            containers = []

        def handle(obj, path_hint: str, name_hint: str = ""):
            # Prefer Sprite crops — full Texture2D sheets are useless for avatars
            if obj.type.name != "Sprite":
                return
            stats["sprites"] += 1
            try:
                data = obj.read()
            except Exception:
                return
            name = name_hint or getattr(data, "name", None) or getattr(data, "m_Name", "") or ""
            key = f"{path_hint}|{name}|{getattr(obj, 'path_id', '')}"
            if not name or key in seen:
                return
            if should_skip(name, path_hint):
                stats["skip"] += 1
                dump_lines.append(f"SKIP\t{path_hint}\t{name}")
                return
            cid = classify_char(name, path_hint, src)
            if cid is None:
                stats["unclass"] += 1
                dump_lines.append(f"UNCLASS\t{path_hint}\t{name}")
                return
            try:
                img = data.image
            except Exception:
                stats["badimg"] += 1
                return
            if not usable_image(img):
                stats["badimg"] += 1
                dump_lines.append(f"BADIMG\t{cid}\t{path_hint}\t{name}")
                return
            seen.add(key)
            anim = classify_anim(name, path_hint)
            stats["ok"] += 1
            dump_lines.append(f"OK\t{cid}\t{anim}\t{path_hint}\t{name}")
            buckets[cid][anim].append((name, img))

        for path, obj in containers:
            handle(obj, str(path))
        for obj in env.objects:
            handle(obj, "")

    (out / "names_dump.txt").write_text("\n".join(dump_lines)[:2_000_000], encoding="utf-8")
    print("Wrote names_dump.txt lines=", len(dump_lines), "stats=", stats)

    characters = {}
    for cid in ("cuphead", "mugman", "chalice"):
        anims = buckets.get(cid) or {}
        char_dir = out / cid
        char_dir.mkdir(parents=True, exist_ok=True)
        anim_out = {}
        all_frames = []

        # Pull mugshot/portrait anim aside for portrait.png
        portrait_frames = anims.pop("portrait", [])

        for anim, frames in sorted(anims.items()):
            frames.sort(key=lambda t: natural_key(t[0]))
            # Prefer names that literally contain the anim token
            preferred = [f for f in frames if anim in f[0].lower()]
            use = preferred if preferred else frames
            use = use[:MAX_FRAMES_PER_ANIM]
            (char_dir / anim).mkdir(parents=True, exist_ok=True)
            rels = []
            for i, (name, img) in enumerate(use):
                if img.mode != "RGBA":
                    img = img.convert("RGBA")
                rel = f"{cid}/{anim}/{i:03d}.png"
                img.save(out / rel)
                rels.append(rel)
                all_frames.append(rel)
            if rels:
                anim_out[anim] = rels

        portrait_rel = ""
        if portrait_frames:
            portrait_frames.sort(key=lambda t: natural_key(t[0]))
            img = portrait_frames[len(portrait_frames) // 2][1]
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            img.save(char_dir / "portrait.png")
            portrait_rel = f"{cid}/portrait.png"
        elif "idle" in anim_out and anim_out["idle"]:
            from shutil import copyfile
            # Mid idle frame — avoid intro if we filtered; still pick middle
            src_rel = anim_out["idle"][len(anim_out["idle"]) // 2]
            copyfile(out / src_rel, char_dir / "portrait.png")
            portrait_rel = f"{cid}/portrait.png"
        elif all_frames:
            from shutil import copyfile
            copyfile(out / all_frames[0], char_dir / "portrait.png")
            portrait_rel = f"{cid}/portrait.png"

        characters[cid] = {
            "portrait": portrait_rel,
            "frames": all_frames,
            "animations": anim_out,
            "frameCount": len(all_frames),
        }
        print(f"{cid}: {len(all_frames)} frames, anims={list(anim_out.keys())}, portrait={bool(portrait_rel)}")

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
        print("No atlas_player / atlas_chalice under " + str(cuphead), file=sys.stderr)
        (out / "prepare_error.txt").write_text("no player atlases under " + str(cuphead), encoding="utf-8")
        return 2

    try:
        characters = extract(sources, out)
    except Exception as ex:
        print("Extract failed:", ex, file=sys.stderr)
        (out / "prepare_error.txt").write_text(repr(ex), encoding="utf-8")
        return 3

    # Need at least cuphead OR mugman with real frames (chalice needs DLC atlas)
    playable = sum(1 for c in ("cuphead", "mugman") if characters.get(c, {}).get("frameCount", 0) > 0)
    if playable == 0:
        print("No Cuphead/Mugman sprites extracted — see names_dump.txt", file=sys.stderr)
        (out / "prepare_error.txt").write_text("no cuphead/mugman frames", encoding="utf-8")
        return 4

    ready = {
        "version": 3,
        "characters": characters,
        "sources": [str(s) for s in sources],
    }
    (out / "ready.json").write_text(json.dumps(ready, indent=2), encoding="utf-8")
    print("Wrote", out / "ready.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
