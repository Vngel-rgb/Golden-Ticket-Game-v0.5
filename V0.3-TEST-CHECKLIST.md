# Golden Ticket Game — mechanics playtest v0.5

This release consolidates the v0.1–v0.4 multiplayer and mobile foundation and connects the v0.5 mechanics needed before the Golden Ticket reveal stage.

## Included

- React 19 and Vite 8 client
- Supabase anonymous multiplayer rooms and realtime updates
- Netlify build and single-page-app redirect configuration
- Responsive desktop, portrait-mobile, and landscape layouts
- Nine connected board-space effects
- Sweet, Rowdy, and Mystery card resolution, including target-based and multi-copy effects
- Correct space 9-to-1 movement wrapping
- Willy Wonka encounters and movement
- Character abilities for Violet, Augustus, Charlie, Veruca, and Mike
- Category-specific sweep requirements and deck recycling
- Gameplay lock after the final Wonka Bar is claimed

Golden Tickets stay hidden in this mechanics build. The chocolate-bar opening and reveal presentation is intentionally reserved for the next release stage.

## Environment

Copy `.env.example` to `.env` and provide:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never place a Supabase secret or service-role key in this browser project.

## Local commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

Netlify uses `npm run build` and publishes `dist`. An existing working v0.4 Supabase database can be reused without a schema migration. Start a new room when testing v0.5.

See `V0.5-TEST-CHECKLIST.md` for the release test pass.
