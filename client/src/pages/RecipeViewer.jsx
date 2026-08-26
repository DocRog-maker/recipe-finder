import { useEffect, useRef, useState } from 'react';
import WebViewer from '@pdftron/webviewer';
import { getRecipe, getAnnotations, saveAnnotations } from '../api.js';

const SAVE_DEBOUNCE_MS = 800;

export default function RecipeViewer({ recipeId, userId }) {
  const viewerDiv = useRef(null);
  const instanceRef = useRef(null);
  const saveTimerRef = useRef(null);
  const recipeIdRef = useRef(recipeId);
  const userIdRef = useRef(userId);
    const isInstantiated = useRef(false);
  const [recipe, setRecipe] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [ready, setReady] = useState(false);

  // The persistent WebViewer listeners are created once, so route them to the
  // recipe/user currently on screen via refs rather than stale closures.
  recipeIdRef.current = recipeId;
  userIdRef.current = userId;


  // Create WebViewer a single time and reuse it for every recipe.
  useEffect(() => {
    if (isInstantiated.current)
    {
      return;
    }
    isInstantiated.current = true;

    async function init() {
      // WebViewer's static runtime assets must exist at client/public/webviewer
      // (copied from node_modules/@pdftron/webviewer/public — see
      // scripts/copy-webviewer-assets.cjs, run automatically on `npm install`).
      // isInstantiated guarantees a single init, so this instance must persist
      // across StrictMode's mount/unmount/mount — do NOT abort it on cleanup.
      const instance = await WebViewer(
        { path: '/webviewer', licenseKey: import.meta.env.VITE_WEBVIEWER_LICENSE_KEY },
        viewerDiv.current
      );
      instanceRef.current = instance;

      const { documentViewer, annotationManager } = instance.Core;

      documentViewer.addEventListener('documentLoaded', async () => {
        const existing = await getAnnotations(recipeIdRef.current, userIdRef.current);
        if (existing?.xfdf) {
          await annotationManager.importAnnotations(existing.xfdf);
        }
      });

      annotationManager.addEventListener('annotationChanged', (_annots, _action, info) => {
        if (info?.imported) return; // don't re-save annotations we just loaded
        clearTimeout(saveTimerRef.current);
        setSaveStatus('Saving…');
        saveTimerRef.current = setTimeout(async () => {
          const xfdf = await annotationManager.exportAnnotations();
          await saveAnnotations(recipeIdRef.current, userIdRef.current, xfdf);
          setSaveStatus('Saved');
        }, SAVE_DEBOUNCE_MS);
      });

      setReady(true);
    }

    init();

    return () => {
      clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Load the selected recipe's PDF into the existing viewer.
  useEffect(() => {
    if (!recipeId) {
      setRecipe(null);
      return;
    }
    if (!ready) return;

    let cancelled = false;

    async function load() {
      const recipeData = await getRecipe(recipeId);
      if (cancelled) return;
      setRecipe(recipeData);
      setSaveStatus('');
      clearTimeout(saveTimerRef.current);
      instanceRef.current.UI.loadDocument(recipeData.source_pdf_url);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [recipeId, ready]);

  return (
    <main className="screen viewer-screen">
      <div className="viewer-header">
        <h1 className="screen-title">
          {recipeId ? recipe?.title || 'Loading recipe…' : 'Recipe viewer'}
        </h1>
        {saveStatus && <span className="save-status">{saveStatus}</span>}
      </div>
      <div className="webviewer-container">
        <div className="webviewer-mount" ref={viewerDiv} />
        {!recipeId && (
          <div className="viewer-placeholder">
            <p className="hint">Select a recipe on the left to view it here.</p>
          </div>
        )}
      </div>
    </main>
  );
}
