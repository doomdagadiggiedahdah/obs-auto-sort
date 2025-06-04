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
		try {
			// Use JavaScript-based cosine similarity since PostgreSQL vector functions may not be available
			// Get all notes with embeddings and calculate similarity in JavaScript
			const notesWithEmbeddings = await this.db
				.select({
					note: notes,
					embeddings: embeddings
				})
				.from(notes)
				.innerJoin(embeddings, eq(notes.id, embeddings.noteId))
				.where(sql`${embeddings.embedding} IS NOT NULL`);

			const results: Array<Note & { similarity: number }> = [];
			const noteMap = new Map<string, { note: Note; embeddings: number[][]; }>();

			// Group embeddings by note
			for (const row of notesWithEmbeddings) {
				if (!row.note || !row.embeddings?.embedding) continue;
				
				try {
					const embedding = JSON.parse(row.embeddings.embedding) as number[];
					
					if (!noteMap.has(row.note.id)) {
						noteMap.set(row.note.id, { note: row.note, embeddings: [] });
					}
					noteMap.get(row.note.id)?.embeddings.push(embedding);
				} catch (e) {
					console.warn(`Failed to parse embedding for note ${row.note.id}:`, e);
				}
			}

			// Calculate similarity for each note
			for (const [noteId, { note, embeddings: noteEmbeddings }] of noteMap) {
				let maxSimilarity = 0;
				
				for (const embedding of noteEmbeddings) {
					const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding);
					maxSimilarity = Math.max(maxSimilarity, similarity);
				}
				
				if (maxSimilarity >= threshold) {
					results.push({
						...note,
						similarity: maxSimilarity
					});
				}
			}

			return results
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, limit);
		} catch (error) {
			console.error('Vector search failed, falling back to text search:', error);
			
			// Fallback to text-based similarity using existing embeddings
			const allNotes = await this.db
				.select({
					note: notes,
					embeddings: embeddings
				})
				.from(notes)
				.leftJoin(embeddings, eq(notes.id, embeddings.noteId))
				.limit(limit * 3); // Get more to filter
			
			const results: Array<Note & { similarity: number }> = [];
			const processedNoteIds = new Set<string>();
			
			for (const row of allNotes) {
				if (!row.note || processedNoteIds.has(row.note.id)) continue;
				
				let similarity = 0;
				if (row.embeddings?.embedding) {
					try {
						const embedding = JSON.parse(row.embeddings.embedding) as number[];
						similarity = this.calculateCosineSimilarity(queryEmbedding, embedding);
					} catch (e) {
						similarity = 0.1; // Very low similarity for parsing errors
					}
				}
				
				if (similarity >= threshold) {
					results.push({
						...row.note,
						similarity
					});
					processedNoteIds.add(row.note.id);
				}
			}
			
			return results
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, limit);
		}
	}

	private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
		if (vecA.length !== vecB.length) return 0;
		
		let dotProduct = 0;
		let normA = 0;
		let normB = 0;
		
		for (let i = 0; i < vecA.length; i++) {
			dotProduct += vecA[i] * vecB[i];
			normA += vecA[i] * vecA[i];
			normB += vecB[i] * vecB[i];
		}
		
		if (normA === 0 || normB === 0) return 0;
		
		return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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