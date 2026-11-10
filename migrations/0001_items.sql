-- Every collection that lived in Wix CMS, one row per item, stored as JSON.
-- Phase 1 keeps the Wix shapes so pages work unchanged; busy collections get
-- their own typed tables and indexes in a later migration.
CREATE TABLE IF NOT EXISTS items (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  created TEXT,
  updated TEXT,
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS items_collection_created ON items (collection, created);
-- The lookups nearly every page makes.
CREATE INDEX IF NOT EXISTS items_slug ON items (collection, json_extract(data, '$.slug'));
CREATE INDEX IF NOT EXISTS items_status ON items (collection, json_extract(data, '$.status'));
CREATE INDEX IF NOT EXISTS items_business_slug ON items (collection, json_extract(data, '$.businessSlug'));
