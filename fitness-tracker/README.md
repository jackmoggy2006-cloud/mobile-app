# FitTrack — Fitness Tracker

A modern fitness tracking web app built with React, TypeScript, and Vite. Log workouts, track body metrics, set goals, and visualize your progress — all stored locally in your browser.

## Features

- **Dashboard** — Weekly stats, activity chart, streak counter, and recent workouts
- **Log Workout** — Record strength, cardio, and other sessions with exercises, sets, reps, and weight
- **Workout History** — Browse, search, and filter past workouts
- **Body Metrics** — Track weight, body fat, and muscle mass with trend charts
- **Goals** — Set fitness targets with automatic progress tracking
- **Offline-first** — All data persists in `localStorage`; no account required

## Getting Started

```bash
cd fitness-tracker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command         | Description              |
|-----------------|--------------------------|
| `npm run dev`   | Start development server |
| `npm run build` | Production build         |
| `npm run preview` | Preview production build |
| `npm run lint`  | Run linter               |

## Tech Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for fast builds
- [Tailwind CSS 4](https://tailwindcss.com/) for styling
- [React Router](https://reactrouter.com/) for navigation
- [Recharts](https://recharts.org/) for data visualization
- [Lucide React](https://lucide.dev/) for icons
- [date-fns](https://date-fns.org/) for date utilities

## Project Structure

```
fitness-tracker/
├── src/
│   ├── components/   # UI pages and shared components
│   ├── context/      # React context for app state
│   ├── lib/          # Storage and stats utilities
│   └── types/        # TypeScript type definitions
└── public/           # Static assets
```
