"""Preflight: lay every sheet over each other and list what is not done."""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, "design", "sheets")
STAGE_ORDER = ["1a", "1b", "2"]


def load_sheets():
    sheets = {}
    for name in sorted(os.listdir(SHEETS)):
        if name.endswith(".json"):
            with open(os.path.join(SHEETS, name), encoding="utf-8") as f:
                s = json.load(f)
            sheets[s["sheet"]] = s
    return sheets


def filled(v):
    return v is not None and v != ""


def type_ok(t, v):
    if t in ("string", "enum", "ref"):
        return isinstance(v, str)
    if t == "number":
        return isinstance(v, (int, float)) and not isinstance(v, bool)
    if t == "int":
        return isinstance(v, int) and not isinstance(v, bool)
    if t == "bool":
        return isinstance(v, bool)
    if t.endswith("[]"):
        return isinstance(v, list) and all(type_ok(t[:-2], x) for x in v)
    return True


def stage_at_most(row_stage, gate):
    if row_stage not in STAGE_ORDER or gate not in STAGE_ORDER:
        return True
    return STAGE_ORDER.index(row_stage) <= STAGE_ORDER.index(gate)


def check(sheets):
    keys = {n: {r[s["key"]] for r in s["rows"]} for n, s in sheets.items()}
    problems = []
    for n, s in sheets.items():
        cols = s["columns"]
        for r in s["rows"]:
            rid = r.get(s["key"], "?")
            unv = r.get("_unverified", {})
            for c, spec in cols.items():
                v = r.get(c)
                if not filled(v):
                    problems.append((n, rid, c, "UNFILLED", spec.get("desc", ""), r.get("stage", "1a")))
                    continue
                if not type_ok(spec["type"], v):
                    problems.append((n, rid, c, "BADTYPE", "expected %s, got %r" % (spec["type"], v), r.get("stage", "1a")))
                    continue
                if spec["type"] == "enum" and v not in spec["values"]:
                    problems.append((n, rid, c, "BADENUM", "%r not in %s" % (v, spec["values"]), r.get("stage", "1a")))
                if spec["type"] in ("ref", "ref[]"):
                    target = spec["ref"]
                    if target not in sheets:
                        problems.append((n, rid, c, "BADREF", "sheet %r missing" % target, r.get("stage", "1a")))
                        continue
                    for x in (v if isinstance(v, list) else [v]):
                        if x in spec.get("allow", []):
                            continue
                        if x not in keys[target]:
                            problems.append((n, rid, c, "BADREF", "%r not in %s" % (x, target), r.get("stage", "1a")))
                if c in unv:
                    problems.append((n, rid, c, "UNVERIFIED", unv[c], r.get("stage", "1a")))
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate", default=None)
    ap.add_argument("-q", action="store_true")
    args = ap.parse_args()
    sheets = load_sheets()
    problems = check(sheets)
    if args.gate:
        problems = [p for p in problems if stage_at_most(p[5], args.gate)]
    if not args.q:
        for sheet, rid, col, kind, detail, stage in problems:
            print("%s\t%s\t%s\t%s\t%s\t%s" % (kind, stage, sheet, rid, col, detail))
    print("sheets=%d problems=%d gate=%s" % (len(sheets), len(problems), args.gate or "all"))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
