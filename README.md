
# Music Store – Seeded Generator

Single‑page web app + Node/Express server that generates a fake music store showcase with **seeded** data and **server‑side** audio synthesis. To visit it:https://music-store-generator.onrender.com

## Features
- Language selection: **English (US)** and **Deutsch (DE)**. Easily add more by dropping JSON files in `locales/`.
- 64‑bit seed (hex or decimal). **Random seed** button.
- Likes per song (0–10, fractional supported with probabilistic rounding).
- Two views:
  - **Table View** with pagination and expandable rows (cover, review, audio preview).
  - **Gallery View** with **infinite scrolling**.
- Data updates **instantly** on parameter changes. Changing likes does **not** alter titles/artists.
- Covers generated **server‑side** as SVG with title and artist printed, plus a patterned background.
- **Audio previews generated on the server** deterministically (same seed → same song) and streamed as MP3.
- Optional: **Export ZIP** of MP3s for the current page.
- No authentication required.
- No DB for random data (a `migrations/` folder is provided as a placeholder for lookup tables if wanted).

## Run locally
```bash
cd music-store-generator
npm install
npm run start
# open http://localhost:3000
```

## Add a new language/region
1. Create `locales/<code>.json` (e.g., `fr-FR.json`) with arrays: `genres`, `title_words`, `review_phrases`.
2. Use the UI dropdown by adding an `<option>` in `public/index.html`.
3. The server automatically loads the JSON at runtime (no rebuild needed).

## Notes
- Seeds are combined with the **page number** (MAD/xorshift) so each page is reproducible.
- Audio is a simple deterministic synth (tri/sine/square), ~10s clip, 110–149 BPM, with I‑V‑vi‑IV‑ish progression.
- Likes are computed with a separate RNG stream so toggling likes won't change titles/artists.
- “Single” is literal as allowed by spec.
