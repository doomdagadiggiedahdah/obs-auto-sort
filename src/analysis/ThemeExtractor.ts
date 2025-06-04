import { SearchResult } from '../views/FleetingNotesView';
import { DatabaseManager } from '../database/queries';

export interface WordFrequency {
	word: string;
	frequency: number;
	normalizedFrequency: number;
}

export interface NGram {
	ngram: string;
	frequency: number;
	positions: number[];
}

export interface ThemeAnalysis {
	keywords: WordFrequency[];
	bigrams: NGram[];
	trigrams: NGram[];
	topics: string[];
	sentiment: number;
	readability: number;
	wordCount: number;
	uniqueWords: number;
}

export interface GlobalTheme {
	id: string;
	noteIds: string[];
	keywords: string[];
	score: number;
	frequency: number;
	created: Date;
}

export class ThemeExtractor {
	private dbManager: DatabaseManager | null = null;
	private stopWords: Set<string>;

	constructor(connectionString?: string) {
		if (connectionString) {
			this.dbManager = new DatabaseManager(connectionString);
		}
		this.initializeStopWords();
	}

	async initialize(connectionString: string): Promise<boolean> {
		try {
			this.dbManager = new DatabaseManager(connectionString);
			return await this.dbManager.testConnection();
		} catch (error) {
			console.error('Failed to initialize theme extractor:', error);
			return false;
		}
	}

	private initializeStopWords(): void {
		this.stopWords = new Set([
			'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
			'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
			'above', 'below', 'between', 'among', 'within', 'without', 'under', 'over',
			'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
			'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
			'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
			'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
			'his', 'her', 'its', 'our', 'their', 'myself', 'yourself', 'himself',
			'herself', 'itself', 'ourselves', 'yourselves', 'themselves', 'what',
			'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all',
			'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
			'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
			'just', 'now', 'here', 'there', 'then', 'once', 'also', 'as', 'if'
		]);
	}

	async analyzeNotes(searchResults: SearchResult[]): Promise<ThemeAnalysis> {
		// Combine all note content
		const combinedText = searchResults.map(result => result.preview).join(' ');
		
		// Extract words and clean them
		const words = this.extractWords(combinedText);
		const cleanWords = words.filter(word => 
			word.length > 2 && 
			!this.stopWords.has(word.toLowerCase()) &&
			!/^\d+$/.test(word) // Remove pure numbers
		);

		// Calculate word frequencies
		const wordFreq = this.calculateWordFrequency(cleanWords);
		const keywords = this.getTopKeywords(wordFreq, 20);

		// Generate n-grams
		const bigrams = this.generateNGrams(cleanWords, 2, 15);
		const trigrams = this.generateNGrams(cleanWords, 3, 10);

		// Extract topics using simple clustering
		const topics = this.extractTopics(keywords, bigrams);

		// Calculate metrics
		const sentiment = this.calculateSentiment(combinedText);
		const readability = this.calculateReadability(combinedText);

		return {
			keywords,
			bigrams,
			trigrams,
			topics,
			sentiment,
			readability,
			wordCount: words.length,
			uniqueWords: new Set(words).size
		};
	}

	async extractGlobalThemes(searchResults: SearchResult[]): Promise<GlobalTheme[]> {
		if (!this.dbManager) {
			throw new Error('Database not initialized');
		}

		const analysis = await this.analyzeNotes(searchResults);
		const themes: GlobalTheme[] = [];

		// Group keywords into themes
		const keywordGroups = this.groupSimilarKeywords(analysis.keywords);
		
		for (let i = 0; i < keywordGroups.length; i++) {
			const group = keywordGroups[i];
			const theme: GlobalTheme = {
				id: crypto.randomUUID(),
				noteIds: searchResults.map(r => this.generateNoteId(r.file.path)),
				keywords: group.map(kw => kw.word),
				score: group.reduce((sum, kw) => sum + kw.normalizedFrequency, 0) / group.length,
				frequency: group.reduce((sum, kw) => sum + kw.frequency, 0),
				created: new Date()
			};
			themes.push(theme);
		}

		// Store themes in database
		for (const theme of themes) {
			try {
				await this.dbManager.insertTheme({
					id: theme.id,
					noteIds: theme.noteIds,
					keywords: theme.keywords,
					ngrams: analysis.bigrams.slice(0, 5).map(bg => bg.ngram),
					frequency: theme.frequency,
					score: theme.score,
					created: theme.created,
					extractionMethod: 'keyword-clustering'
				});
			} catch (error) {
				console.error('Error storing theme:', error);
			}
		}

		return themes.sort((a, b) => b.score - a.score);
	}

	private extractWords(text: string): string[] {
		return text
			.toLowerCase()
			.replace(/[^\w\s]/g, ' ')
			.split(/\s+/)
			.filter(word => word.length > 0);
	}

	private calculateWordFrequency(words: string[]): Map<string, number> {
		const frequency = new Map<string, number>();
		
		for (const word of words) {
			frequency.set(word, (frequency.get(word) || 0) + 1);
		}
		
		return frequency;
	}

	private getTopKeywords(wordFreq: Map<string, number>, limit: number): WordFrequency[] {
		const totalWords = Array.from(wordFreq.values()).reduce((sum, freq) => sum + freq, 0);
		
		return Array.from(wordFreq.entries())
			.map(([word, frequency]) => ({
				word,
				frequency,
				normalizedFrequency: frequency / totalWords
			}))
			.sort((a, b) => b.frequency - a.frequency)
			.slice(0, limit);
	}

	private generateNGrams(words: string[], n: number, limit: number): NGram[] {
		const ngrams = new Map<string, { frequency: number; positions: number[] }>();
		
		for (let i = 0; i <= words.length - n; i++) {
			const ngram = words.slice(i, i + n).join(' ');
			if (!ngrams.has(ngram)) {
				ngrams.set(ngram, { frequency: 0, positions: [] });
			}
			const ngramData = ngrams.get(ngram)!;
			ngramData.frequency++;
			ngramData.positions.push(i);
		}

		return Array.from(ngrams.entries())
			.map(([ngram, data]) => ({
				ngram,
				frequency: data.frequency,
				positions: data.positions
			}))
			.filter(ng => ng.frequency > 1) // Only include n-grams that appear more than once
			.sort((a, b) => b.frequency - a.frequency)
			.slice(0, limit);
	}

	private extractTopics(keywords: WordFrequency[], bigrams: NGram[]): string[] {
		const topics: string[] = [];
		
		// Extract topics from high-frequency keywords
		const topKeywords = keywords.slice(0, 10);
		
		// Group related keywords
		const semanticGroups = this.groupSemanticKeywords(topKeywords);
		
		for (const group of semanticGroups) {
			if (group.length >= 2) {
				topics.push(group.map(kw => kw.word).join(', '));
			}
		}

		// Add meaningful bigrams as topics
		const meaningfulBigrams = bigrams
			.filter(bg => bg.frequency >= 2)
			.slice(0, 5)
			.map(bg => bg.ngram);
		
		topics.push(...meaningfulBigrams);

		return topics.slice(0, 8); // Limit to 8 topics
	}

	private groupSemanticKeywords(keywords: WordFrequency[]): WordFrequency[][] {
		// Simple semantic grouping based on word similarity
		const groups: WordFrequency[][] = [];
		const used = new Set<string>();

		for (const keyword of keywords) {
			if (used.has(keyword.word)) continue;

			const group = [keyword];
			used.add(keyword.word);

			// Find related words
			for (const other of keywords) {
				if (used.has(other.word)) continue;
				
				if (this.areWordsRelated(keyword.word, other.word)) {
					group.push(other);
					used.add(other.word);
				}
			}

			groups.push(group);
		}

		return groups.filter(group => group.length > 0);
	}

	private areWordsRelated(word1: string, word2: string): boolean {
		// Simple heuristics for word relatedness
		
		// Same root (simple stemming)
		if (this.simpleStem(word1) === this.simpleStem(word2)) {
			return true;
		}

		// Similar length and common characters
		if (Math.abs(word1.length - word2.length) <= 2) {
			const commonChars = this.countCommonCharacters(word1, word2);
			const similarity = commonChars / Math.max(word1.length, word2.length);
			if (similarity > 0.6) {
				return true;
			}
		}

		// Check for compound words
		if (word1.includes(word2) || word2.includes(word1)) {
			return true;
		}

		return false;
	}

	private simpleStem(word: string): string {
		// Very basic stemming
		const suffixes = ['ing', 'ed', 'er', 'est', 'ly', 's'];
		let stem = word;
		
		for (const suffix of suffixes) {
			if (stem.endsWith(suffix) && stem.length > suffix.length + 2) {
				stem = stem.slice(0, -suffix.length);
				break;
			}
		}
		
		return stem;
	}

	private countCommonCharacters(word1: string, word2: string): number {
		const chars1 = new Set(word1);
		const chars2 = new Set(word2);
		let common = 0;
		
		for (const char of chars1) {
			if (chars2.has(char)) {
				common++;
			}
		}
		
		return common;
	}

	private groupSimilarKeywords(keywords: WordFrequency[]): WordFrequency[][] {
		const groups: WordFrequency[][] = [];
		const used = new Set<string>();

		// Sort by frequency first
		const sortedKeywords = [...keywords].sort((a, b) => b.frequency - a.frequency);

		for (const keyword of sortedKeywords) {
			if (used.has(keyword.word)) continue;

			const group = [keyword];
			used.add(keyword.word);

			// Find similar keywords
			for (const other of sortedKeywords) {
				if (used.has(other.word)) continue;
				
				if (this.areWordsRelated(keyword.word, other.word)) {
					group.push(other);
					used.add(other.word);
				}
			}

			if (group.length >= 2 || group[0].frequency >= 3) {
				groups.push(group);
			}
		}

		return groups.slice(0, 5); // Limit to 5 theme groups
	}

	private calculateSentiment(text: string): number {
		// Simple sentiment analysis using word lists
		const positiveWords = new Set([
			'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
			'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied', 'positive',
			'success', 'successful', 'achievement', 'progress', 'improvement', 'better'
		]);

		const negativeWords = new Set([
			'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'sad', 'angry',
			'frustrated', 'disappointed', 'negative', 'problem', 'issue', 'failure',
			'difficult', 'hard', 'challenging', 'struggle', 'worse', 'worst'
		]);

		const words = this.extractWords(text);
		let positive = 0;
		let negative = 0;

		for (const word of words) {
			if (positiveWords.has(word)) positive++;
			if (negativeWords.has(word)) negative++;
		}

		const total = positive + negative;
		if (total === 0) return 0;

		return (positive - negative) / total;
	}

	private calculateReadability(text: string): number {
		// Simple readability score based on sentence and word length
		const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
		const words = this.extractWords(text);
		
		if (sentences.length === 0 || words.length === 0) return 0;

		const avgWordsPerSentence = words.length / sentences.length;
		const avgCharsPerWord = text.replace(/\s/g, '').length / words.length;

		// Simple scoring (lower is more readable)
		const complexity = (avgWordsPerSentence * 0.39) + (avgCharsPerWord * 11.8);
		
		// Convert to 0-100 scale (higher is more readable)
		return Math.max(0, Math.min(100, 100 - complexity));
	}

	private generateNoteId(path: string): string {
		return btoa(path).replace(/[^a-zA-Z0-9]/g, '');
	}

	async getStoredThemes(limit: number = 20): Promise<GlobalTheme[]> {
		if (!this.dbManager) {
			throw new Error('Database not initialized');
		}

		const themes = await this.dbManager.getThemes(limit);
		return themes.map(theme => ({
			id: theme.id,
			noteIds: theme.noteIds || [],
			keywords: theme.keywords || [],
			score: theme.score,
			frequency: theme.frequency,
			created: new Date(theme.created)
		}));
	}

	async getThemesForNotes(noteIds: string[]): Promise<GlobalTheme[]> {
		if (!this.dbManager) {
			throw new Error('Database not initialized');
		}

		const themes = await this.dbManager.getThemesByNoteIds(noteIds);
		return themes.map(theme => ({
			id: theme.id,
			noteIds: theme.noteIds || [],
			keywords: theme.keywords || [],
			score: theme.score,
			frequency: theme.frequency,
			created: new Date(theme.created)
		}));
	}

	async close(): Promise<void> {
		if (this.dbManager) {
			await this.dbManager.close();
		}
	}
}