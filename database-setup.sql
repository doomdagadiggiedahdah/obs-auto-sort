-- Database setup for Fleeting Notes Sorter
-- Run this after creating your PostgreSQL database and enabling the vector extension

CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created TIMESTAMP NOT NULL,
    modified TIMESTAMP NOT NULL,
    size INTEGER NOT NULL,
    tags TEXT[]
);

CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    embedding VECTOR(384),
    model TEXT NOT NULL,
    created TIMESTAMP NOT NULL,
    chunk TEXT,
    chunk_index INTEGER DEFAULT 0
);

CREATE TABLE searches (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL,
    results TEXT[],
    timestamp TIMESTAMP NOT NULL,
    user_id TEXT
);

CREATE TABLE clusters (
    id TEXT PRIMARY KEY,
    note_ids TEXT[] NOT NULL,
    centroid VECTOR(384),
    label TEXT,
    created TIMESTAMP NOT NULL,
    algorithm TEXT NOT NULL,
    parameters TEXT
);

CREATE TABLE themes (
    id TEXT PRIMARY KEY,
    note_ids TEXT[] NOT NULL,
    keywords TEXT[] NOT NULL,
    ngrams TEXT[],
    frequency INTEGER NOT NULL,
    score REAL NOT NULL,
    created TIMESTAMP NOT NULL,
    extraction_method TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX path_idx ON notes(path);
CREATE INDEX modified_idx ON notes(modified);
CREATE INDEX title_idx ON notes(title);
CREATE INDEX note_id_idx ON embeddings(note_id);
CREATE INDEX model_idx ON embeddings(model);
CREATE INDEX embedding_idx ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX timestamp_idx ON searches(timestamp);
CREATE INDEX search_type_idx ON searches(search_type);
CREATE INDEX cluster_created_idx ON clusters(created);
CREATE INDEX algorithm_idx ON clusters(algorithm);
CREATE INDEX frequency_idx ON themes(frequency);
CREATE INDEX score_idx ON themes(score);
CREATE INDEX theme_created_idx ON themes(created);