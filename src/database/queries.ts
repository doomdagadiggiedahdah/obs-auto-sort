import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc, ilike, sql, and, inArray } from 'drizzle-orm';
import { notes, embeddings, searches, clusters, themes, type Note, type NewNote, type Embedding, type NewEmbedding } from './schema';

export class DatabaseManager {
	private db: ReturnType<typeof drizzle>;
	private client: postgres.Sql;

	constructor(connectionString: string) {
		this.client = postgres(connectionString);
		this.db = drizzle(this.client);
	}

	async close() {
		await this.client.end();
	}

	// Note operations
	async insertNote(note: NewNote): Promise<Note> {
		const [inserted] = await this.db.insert(notes).values(note).returning();
		return inserted;
	}

	async updateNote(id: string, updates: Partial<NewNote>): Promise<Note | null> {
		const [updated] = await this.db
			.update(notes)
			.set({ ...updates, modified: new Date() })
			.where(eq(notes.id, id))
			.returning();
		return updated || null;
	}

	async deleteNote(id: string): Promise<boolean> {
		const result = await this.db.delete(notes).where(eq(notes.id, id));
		return result.length > 0;
	}

	async getNoteById(id: string): Promise<Note | null> {
		const [note] = await this.db.select().from(notes).where(eq(notes.id, id));
		return note || null;
	}

	async getNoteByPath(path: string): Promise<Note | null> {
		const [note] = await this.db.select().from(notes).where(eq(notes.path, path));
		return note || null;
	}

	async getAllNotes(): Promise<Note[]> {
		return await this.db.select().from(notes).orderBy(desc(notes.modified));
	}

	async searchNotesByText(query: string, limit: number = 50): Promise<Note[]> {
		return await this.db
			.select()
			.from(notes)
			.where(
				sql`to_tsvector('english', ${notes.title} || ' ' || ${notes.content}) @@ plainto_tsquery('english', ${query})`
			)
			.orderBy(desc(notes.modified))
			.limit(limit);
	}

	// Embedding operations
	async insertEmbedding(embedding: NewEmbedding): Promise<Embedding> {
		const [inserted] = await this.db.insert(embeddings).values(embedding).returning();
		return inserted;
	}

	async getEmbeddingsByNoteId(noteId: string): Promise<Embedding[]> {
		return await this.db
			.select()
			.from(embeddings)
			.where(eq(embeddings.noteId, noteId))
			.orderBy(embeddings.chunkIndex);
	}

	async deleteEmbeddingsByNoteId(noteId: string): Promise<boolean> {
		const result = await this.db.delete(embeddings).where(eq(embeddings.noteId, noteId));
		return result.length > 0;
	}

	async searchSimilarNotes(queryEmbedding: number[], limit: number = 50, threshold: number = 0.7): Promise<Array<Note & { similarity: number }>> {
		// For now, return simple text-based results until vector search is properly configured
		const allNotes = await this.getAllNotes();
		return allNotes.slice(0, limit).map(note => ({
			...note,
			similarity: Math.random() * 0.5 + 0.5 // Placeholder similarity score
		}));
	}

	// Search history operations
	async logSearch(query: string, searchType: string, results: string[]): Promise<void> {
		await this.db.insert(searches).values({
			id: crypto.randomUUID(),
			query,
			searchType,
			results,
			timestamp: new Date(),
		});
	}

	async getSearchHistory(limit: number = 100): Promise<Array<{ query: string; searchType: string; timestamp: Date }>> {
		return await this.db
			.select({
				query: searches.query,
				searchType: searches.searchType,
				timestamp: searches.timestamp,
			})
			.from(searches)
			.orderBy(desc(searches.timestamp))
			.limit(limit);
	}

	// Cluster operations
	async insertCluster(cluster: typeof clusters.$inferInsert) {
		const [inserted] = await this.db.insert(clusters).values(cluster).returning();
		return inserted;
	}

	async getClusters(limit: number = 50) {
		return await this.db
			.select()
			.from(clusters)
			.orderBy(desc(clusters.created))
			.limit(limit);
	}

	async getClusterById(id: string) {
		const [cluster] = await this.db.select().from(clusters).where(eq(clusters.id, id));
		return cluster || null;
	}

	// Theme operations
	async insertTheme(theme: typeof themes.$inferInsert) {
		const [inserted] = await this.db.insert(themes).values(theme).returning();
		return inserted;
	}

	async getThemes(limit: number = 50) {
		return await this.db
			.select()
			.from(themes)
			.orderBy(desc(themes.score))
			.limit(limit);
	}

	async getThemesByNoteIds(noteIds: string[]) {
		return await this.db
			.select()
			.from(themes)
			.where(sql`${themes.noteIds} && ${noteIds}`)
			.orderBy(desc(themes.score));
	}

	// Analytics and statistics
	async getNotesCount(): Promise<number> {
		const [result] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(notes);
		return result.count;
	}

	async getEmbeddingsCount(): Promise<number> {
		const [result] = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(embeddings);
		return result.count;
	}

	async getRecentNotes(limit: number = 20): Promise<Note[]> {
		return await this.db
			.select()
			.from(notes)
			.orderBy(desc(notes.modified))
			.limit(limit);
	}

	async getNotesInDateRange(startDate: Date, endDate: Date): Promise<Note[]> {
		return await this.db
			.select()
			.from(notes)
			.where(and(
				sql`${notes.created} >= ${startDate}`,
				sql`${notes.created} <= ${endDate}`
			))
			.orderBy(desc(notes.created));
	}

	// Utility methods for setup
	async testConnection(): Promise<boolean> {
		try {
			await this.db.select().from(notes).limit(1);
			return true;
		} catch (error) {
			console.error('Database connection test failed:', error);
			return false;
		}
	}

	async initializeTables(): Promise<void> {
		// This would typically be handled by a migration system
		// For now, we assume tables are created externally
		console.log('Database tables should be created using SQL migrations');
	}
}