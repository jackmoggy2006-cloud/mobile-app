# Cove

Spreadsheet-style debt planner. Enter income, monthly bills, and debts — Cove covers every minimum, aims leftover cash at the best payoff target, and shows what stays in your pocket.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## How it works

1. Enter take-home monthly income
2. List living bills (rent, groceries, etc.)
3. List debts with balance, APR, and minimum payment
4. Cove pays all minimums first so nothing falls behind
5. Extra money goes to the highest-interest debt (avalanche) or smallest balance (snowball)
6. Anything left after that is your monthly buffer

Data stays in your browser (`localStorage`).

## Use on iPhone (Home Screen)

1. Merge this app to `main` and turn on **GitHub Pages** for the repo:
   - Settings → Pages → Source: **GitHub Actions**
2. After the deploy workflow finishes, open:
   - `https://jackmoggy2006-cloud.github.io/mobile-app/`
3. In Safari: tap **Share** → **Add to Home Screen** → Add.

That installs Cove like an app icon. It still runs as a website (no App Store needed).
