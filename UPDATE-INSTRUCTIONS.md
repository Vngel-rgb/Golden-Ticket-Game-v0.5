# Updating the existing online game to v0.5

1. Back up the current GitHub repository or create a backup branch.
2. Extract this ZIP and upload the contents of its inner project folder to the repository root.
3. Keep the existing Supabase project, tables, URL, and publishable key.
4. In Netlify, use `npm run build` as the build command and `dist` as the publish directory.
5. Keep the repository base directory blank unless the project intentionally lives in a subfolder.
6. Clear the Netlify build cache and deploy if an older version remains visible.
7. Create a new game room for v0.5 testing.

No Supabase schema migration is required from a working v0.4 installation.
