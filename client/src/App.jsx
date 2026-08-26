import { useState } from 'react';
import IngredientMatcher from './pages/IngredientMatcher.jsx';
import RecipeViewer from './pages/RecipeViewer.jsx';
import IngredientExtractor from './pages/IngredientExtractor.jsx';
import Login from './pages/Login.jsx';

// Naive PoC auth — the annotations API keys everything off userId, so the
// signed-in identity is simply the userId we send. Persisted in localStorage
// so a refresh keeps you signed in.
const AUTH_KEY = 'recipe-finder.user';

export default function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem(AUTH_KEY) || null);
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [view, setView] = useState('search'); // 'search' | 'extract'

  function login(id) {
    localStorage.setItem(AUTH_KEY, id);
    setUserId(id);
  }

  function logout() {
    localStorage.removeItem(AUTH_KEY);
    setUserId(null);
    setSelectedRecipeId(null);
  }

  if (!userId) {
    return <Login onLogin={login} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">🍳 Recipe Finder</span>
        <nav className="app-nav">
          <button
            className={view === 'search' ? 'nav-link active' : 'nav-link'}
            onClick={() => setView('search')}
          >
            Search
          </button>
          <button
            className={view === 'extract' ? 'nav-link active' : 'nav-link'}
            onClick={() => setView('extract')}
          >
            Add recipe
          </button>
        </nav>
        <span className="user-badge">
          Signed in as <strong>{userId}</strong>
          <button className="link-button" onClick={logout}>
            Log out
          </button>
        </span>
      </header>

      {view === 'search' ? (
        <div className="workspace">
          <aside className="workspace-left">
            <IngredientMatcher
              userId={userId}
              onSelectRecipe={setSelectedRecipeId}
              selectedRecipeId={selectedRecipeId}
            />
          </aside>
          <section className="workspace-right">
            <RecipeViewer recipeId={selectedRecipeId} userId={userId} />
          </section>
        </div>
      ) : (
        <IngredientExtractor userId={userId} />
      )}
    </div>
  );
}
