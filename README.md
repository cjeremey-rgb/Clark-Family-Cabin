# Clark Family Cabin — Huckleberry Bucket

Mobile-first web game with matching Single Player and Online Multiplayer modes.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:3000` on a phone or desktop browser.

## Modes

- **Single Player** — you play the same game against two computer-controlled pickers.
- **Multiplayer** — 2–6 real players join a shared room with a 4-character room code.

Single Player and Multiplayer share the same card art, game layout, rules, animations, scoring, and special-card behavior. The only intended difference is who controls the other players.

## Core rules

- On your turn choose **Pick Another** or **Take a Break**.
- Drawn cards resolve immediately.
- Two Bugs ruin a bucket unless Bug Spray removes one.
- Perfect Bush doubles the whole bucket.
- Evie removes a chosen player's highest-value numbered Huckleberry card.
- Bucket Spill divides a chosen player's bucket by two.
- Rain ends the hand immediately and starts Bucket Inspection.
- Five hands are played; cumulative score wins the trip.
