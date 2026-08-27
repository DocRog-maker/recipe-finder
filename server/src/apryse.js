const path = require('path');
const fs = require('fs');
const { PDFNet } = require('@pdftron/pdfnet-node');

// Directory holding vendored Apryse add-on modules (OCR / ICR handwriting).
// These are large, platform-specific, licensed binaries that are NOT committed
// to the repo — download them from Apryse and drop them in here. See
// server/vendor/apryse/README.md.
const modulesDir = path.resolve(process.env.APRYSE_MODULES_DIR || './vendor/apryse/Lib');

let registered = false;

/**
 * Point PDFNet at the vendored add-on modules so OCRModule (and its ICR /
 * handwriting support) can find its resources. Safe to call repeatedly — the
 * search path is only added once, and it's a no-op if the directory is absent
 * (the OCR/ICR calls will then fail gracefully wherever they're used).
 */
async function registerModules() {
  if (registered) return;
  registered = true;

  if (!fs.existsSync(modulesDir)) {
    console.warn(
      `Apryse modules directory not found at ${modulesDir}; ` +
        'OCR/ICR features will be unavailable until the modules are installed.'
    );
    return;
  }

  await PDFNet.addResourceSearchPath(modulesDir);
}

module.exports = { registerModules, modulesDir };
