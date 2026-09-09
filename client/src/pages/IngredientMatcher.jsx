import { useState } from 'react';
import IngredientChips from '../components/IngredientChips.jsx';
import RecipeCard from '../components/RecipeCard.jsx';
import { matchRecipes } from '../api.js';

export default function IngredientMatcher({ onSelectRecipe, selectedRecipeId }) {
  const [ingredients, setIngredients] = useState(['large eggplant', 'garlic', 'butter', 'rice']);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function addIngredient(name) {
    setIngredients((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  function removeIngredient(name) {
    setIngredients((prev) => prev.filter((i) => i !== name));
  }

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const data = await matchRecipes(ingredients);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="screen">
      <h1 className="screen-title">What's in my kitchen?</h1>

      <IngredientChips ingredients={ingredients} onAdd={addIngredient} onRemove={removeIngredient} />

      <button className="primary-button" onClick={search} disabled={loading}>
        {loading ? 'Searching…' : 'Find recipes'}
      </button>

      {error && <p className="error-text">{error}</p>}

      <div className="results">
        {results === null && <p className="hint">Enter what you have, then search.</p>}
        {results?.length === 0 && <p className="hint">No recipes match those ingredients yet.</p>}
        {results?.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onSelect={onSelectRecipe}
            selected={recipe.id === selectedRecipeId}
          />
        ))}
      </div>
    </main>
  );
}
