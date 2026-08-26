// Apryse WebViewer ships its runtime (core libs, workers, wasm) as static
// files that must be served from your app's public directory. This copies
// them from node_modules into /public/webviewer at install time.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', '@pdftron', 'webviewer', 'public');
const dest = path.join(__dirname, '..', 'public', 'webviewer');

if (!fs.existsSync(src)) {
  console.warn('[webviewer] node_modules/@pdftron/webviewer/public not found yet, skipping copy.');
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[webviewer] copied runtime assets to public/webviewer');
