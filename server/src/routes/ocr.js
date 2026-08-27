const os = require('os');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { ocrRegion } = require('../ingestion/ocr');

const router = express.Router();

// PDFs are uploaded here only transiently for OCR, so keep them in the OS temp
// dir and delete them right after.
const upload = multer({
  dest: os.tmpdir(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are accepted.'));
    }
    cb(null, true);
  },
});

// POST /api/ocr  (multipart/form-data)
//   file  - the PDF (required)
//   page  - optional 1-based page number to OCR
//   rect  - optional JSON { x1, y1, x2, y2 } (WebViewer coords) region on `page`
// Returns { text } with the recognised text, for display in the ingredients box.
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  let page = req.body.page ? parseInt(req.body.page, 10) : null;
  if (!Number.isInteger(page) || page < 1) page = null;

  let rect = null;
  if (req.body.rect) {
    try {
      const r = JSON.parse(req.body.rect);
      if (['x1', 'y1', 'x2', 'y2'].every((k) => typeof r[k] === 'number')) {
        rect = r;
      }
    } catch {
      // ignore a malformed rect and OCR the whole page instead
    }
  }

  try {
    const text = await ocrRegion(req.file.path, page, rect);
    console.log(
      `OCR: recognised ${text.length} chars` +
        (page ? ` on page ${page}` : '') +
        (rect ? ' (within selected area)' : '')
    );
    res.json({ text });
  } catch (err) {
    console.error('OCR failed:', err);
    res.status(500).json({ error: `OCR failed: ${err.message || err}` });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
});

module.exports = router;
