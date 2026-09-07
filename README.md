# hackathon-2026

A minimal, modern full-stack starter for Hackathon 2026: an **Idea Board** where you
can pitch ideas and upvote your favorites.

- **`server/`** — TypeScript + Express REST API (in-memory store)
- **`web/`** — Vite + React + TypeScript single-page app

The pieces are wired together with npm workspaces, so a single `npm install` at the
repo root sets everything up.

## Prerequisites

- Node.js 22+
- npm 10+

## Getting started

```bash
npm install      # install all workspace dependencies
npm run dev      # start API (:3001) and web app (:5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the API on
port 3001, so no extra configuration is needed.

## Common commands

| Command            | Description                                        |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Run the API and web app together (hot reload)      |
| `npm run build`    | Type-check/compile the server and build the web app |
| `npm run start`    | Run the compiled API from `server/dist`            |
| `npm run typecheck`| Type-check both workspaces                          |
| `npm test`         | Run the server test suite                          |

## API

| Method | Route                  | Description             |
| ------ | ---------------------- | ----------------------- |
| GET    | `/api/health`          | Health check            |
| GET    | `/api/ideas`           | List ideas (most votes first) |
| POST   | `/api/ideas`           | Create an idea (`{ title, description }`) |
| POST   | `/api/ideas/:id/vote`  | Upvote an idea          |

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent dev environment: it runs
`npm install` on setup and starts `npm run dev` in a persistent `dev` terminal,
exposing ports `5173` (web) and `3001` (API).
