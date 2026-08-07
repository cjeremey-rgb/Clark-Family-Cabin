# Clark Family Cabin — Huckleberry Bucket Multiplayer

Online room-based multiplayer version of the Huckleberry Bucket game.

## What is included

- Approved Clark Family Cabin startup screen
- Rustic Huckleberry Bucket interface
- Actual individual card image assets (not generated placeholders)
- 2–6 human players per room
- 4-character room codes and shareable room links
- Host-controlled lobby, next hand, and replay
- Server-authoritative deck, turns, scoring, and card effects
- Reconnection using a browser-stored player key
- Five hands with cumulative trip scoring
- No `public` folder — all client files and image assets live beside `server.js`

## Current rules

- On your turn choose **Pick Another** or **Take a Break**.
- Drawing a card resolves it immediately, then play moves to the next active player.
- Numbered Huckleberry cards score their number.
- Unripe Berries score 0, Leaf is -1, Twig is -2.
- Two Bugs ruin the bucket and score 0 for that hand.
- Bug Spray cancels one Bug. The Bug and Bug Spray stay visible for 1 second, then both are discarded.
- Bucket Organizer removes a Twig first, otherwise a Leaf.
- Perfect Bush doubles the entire bucket. Multiple Perfect Bush cards stack.
- Evie removes a target player's highest-value numbered huckleberry card.
- Bucket Spill divides a target player's bucket by two.
- If the card drawer is the only active picker, Evie or Bucket Spill must target that player.
- Rain ends the hand immediately and triggers Bucket Inspection.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder run:

   ```bash
   npm install
   npm start
   ```

3. Open `http://localhost:3000`.
4. To test multiplayer on the same Wi-Fi network, other devices can open your computer's LAN IP on port 3000, provided the firewall allows it.

## Put it online

This project is ready for any Node host that supports WebSockets, such as Render, Railway, Fly.io, or a small VPS.

- Build command: `npm install`
- Start command: `npm start`
- Runtime port: reads `process.env.PORT` automatically
- WebSockets must be enabled by the host

Rooms currently live in server memory. Restarting the server clears active rooms. For a family game this is simple and fast; a later production version can move rooms/player accounts to Redis or a database if persistent rooms are desired.
