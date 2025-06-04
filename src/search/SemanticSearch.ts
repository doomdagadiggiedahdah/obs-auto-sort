import { App, TFile } from 'obsidian';
import { SearchResult } from '../views/FleetingNotesView';
import { DatabaseManager } from '../database/queries';

interface EmbeddingProvider {
	generateEmbedding(text: string): Promise<number[]>;
	getDimensions(): number;
	getModelName(): string;
}

class LocalBiEncoderProvider implements EmbeddingProvider {
	private modelName = 'Xenova/all-MiniLM-L6-v2';
	private dimensions = 384;
	private embedder: any = null;

	async generateEmbedding(text: string): Promise<number[]> {
		if (!this.embedder) {
			const { pipeline } = await import('@xenova/transformers');
			this.embedder = await pipeline('feature-extraction', this.modelName);
		}
		
		const output = await this.embedder(text, { pooling: 'mean', normalize: true });
		return Array.from(output.data);
	}

	getDimensions(): number {
		return this.dimensions;
	}

	getModelName(): string {
		return this.modelName;
	}

}

export class SemanticSearch {
	private app: App;
	private dbManager: DatabaseManager | null = null;
	private embeddingProvider: EmbeddingProvider;

	constructor(app: App, connectionString?: string) {
		this.app = app;
		this.embeddingProvider = new LocalBiEncoderProvider();
		
		if (connectionString) {
			this.dbManager = new DatabaseManager(connectionString);
		}
	}

	async initialize(connectionString: string): Promise<boolean> {
		try {
			this.dbManager = new DatabaseManager(connectionString);
			return await this.dbManager.testConnection();
		} catch (error) {
			console.error('Failed to initialize semantic search:', error);
			return false;
		}
	}

	async search(query: string): Promise<SearchResult[]> {
		if (!this.dbManager) {
			console.warn('Semantic search not available - no database connection');
			return [];
		}

		try {
			// Generate embedding for the query
			const queryEmbedding = await this.embeddingProvider.generateEmbedding(query);
			
			// Search for similar notes in the database
			const similarNotes = await this.dbManager.searchSimilarNotes(queryEmbedding, 50, 0.5);
			
			// Convert to SearchResult format
			const results: SearchResult[] = [];
			
			for (const noteData of similarNotes) {
				const file = this.app.vault.getAbstractFileByPath(noteData.path);
				if (file instanceof TFile) {
					try {
						const content = await this.app.vault.cachedRead(file);
						const preview = this.generatePreview(content, query);
						
						results.push({
							file,
							title: noteData.title,
							preview,
							score: noteData.similarity * 100, // Convert to 0-100 scale
							created: new Date(noteData.created),
							modified: new Date(noteData.modified)
						});
					} catch (error) {
						console.error(`Error reading file ${noteData.path}:`, error);
					}
				}
			}

			// Log the search for analytics
			await this.dbManager.logSearch(
				query, 
				'semantic', 
				results.map(r => r.file.path)
			);

			return results;
		} catch (error) {
			console.error('Semantic search error:', error);
			return [];
		}
	}

	async indexNote(file: TFile): Promise<boolean> {
		if (!this.dbManager) {
			return false;
		}

		try {
			const content = await this.app.vault.cachedRead(file);
			const stat = file.stat;
			
			// Create or update note record
			const noteData = {
				id: this.generateNoteId(file.path),
				path: file.path,
				title: file.basename,
				content,
				created: new Date(stat.ctime),
				modified: new Date(stat.mtime),
				size: stat.size,
				tags: this.extractTags(content)
			};

			// Check if note already exists
			const existingNote = await this.dbManager.getNoteByPath(file.path);
			
			if (existingNote) {
				await this.dbManager.updateNote(existingNote.id, noteData);
				// Delete old embeddings
				await this.dbManager.deleteEmbeddingsByNoteId(existingNote.id);
			} else {
				await this.dbManager.insertNote(noteData);
			}

			// Generate and store embeddings
			await this.generateAndStoreEmbeddings(noteData.id, content);
			
			return true;
		} catch (error) {
			console.error(`Error indexing note ${file.path}:`, error);
			return false;
		}
	}

	async indexAllNotes(): Promise<{ indexed: number; failed: number }> {
		const files = this.app.vault.getMarkdownFiles();
		let indexed = 0;
		let failed = 0;

		for (const file of files) {
			const success = await this.indexNote(file);
			if (success) {
				indexed++;
			} else {
				failed++;
			}
		}

		return { indexed, failed };
	}

	private async generateAndStoreEmbeddings(noteId: string, content: string): Promise<void> {
		if (!this.dbManager) return;

		// Split content into chunks for better embedding quality
		const chunks = this.chunkText(content, 500); // 500 character chunks
		
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];
			const embedding = await this.embeddingProvider.generateEmbedding(chunk);
			
			await this.dbManager.insertEmbedding({
				id: crypto.randomUUID(),
				noteId,
				embedding: JSON.stringify(embedding),
				model: this.embeddingProvider.getModelName(),
				created: new Date(),
				chunk,
				chunkIndex: i
			});
		}
	}

	private chunkText(text: string, maxChunkSize: number): string[] {
		const chunks: string[] = [];
		const sentences = text.split(/[.!?]+/);
		let currentChunk = '';

		for (const sentence of sentences) {
			const trimmedSentence = sentence.trim();
			if (!trimmedSentence) continue;

			if (currentChunk.length + trimmedSentence.length <= maxChunkSize) {
				currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
			} else {
				if (currentChunk) {
					chunks.push(currentChunk);
				}
				currentChunk = trimmedSentence;
			}
		}

		if (currentChunk) {
			chunks.push(currentChunk);
		}

		// If no sentences found, chunk by character count
		if (chunks.length === 0 && text.length > 0) {
			for (let i = 0; i < text.length; i += maxChunkSize) {
				chunks.push(text.substring(i, i + maxChunkSize));
			}
		}

		return chunks;
	}

	private generatePreview(content: string, query: string): string {
		// Simple preview generation - first 150 characters
		const cleanContent = content.replace(/#+\s*/g, '').trim();
		return cleanContent.length > 150 
			? cleanContent.substring(0, 147) + '...'
			: cleanContent;
	}

	private extractTags(content: string): string[] {
		const tagRegex = /#(\w+)/g;
		const tags: string[] = [];
		let match;

		while ((match = tagRegex.exec(content)) !== null) {
			tags.push(match[1]);
		}

		return [...new Set(tags)]; // Remove duplicates
	}

	private generateNoteId(path: string): string {
		// Generate a deterministic ID based on the file path
		return btoa(path).replace(/[^a-zA-Z0-9]/g, '');
	}

	async close(): Promise<void> {
		if (this.dbManager) {
			await this.dbManager.close();
		}
	}
}