import { useEffect, useRef, useState } from 'react';
import WebViewer from '@pdftron/webviewer';
import { uploadRecipe } from '../api.js';

// Quick, un-structured selected text — good enough to know whether *something*
// is selected (for the preview and to enable the button). getSelectedText can
// return a string or a Promise depending on the build.
async function readSelectedText(documentViewer) {
  const value = documentViewer.getSelectedText();
  const text = value && typeof value.then === 'function' ? await value : value;
  return (text || '').trim();
}

// Authoritative selection text WITH line breaks preserved. getSelectedText()
// flattens multi-line selections into one line, which the ingredient parser
// (one ingredient per line) can't split. Instead we take the bounding rectangle
// of the selection quads and re-extract the text in that rectangle via
// getTextByPageAndRect — quads and that method share WebViewer's PDF coordinate
// space, so no conversion is needed and the result keeps its line structure.
async function readSelectedRegionText(instance) {
  const documentViewer = instance.Core.documentViewer;
  const doc = documentViewer.getDocument();
  const quadsByPage = documentViewer.getSelectedTextQuads() || {};
  const Math2D = instance.Core.Math;

  const pages = Object.keys(quadsByPage)
    .map(Number)
    .filter((p) => quadsByPage[p] && quadsByPage[p].length)
    .sort((a, b) => a - b);

  const parts = [];
  for (const page of pages) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const q of quadsByPage[page]) {
      for (const [x, y] of [[q.x1, q.y1], [q.x2, q.y2], [q.x3, q.y3], [q.x4, q.y4]]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // A little vertical/horizontal padding so glyph edges aren't clipped.
    const pad = 2;
    const x1 = minX - pad;
    const y1 = minY - pad;
    const x2 = maxX + pad;
    const y2 = maxY + pad;
    const rect = Math2D?.Rect ? new Math2D.Rect(x1, y1, x2, y2) : { x1, y1, x2, y2 };

    const text = await doc.getTextByPageAndRect(page, rect);
    if (text && text.trim()) parts.push(text.trim());
  }

  return parts.join('\n');
}

export default function IngredientExtractor({ userId }) {
  const viewerDiv = useRef(null);
  const instanceRef = useRef(null);
  const isInstantiated = useRef(false);
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [selectionText, setSelectionText] = useState('');
  const [sentText, setSentText] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // Create WebViewer once (kept alive across StrictMode's mount/unmount/mount).
  useEffect(() => {
    if (isInstantiated.current) return;
    isInstantiated.current = true;

    const s = import.meta.env.VITE_WEBVIEWER_LICENSE_KEY1;
    console.log(`S: ${s}`)
    async function init() {
      const instance = await WebViewer(
        { path: '/webviewer', 
         licenseKey: import.meta.env.VITE_WEBVIEWER_LICENSE_KEY1,
          enableFilePicker:true
         },
        viewerDiv.current
      );
      instanceRef.current = instance;

      const { documentViewer, Tools } = instance.Core;

      // Track the current text selection so the save button knows what to send.
      // Read it back from the viewer (not the event arg) to get the full text.
      documentViewer.addEventListener('textSelected', () => {
        readSelectedText(documentViewer).then(setSelectionText);
      });

      // Start in the text-selection tool so dragging selects the ingredients text.
      instance.UI.setToolMode(Tools.ToolNames.TEXT_SELECT);

      setReady(true);
    }

    init();
  }, []);

  // Display the chosen local PDF (no upload yet — that happens on save).
  useEffect(() => {
    if (!ready || !file) return;
    setSelectionText('');
    setResult(null);
    setStatus('');
    instanceRef.current.UI.loadDocument(file, { filename: file.name });
  }, [ready, file]);

  function chooseFile(e) {
    const picked = e.target.files[0];
    if (!picked) return;
    setFile(picked);
    // Default the title to the file name (without extension); user can edit it.
    setTitle(picked.name.replace(/\.pdf$/i, ''));
  }

  async function save() {
    // Re-read the selection at save time, preferring the line-preserving region
    // text and falling back to the flat selection if that comes back empty.
    let text = await readSelectedRegionText(instanceRef.current);
    if (!text) text = await readSelectedText(instanceRef.current.Core.documentViewer);
    if (!text) text = selectionText;
    if (!file || !text) return;

    setBusy(true);
    setSentText(text);
    console.log('Raw text being parsed:\n' + text);
    setStatus('Saving recipe and parsing the selected ingredients…');
    try {
      const recipe = await uploadRecipe(file, {
        userId,
        title: title.trim() || undefined,
        ingredientsText: text,
      });
      const ingredients = recipe.ingredients || [];
      console.log('Parsed ingredients:', ingredients);
      console.table?.(ingredients);
      setResult(ingredients);
      if (ingredients.length) {
        setStatus(
          `Saved "${recipe.title}" with ${ingredients.length} ingredient${
            ingredients.length === 1 ? '' : 's'
          }.`
        );
      } else {
        setStatus(
          recipe.error || `Saved "${recipe.title}", but no ingredients were recognised.`
        );
      }
    } catch (err) {
      setStatus(`Failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <aside className="workspace-left">
        <main className="screen">
          <h1 className="screen-title">Add a recipe</h1>

          <h2 className="section-title">1. Choose a PDF</h2>
          <label className="upload-button">
            {file ? 'Choose a different PDF' : 'Choose PDF'}
            <input type="file" accept="application/pdf" onChange={chooseFile} hidden />
          </label>
          {file && (
            <label className="title-field">
              Title
              <input
                className="login-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Recipe title"
              />
            </label>
          )}

          <h2 className="section-title">2. Select the ingredients text</h2>
          <p className="hint">
            Drag across the ingredient list in the PDF on the right, then save.
          </p>
          {selectionText ? (
            <pre className="selection-preview">{selectionText}</pre>
          ) : (
            <p className="hint">Nothing selected yet.</p>
          )}

          <button
            className="primary-button"
            onClick={save}
            disabled={!file || !selectionText || busy}
          >
            {busy ? 'Saving…' : 'Save recipe'}
          </button>

          {status && <p className="hint">{status}</p>}

          {result && (
            <>
              <h2 className="section-title">Raw text parsed</h2>
              <pre className="selection-preview">{sentText}</pre>

              <h2 className="section-title">Parsed ingredients</h2>
              {result.length > 0 ? (
                <ul className="ingredient-result">
                  {result.map((item, i) => (
                    <li key={i}>
                      <span className="ingredient-name">{item.name}</span>
                      {(item.quantity || item.unit) && (
                        <span className="ingredient-qty">
                          {[item.quantity, item.unit].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">
                  Nothing was recognised in the text above. Try selecting just the
                  ingredient lines (one per line).
                </p>
              )}
            </>
          )}
        </main>
      </aside>

      <section className="workspace-right">
        <main className="screen viewer-screen">
          <div className="webviewer-container">
            <div className="webviewer-mount" ref={viewerDiv} />
            {!file && (
              <div className="viewer-placeholder">
                <p className="hint">Choose a PDF on the left to display it here.</p>
              </div>
            )}
          </div>
        </main>
      </section>
    </div>
  );
}
