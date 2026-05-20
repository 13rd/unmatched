# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run development server (with auto-reload)
npm run dev

# Run production server
npm start

# Docker deployment
docker-compose up -d        # Start
docker-compose down         # Stop
docker-compose logs -f      # View logs
./deploy.sh                 # First-time VPS deploy (installs Docker if needed)

# Import a TTS character deck manually
python3 scripts/import_tts_character.py --zip archive.zip --project-dir .
```

App runs on `http://localhost:3000`. Entry point for players: `/auth.html`.

## Architecture

This is a real-time multiplayer board game built on Node.js + Socket.IO, with all frontend in plain HTML/CSS/JS (no build step, no framework).

### Page flow

`auth.html` → `setup.html` → `index.html` (game board)

- **auth.html / auth.js** — name input, generates `userId` stored in `localStorage`. Every other page redirects here if `userId` is absent.
- **setup.html / setup.js** — room creation/joining, character and map selection. Sends `create-room` or `join-room` socket events. Settings (including full character/deck data) are passed to the server and stored server-side in the `rooms` Map.
- **index.html / game.js** — the main game canvas. Receives full game state on `room-joined`/`room-created`, then syncs mutations via socket events.
- **editor.html / editor.js** — standalone map editor for placing click-points on a background image. Saves to `maps/saved_maps/*.json`.

### Server state model (`server.js`)

All authoritative game state lives in two in-memory Maps:

```
rooms: Map<roomCode, { settings, chips, cards, discardPiles, handVisibility, counters, players, playerRoles, currentTurn, createdAt }>
users: Map<userId, { socketId, username, roomCode }>
```

There is **no database**. State is lost on server restart. Rooms with no players are cleaned up after 30 minutes (checked every 10 minutes).

Reconnection works by matching `userId` (from `localStorage`) to `room.playerRoles[userId]` — the role is preserved as long as the server is running.

### Socket event naming convention

Events follow the pattern `noun-verb` (e.g. `chip-moved`, `card-discarded`, `deck-shuffled`). The server relays most events to the rest of the room via `socket.to(roomCode).emit(...)` and also updates its own state copy. Turn events use `io.to(roomCode).emit(...)` (broadcast to all including sender).

### Character / deck data format

Characters live in `heroes/characters/*.json`. The full character object (including the deck array) is stored in `room.settings.player1.character` / `room.settings.player2.character` on the server and sent to clients on join. Clients request deck data explicitly via `request-decks` → `decks-data`.

Legacy deck-only files are in `heroes/*.json` (e.g. `deck_dracula.json`).

Maps live in `maps/saved_maps/*.json`. The background image path and point coordinates are stored there.

### Import scripts (`scripts/`)

- `import_tts_character.py` — converts a Tabletop Simulator `.zip` export into the app's character JSON format. Called by `POST /api/import-tts`.
- `fetch_theunmatched.py` — fetches a character from the-unmatched.club by URL. Called by `POST /api/import-theunmatched`.

Both scripts print JSON to stdout; the server parses that output.

### File upload routing

`multer` routes uploaded files based on `fieldname`:
- `hero*` → `heroes/images/`
- `character*` → `heroes/characters/images/`
- `map*` → `maps/images/`
- `deck*` → `decks/images/`
- anything else → `uploads/`
