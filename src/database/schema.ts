import { pgTable, text, timestamp, real, integer, index } from 'drizzle-orm/pg-core';

export const notes = pgTable('notes', {
	id: text('id').primaryKey(),
	path: text('path').notNull().unique(),
	title: text('title').notNull(),
	content: text('content').notNull(),
	created: timestamp('created').notNull(),
	modified: timestamp('modified').notNull(),
	size: integer('size').notNull(),
	tags: text('tags').array(),
}, (table) => ({
	pathIdx: index('path_idx').on(table.path),
	modifiedIdx: index('modified_idx').on(table.modified),
	titleIdx: index('title_idx').on(table.title),
}));

export const embeddings = pgTable('embeddings', {
	id: text('id').primaryKey(),
	noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
	embedding: text('embedding'), // Store as JSON string for now
	model: text('model').notNull(),
	created: timestamp('created').notNull(),
	chunk: text('chunk'),
	chunkIndex: integer('chunk_index').default(0),
}, (table) => ({
	noteIdIdx: index('note_id_idx').on(table.noteId),
	modelIdx: index('model_idx').on(table.model),
}));

export const searches = pgTable('searches', {
	id: text('id').primaryKey(),
	query: text('query').notNull(),
	searchType: text('search_type').notNull(),
	results: text('results').array(),
	timestamp: timestamp('timestamp').notNull(),
	userId: text('user_id'),
}, (table) => ({
	timestampIdx: index('timestamp_idx').on(table.timestamp),
	searchTypeIdx: index('search_type_idx').on(table.searchType),
}));

export const clusters = pgTable('clusters', {
	id: text('id').primaryKey(),
	noteIds: text('note_ids').array().notNull(),
	centroid: text('centroid'), // Store as JSON string
	label: text('label'),
	created: timestamp('created').notNull(),
	algorithm: text('algorithm').notNull(),
	parameters: text('parameters'),
}, (table) => ({
	createdIdx: index('cluster_created_idx').on(table.created),
	algorithmIdx: index('algorithm_idx').on(table.algorithm),
}));

export const themes = pgTable('themes', {
	id: text('id').primaryKey(),
	noteIds: text('note_ids').array().notNull(),
	keywords: text('keywords').array().notNull(),
	ngrams: text('ngrams').array(),
	frequency: integer('frequency').notNull(),
	score: real('score').notNull(),
	created: timestamp('created').notNull(),
	extractionMethod: text('extraction_method').notNull(),
}, (table) => ({
	frequencyIdx: index('frequency_idx').on(table.frequency),
	scoreIdx: index('score_idx').on(table.score),
	createdIdx: index('theme_created_idx').on(table.created),
}));

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;
export type Search = typeof searches.$inferSelect;
export type NewSearch = typeof searches.$inferInsert;
export type Cluster = typeof clusters.$inferSelect;
export type NewCluster = typeof clusters.$inferInsert;
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;