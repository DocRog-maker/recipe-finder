const BASE = '/api';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listRecipes() {
  return fetch(`${BASE}/recipes`).then(handle);
}

export function getRecipe(id) {
  return fetch(`${BASE}/recipes/${id}`).then(handle);
}

export function uploadRecipe(file, { title, userId, ingredientsText } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  if (userId) form.append('userId', userId);
  if (ingredientsText) form.append('ingredientsText', ingredientsText);
  return fetch(`${BASE}/recipes`, { method: 'POST', body: form }).then(handle);
}

export function matchRecipes(ingredients) {
  return fetch(`${BASE}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients }),
  }).then(handle);
}

export function getAnnotations(recipeId, userId) {
  return fetch(`${BASE}/recipes/${recipeId}/annotations?userId=${encodeURIComponent(userId)}`).then(handle);
}

export function saveAnnotations(recipeId, userId, xfdf) {
  return fetch(`${BASE}/recipes/${recipeId}/annotations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, xfdf }),
  }).then(handle);
}
