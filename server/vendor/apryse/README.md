# Apryse add-on modules (OCR / ICR handwriting)

This directory holds the vendored Apryse add-on modules used by the ingestion
pipeline — the OCR module and its **ICR / handwriting** support.

These files are **not committed** to the repository (they are large,
platform-specific, and licensed). Everything in this directory except this
README is gitignored.

## Installing

1. Download the OCR/ICR module for your platform from Apryse
   (see https://docs.apryse.com/core/guides/ocr/ocr-module and the handwriting/ICR
   add-on documentation).
2. Extract its contents directly into this directory
   (`server/vendor/apryse/`).
3. Restart the server.

At startup the server calls `PDFNet.addResourceSearchPath()` on this directory
(see `server/src/apryse.js`), so PDFNet can locate the modules. Override the
location with the `APRYSE_MODULES_DIR` environment variable if you keep the
modules elsewhere.

If the directory is missing or empty, the app still runs — OCR/ICR-dependent
features are simply unavailable and log a warning.
