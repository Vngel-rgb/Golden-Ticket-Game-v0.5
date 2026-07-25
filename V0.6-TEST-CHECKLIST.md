# Golden Ticket Game v0.6 — first-pass test checklist

## Build

- [x] `npm run build`
- [ ] Start two local browser sessions
- [ ] Start 3-, 4-, and 5-player sessions

## Core engine

- [ ] Every coin award stops at 30
- [ ] Spending below 30 creates room to earn again
- [ ] Multi-space movement activates only the final destination
- [ ] Sweeps remove the newest eligible cards
- [ ] Cancel and failed validation spend 0 AP
- [ ] Combined plays spend exactly 1 AP
- [ ] A player at 0 AP cannot start a normal action

## Cards and spaces

- [ ] Test every card in valid and invalid states
- [ ] Test single-copy and combined-copy cards
- [ ] Test Spaces 1–9 through every movement source
- [ ] Test Activate Space and Skip Effect
- [ ] Test City Square draw/discard selection
- [ ] Test Auction House sweep choices 2, 3, and 4

## Characters

- [ ] Augustus only refills at the start of a turn
- [ ] Violet draws once after one effect awards 2+ bars
- [ ] Charlie may move after every completed sweep
- [ ] Mike may gain one third action but never a fourth
- [ ] Veruca draws exactly one extra as part of each instructed draw

## Multiplayer hardening

- [ ] Exploding Candy defender chooses Block or Accept
- [ ] Slugworth prompts all affected players simultaneously
- [ ] Invisible Gumdrop prompts all eligible players simultaneously
- [ ] Juicy Bar prompts all eligible opponents simultaneously
- [ ] Duplicate confirmations cannot resolve an event twice
- [ ] Reconnect restores the correct waiting/decision screen
