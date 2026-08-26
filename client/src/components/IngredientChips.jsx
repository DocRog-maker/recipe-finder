import { useState } from 'react';

export default function IngredientChips({ ingredients, onAdd, onRemove }) {
  const [draft, setDraft] = useState('');

  function submit(e) {
    e.preventDefault();
    const value = draft.trim();
    if (value) onAdd(value);
    setDraft('');
  }

  return (
    <div className="ingredient-input">
      {ingredients.map((name) => (
        <div className="chip" key={name}>
          {name}
          <span className="x" onClick={() => onRemove(name)}>
            ✕
          </span>
        </div>
      ))}
      <form onSubmit={submit} className="chip-form">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add ingredient..."
          className="chip-input"
        />
      </form>
    </div>
  );
}
