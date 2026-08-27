require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const recipesRouter = require('./routes/recipes');
const matchRouter = require('./routes/match');
const annotationsRouter = require('./routes/annotations');
const ocrRouter = require('./routes/ocr');

const app = express();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/recipes', recipesRouter);
app.use('/api/recipes', annotationsRouter); // adds GET/PUT /api/recipes/:id/annotations
app.use('/api/match', matchRouter);
app.use('/api/ocr', ocrRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Recipe Finder API listening on http://localhost:${port}`);
});
