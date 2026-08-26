export default function RecipeCard({ recipe, onSelect, selected }) {
  const badgeClass = recipe.matchPercent === 100 ? 'match-badge' : 'match-badge partial';

  return (
    <div
      className={selected ? 'recipe-card selected' : 'recipe-card'}
      onClick={() => onSelect(recipe.id)}
    >
      <div className="recipe-thumb">
        {recipe.thumbnail_url ? (
          <img src={recipe.thumbnail_url} alt="" />
        ) : (
          <span>🍽️</span>
        )}
      </div>
      <div className="recipe-info">
        <div className="name">{recipe.title}</div>
        <div className="meta">
          {recipe.matchCount}/{recipe.totalCount} matched
          {recipe.missing.length > 0 && <> — missing: {recipe.missing.join(', ')}</>}
        </div>
      </div>
      <div className={badgeClass}>{recipe.matchPercent}%</div>
    </div>
  );
}
