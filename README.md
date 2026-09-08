# Kindlewood

A cozy 2D idle game. Tap the grove for resin, buy helpers that gather while you're away, and watch the forest come alive.

## Run locally

```bash
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | Oxlint |
| `npm run test` | Economy unit tests |

## What's in the box

- Canvas grove with **visible workers** walking trees → vat collecting resin
- 6 hireable worker types, 8 grove buildings, 12 upgrades
- Milestone goals with lump-sum rewards
- Tap income (with lucky crits) + passive income + offline progress
- Autosave to `localStorage`

## Play on iPhone (Home Screen)

1. Merge to `main` and enable **GitHub Pages** (Settings → Pages → Source: **GitHub Actions**)
2. Open `https://jackmoggy2006-cloud.github.io/mobile-app/`
3. Safari → Share → Add to Home Screen

## Next ideas

- Prestige / rebirth layer
- More biome visuals as milestones unlock
- Sound and haptic feedback
- Achievements and daily goals
