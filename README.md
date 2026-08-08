# Clark Family Cabin — Huckleberry Bucket V12

A mobile-first rebuild with one shared gameplay screen for single-player and multiplayer.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000

## Multiplayer
Create a room, share the 4-character room code, and have everyone use the same hosted address.

## Visual architecture
All cards are standardized 5:7 assets. Single-player and multiplayer both use `game.html`, `game-ui.js`, and `styles.css`, so their gameplay presentation cannot drift apart.
