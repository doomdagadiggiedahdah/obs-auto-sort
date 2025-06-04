import { App, TFile } from 'obsidian';
import { SearchResult } from '../views/FleetingNotesView';
import { DatabaseManager, NoteData } from '../database/queries';

interface EmbeddingProvider {
	generateEmbedding(text: string): Promise<number[]>;
	getDimensions(): number;
	getModelName(): string;
}

class LocalBiEncoderProvider implements EmbeddingProvider {
	private modelName = 'local-bi-encoder';
	private dimensions = 384;

	async generateEmbedding(text: string): Promise<number[]> {
		return this.generateDummyEmbedding(text);
	}

	getDimensions(): number {
		return this.dimensions;
	}

	getModelName(): string {
		return this.modelName;
	}

	private generateDummyEmbedding(text: string): number[] {
		const words = text.toLowerCase().split(/\s+/);
		const embedding = new Array(this.dimensions).fill(0);
		
		const textLength = text.length;
		const wordCount = words.length;
		const avgWordLength = textLength / Math.max(wordCount, 1);
		
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		
		for (let i = 0; i < this.dimensions; i++) {
			const wordIndex = i % words.length;
			const word = words[wordIndex] || '';
			
			let value = Math.sin((hash + i) * 0.01) * 0.5;
			value += Math.cos(word.length * (i + 1) * 0.1) * 0.3;
			value += (textLength % (i + 1)) / 1000;
			value += avgWordLength * 0.1 * Math.sin(i * 0.1);
			
			embedding[i] = Math.tanh(value);
		}
		
		const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
		return embedding.map(val => val / magnitude);
	}
}

export class SemanticSearch {
	private app: App;
	private dbManager: DatabaseManager | null = null;
	private embeddingProvider: EmbeddingProvider;

	constructor(app: App) {
		this.app = app;
		this.embeddingProvider = new LocalBiEncoderProvider();
	}

	async initialize(dbManager: DatabaseManager): Promise<boolean> {
		try {
			this.dbManager = dbManager;
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
			const queryEmbedding = await this.embeddingProvider.generateEmbedding(query);
			const similarNotes = await this.dbManager.searchSimilarNotes(queryEmbedding, 50, 0.5);
			
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
							score: noteData.similarity * 100,
							created: noteData.created,
							modified: noteData.modified
						});
					} catch (error) {
						console.error(`Error reading file ${noteData.path}:`, error);
					}
				}
			}

			await this.dbManager.logSearch(query, 'semantic', results.map(r => r.file.path));
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
			
			const noteData: NoteData = {
				id: this.generateNoteId(file.path),
				path: file.path,
				title: file.basename,
				content,
				created: new Date(stat.ctime),
				modified: new Date(stat.mtime),
				size: stat.size,
				tags: this.extractTags(content)
			};

			const existingNote = await this.dbManager.getNoteByPath(file.path);
			
			if (existingNote) {
				await this.dbManager.updateNote(existingNote.id, noteData);
			} else {
				await this.dbManager.insertNote(noteData);
			}
			
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

	private generatePreview(content: string, query: string): string {
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

		return [...new Set(tags)];
	}

	private generateNoteId(path: string): string {
		return btoa(path).replace(/[^a-zA-Z0-9]/g, '');
	}

	async close(): Promise<void> {
		if (this.dbManager) {
			await this.dbManager.close();
		}
	}
}