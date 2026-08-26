CREATE TABLE IF NOT EXISTS recipes (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  source_pdf_url TEXT NOT NULL,
  thumbnail_url  TEXT,
  page_count     INT,
  uploaded_by    TEXT,
  status         TEXT NOT NULL DEFAULT 'processing', -- processing | ready | failed
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id             SERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  aliases        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id            SERIAL PRIMARY KEY,
  recipe_id     INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INT REFERENCES ingredients(id) ON DELETE SET NULL,
  raw_text      TEXT NOT NULL,
  quantity      NUMERIC,
  unit          TEXT
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

CREATE TABLE IF NOT EXISTS annotations (
  id         SERIAL PRIMARY KEY,
  recipe_id  INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  xfdf       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, user_id)
);
