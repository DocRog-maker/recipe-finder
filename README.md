# Recipe Finder

Upload recipe PDFs → ingredients are extracted automatically (Apryse Server SDK) →
search recipes by what you have on hand → open the matched recipe in Apryse
WebViewer and annotate it, with your notes saved per-user for next time.

```
recipe-finder/
├── server/   Express API + JSON file store + Apryse ingestion pipeline
└── client/   React + Vite frontend, Apryse WebViewer for viewing/annotating
```

Recipe metadata and annotations are stored in a single JSON file
(`server/data/db.json`); uploaded PDFs and thumbnails live under
`server/uploads/`. No database server is required.

See [`../pdf-ingestion-server-design.md`](../pdf-ingestion-server-design.md) for the
design notes this scaffold implements, and the workflow/mock-up artifact from
earlier in this conversation for the product concept.

## Prerequisites

- Node.js 18+
- An Apryse license key (a free trial key works) — https://docs.apryse.com/core/guides/get-started/trial-key

## Setup

1. **Server**

   ```bash
   cd server
   cp .env.example .env      # then set APRYSE_LICENSE_KEY (other vars are optional)
   npm install
   npm run dev                # http://localhost:4000
   ```

   The JSON data store (`server/data/db.json`) is created automatically on first
   write — no migration or database server needed.

   Drop your Apryse license key into `server/.env` as `APRYSE_LICENSE_KEY`.
   Without a valid key, `@pdftron/pdfnet-node` runs in demo mode (watermarked
   output, otherwise functional) — fine for local development.

2. **Client**

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
6. Normalize each ingredient and save them on the recipe in the JSON store (`server/src/db/store.js`).

Matching (`POST /api/match`) and annotations (`GET`/`PUT /api/recipes/:id/annotations`,
consumed by `RecipeViewer.jsx` via WebViewer's XFDF import/export) are plain
reads/writes against the JSON store — no Apryse involvement needed there.

## Known scaffold limitations (by design, for a starting point)

- Data is a single JSON file (`server/data/db.json`) held in memory and rewritten on each change — fine for a single-process demo, swap in a real database for production or multi-instance use.
- Ingestion runs in-process (`setImmediate`) rather than on a real job queue — fine for a demo, swap in SQS/BullMQ for production.
- `parseIngredients.js` is a regex heuristic, not an NLP/LLM parser — good enough for simply formatted recipes, will miss unusual layouts.
- No auth — `userId` is a hardcoded constant in `client/src/App.jsx`.
- Local disk storage for uploads (`server/uploads/`) — swap for S3/GCS in production.
