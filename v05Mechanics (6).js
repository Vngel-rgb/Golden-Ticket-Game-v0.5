# Version 0.6 — First Implementation Pass

The finalized Version 0.6 blueprint is the source of truth.

## Files changed

- `src/gameData.js` — canonical card/space/character names and IDs.
- `src/v05Mechanics.js` — shared coin, draw, Wonka Bar, ordered-sweep, and board-space engine.
- `src/main.jsx` — card contracts, movement, space prompts, character triggers, AP gating, and game UI flow.
- `src/styles.css` — existing mobile-first presentation retained.
- `package.json` — version advanced to 0.6.0.
- `README.md` — v0.6 run and test guidance.

## Implemented in this pass

- 30-coin cap through a shared award helper.
- Ordered Player Mat stacks and newest-first sweep removal.
- Final-destination-only movement.
- One-card Discard to Move flow with Confirm and Cancel.
- Automatic Spaces 7 and 8.
- Eligibility-gated Space Ability prompts for playable spaces.
- Wonka movement pending only after a player lands on Wonka.
- Canonical behavior paths and decision dialogs for all Sweet, Rowdy, and Mystery cards.
- Veruca draw modification, Violet completed-effect check, Charlie sweep decision, Mike third-action decision, and Augustus start-turn refill.
- AP locks, combined-card single AP cost, and no AP loss on cancellation or failed validation.

## Required follow-up before production

The first local pass deliberately does not deploy. The three simultaneous multiplayer events and Exploding Candy defense still need multi-browser concurrency testing and hardening so every remote player answers on their own device:

- Slugworth Sizzler
- Invisible Gumdrop
- Ficklegruber’s Juicy Bar
- Exploding Candy defender reaction

The current first-pass interfaces exercise their resolution contracts, but production readiness requires persisted per-player responses, idempotency checks, reconnect recovery, and verification in 2–5 live sessions.
