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
