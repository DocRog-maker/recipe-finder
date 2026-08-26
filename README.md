# Recipe Finder

Upload recipe PDFs → ingredients are extracted automatically (Apryse Server SDK) →
search recipes by what you have on hand → open the matched recipe in Apryse
WebViewer and annotate it, with your notes saved per-user for next time.

```
recipe-finder/
├── server/   Express API + Postgres + Apryse ingestion pipeline
├── client/   React + Vite frontend, Apryse WebViewer for viewing/annotating
└── docker-compose.yml   Postgres for local dev
```

See [`../pdf-ingestion-server-design.md`](../pdf-ingestion-server-design.md) for the
design notes this scaffold implements, and the workflow/mock-up artifact from
earlier in this conversation for the product concept.

## Prerequisites

- Node.js 18+
- Docker (for Postgres), or your own Postgres instance
- An Apryse license key (a free trial key works) — https://docs.apryse.com/core/guides/get-started/trial-key

## Setup

1. **Database**

   ```bash
   docker compose up -d
   cd server
   cp .env.example .env      # then edit DATABASE_URL/APRYSE_LICENSE_KEY if needed
   npm install
   npm run migrate           # applies src/db/schema.sql
   ```

2. **Server**

   ```bash
   # still in server/
   npm run dev                # http://localhost:4000
   ```

   Drop your Apryse license key into `server/.env` as `APRYSE_LICENSE_KEY`.
   Without a valid key, `@pdftron/pdfnet-node` runs in demo mode (watermarked
   output, otherwise functional) — fine for local development.

3. **Client**

   ```bash
   cd ../client
   npm install                 # also copies the WebViewer runtime into public/webviewer
   npm run dev                 # http://localhost:5173
   ```

Open http://localhost:5173. Upload a recipe PDF, wait a few seconds for
extraction to finish (`GET /api/recipes/:id` shows `status`), then search by
ingredient and open a match in the viewer.

## How ingestion works

`server/src/ingestion/ingest.js` runs per upload:

1. Open the PDF with Apryse `PDFDoc`.
2. If no text layer is found (a scanned/photographed recipe), run Apryse `OCRModule` to add one.
3. Extract text in reading order with Apryse `TextExtractor`.
4. Render page 1 to PNG with Apryse `PDFDraw` for the recipe card thumbnail.
5. Parse the "Ingredients" section into `{quantity, unit, name}` rows (`ingestion/parseIngredients.js` — a heuristic parser; swap in an LLM call here for messier layouts).
6. Normalize + upsert each ingredient and write `recipe_ingredients` rows.

Matching (`POST /api/match`) and annotations (`GET`/`PUT /api/recipes/:id/annotations`,
consumed by `RecipeViewer.jsx` via WebViewer's XFDF import/export) are plain
Postgres reads/writes — no Apryse involvement needed there.

## Known scaffold limitations (by design, for a starting point)

- Ingestion runs in-process (`setImmediate`) rather than on a real job queue — fine for a demo, swap in SQS/BullMQ for production.
- `parseIngredients.js` is a regex heuristic, not an NLP/LLM parser — good enough for simply formatted recipes, will miss unusual layouts.
- No auth — `userId` is a hardcoded constant in `client/src/App.jsx`.
- Local disk storage for uploads (`server/uploads/`) — swap for S3/GCS in production.
