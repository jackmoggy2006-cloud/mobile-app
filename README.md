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

- Canvas grove that grows with your progress
- Tap income + passive generators (saplings, fireflies, kilns, groveheart)
- Upgrades that multiply production and offline gains
- Autosave to `localStorage`, including offline progress on return

## Play on iPhone (Home Screen)

The game is a website. Publish it with GitHub Pages, then add it to your Home Screen.

### 1. Turn on Pages (one-time)

1. Open **[Settings → Pages](https://github.com/jackmoggy2006-cloud/mobile-app/settings/pages)**
2. Under **Build and deployment → Source**, choose **GitHub Actions**  
   (There is no separate “Deploy” button on this page — deploy happens in Actions.)

### 2. Run the deploy workflow

1. Open **[Actions → Deploy](https://github.com/jackmoggy2006-cloud/mobile-app/actions/workflows/deploy-pages.yml)**
2. Click **Run workflow** (right side) → **Run workflow**
3. Wait until the run is green

Or push any commit to `main` — that also triggers deploy.

### 3. Open on iPhone

1. In **Safari**, open: https://jackmoggy2006-cloud.github.io/mobile-app/
2. Tap **Share → Add to Home Screen → Add**

## Next ideas

- Prestige / rebirth layer
- More biome visuals as milestones unlock
- Sound and haptic feedback
- Achievements and daily goals
