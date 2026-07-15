# Quizmaster Pro

A React/Vite MVP for running pub quiz nights from a private quizmaster console with a separate team phone view.

## Features

- Private host console with demo login
- Persistent quiz library with draft, scheduled, live, and completed states
- Round and question builder
- Picture, music, numerical, multi-part, nearest-wins, and standard question support
- CSV question preview/import with validation warnings
- Question bank with reuse warnings
- Live quiz control for registration, reveal, lock, scoring, and next-question flow
- Team join route with editable answers until the host locks submissions
- Automatic and manual marking
- Leaderboard and completed quiz archive

## Run Locally

```bash
npm install
npm run dev
```

Open the host route and unlock it with the demo password:

```text
http://127.0.0.1:5173/#/host
Password: demo
```

Teams join with:

```text
http://127.0.0.1:5173/#/join/CAA824
```

## Build

```bash
npm run build
```
