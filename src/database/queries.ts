import { ChromaClient } from 'chromadb';
import { requestUrl } from 'obsidian';

export interface NoteData {
	id: string;
	path: string;
	title: string;
	content: string;
	created: Date;
	modified: Date;
	size: number;
	tags: string[];
}

export interface EmbeddingData {
	id: string;
	noteId: string;
	embedding: string;
	model: string;
	created: Date;
	chunk: string;
	chunkIndex: number;
}

export interface SearchResultData {
	id: string;
	path: string;
	title: string;
	content: string;
	created: Date;
	modified: Date;
	similarity: number;
}

export class DatabaseManager {
	private client: ChromaClient;
	private notesCollection: any = null;

	constructor(host: string = 'localhost', port: number = 8000) {
		// Use default constructor for localhost:8000, or pass host/port
		if (host === 'localhost' && port === 8000) {
			this.client = new ChromaClient();
		} else {
			this.client = new ChromaClient({
				host: host,
				port: port
			});
		}
	}

	async close(): Promise<void> {
		// ChromaDB doesn't require explicit connection closing
	}

	async initialize(): Promise<boolean> {
		try {
			this.notesCollection = await this.client.getOrCreateCollection({
				name: 'notes',
				metadata: { description: 'Obsidian notes with embeddings for semantic search' }
			});
			return true;
		} catch (error) {
			console.error('Failed to initialize ChromaDB collections:', error);
			return false;
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: 'http://localhost:8000/api/v2/heartbeat',
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			console.log('ChromaDB heartbeat:', response.json);
			return true;
		} catch (error) {
			console.error('ChromaDB connection test failed:', error);
			return false;
		}
	}

	async insertNote(noteData: NoteData): Promise<boolean> {
		if (!this.notesCollection) {
			throw new Error('Collections not initialized. Call initialize() first.');
		}
		
		try {
			await this.notesCollection.add({
				ids: [noteData.id],
				documents: [noteData.content],
				metadatas: [{
					path: noteData.path,
					title: noteData.title,
					created: noteData.created.toISOString(),
					modified: noteData.modified.toISOString(),
					size: noteData.size,
					tags: JSON.stringify(noteData.tags)
				}]
			});
			return true;
		} catch (error) {
			console.error('Failed to add note to ChromaDB:', error);
			return false;
		}
	}

	async updateNote(id: string, noteData: Partial<NoteData>): Promise<boolean> {
		try {
			await this.deleteNote(id);
			if (noteData.id && noteData.content) {
				return await this.insertNote(noteData as NoteData);
			}
			return false;
		} catch (error) {
			console.error('Failed to update note:', error);
			return false;
		}
	}

	async getNoteByPath(path: string): Promise<NoteData | null> {
		if (!this.notesCollection) {
			return null;
		}

		try {
			const results = await this.notesCollection.get({
				where: { path: path }
			});
			
			if (results.ids && results.ids.length > 0) {
				const metadata = results.metadatas[0];
				return {
					id: results.ids[0],
					path: metadata.path,
					title: metadata.title,
					content: results.documents[0],
					created: new Date(metadata.created),
					modified: new Date(metadata.modified),
					size: metadata.size,
					tags: JSON.parse(metadata.tags || '[]')
				};
			}
			return null;
		} catch (error) {
			console.error('Failed to get note by path:', error);
			return null;
		}
	}

	async searchSimilarNotes(queryEmbedding: number[], limit: number = 50, threshold: number = 0.5): Promise<SearchResultData[]> {
		if (!this.notesCollection) {
			throw new Error('Collections not initialized. Call initialize() first.');
		}

		try {
			const results = await this.notesCollection.query({
				queryEmbeddings: [queryEmbedding],
				nResults: limit
			});
			
			const searchResults: SearchResultData[] = [];
			
			if (results.documents && results.documents[0]) {
				for (let i = 0; i < results.documents[0].length; i++) {
					const distance = results.distances?.[0]?.[i] || 1;
					const similarity = 1 - distance; // Convert distance to similarity
					
					if (similarity >= threshold) {
						const metadata = results.metadatas?.[0]?.[i];
						searchResults.push({
							id: results.ids?.[0]?.[i] || '',
							path: metadata?.path || '',
							title: metadata?.title || '',
							content: results.documents[0][i],
							created: new Date(metadata?.created || Date.now()),
							modified: new Date(metadata?.modified || Date.now()),
							similarity: similarity
						});
					}
				}
			}
			
			return searchResults.sort((a, b) => b.similarity - a.similarity);
		} catch (error) {
			console.error('Failed to search similar notes:', error);
			return [];
		}
	}

	async insertEmbedding(embeddingData: EmbeddingData): Promise<boolean> {
		// For ChromaDB, embeddings are stored directly with notes
		// This method is kept for compatibility but doesn't need separate storage
		return true;
	}

	async deleteEmbeddingsByNoteId(noteId: string): Promise<boolean> {
		// For ChromaDB, embeddings are deleted when the note is deleted
		return true;
	}

	async deleteNote(id: string): Promise<boolean> {
		if (!this.notesCollection) {
			throw new Error('Collections not initialized. Call initialize() first.');
		}

		try {
			await this.notesCollection.delete({
				ids: [id]
			});
			return true;
		} catch (error) {
			console.error('Failed to delete note from ChromaDB:', error);
			return false;
		}
	}

	async logSearch(query: string, searchType: string, resultPaths: string[]): Promise<boolean> {
		// Simple logging - could be expanded to store in a separate collection
		console.log(`Search logged: ${searchType} query "${query}" returned ${resultPaths.length} results`);
		return true;
	}

	async getNotesCount(): Promise<number> {
		if (!this.notesCollection) {
			return 0;
		}
		
		try {
			const count = await this.notesCollection.count();
			return count;
		} catch (error) {
			console.error('Failed to get notes count:', error);
			return 0;
		}
	}
}