# Clark Family Cabin — Huckleberry Bucket Online V2

This version includes BOTH game modes from the home flow:

1. Open the cabin startup screen.
2. Tap **Pick Huckleberries**.
3. Choose **Single Player** or **Multiplayer**.

## Single Player
Runs entirely in the browser against Mara and Cole. No room or internet connection is required once the site is loaded.

## Multiplayer
Create a room, share its 4-character code/link, and play with 2–6 people. Multiplayer game state is authoritative on the Node/Socket.IO server.

## Run locally
```bash
npm install
npm start
```
Then visit `http://localhost:3000`.

## File layout
All HTML, JavaScript, CSS, SVG, and PNG assets are in the project root. There is no `public` folder.
