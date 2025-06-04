import { App, TFile } from 'obsidian';
import { SearchResult } from '../views/FleetingNotesView';

export class TextSearch {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async search(query: string): Promise<SearchResult[]> {
		const files = this.app.vault.getMarkdownFiles();
		const results: SearchResult[] = [];
		const queryLower = query.toLowerCase();

		for (const file of files) {
			try {
				const content = await this.app.vault.cachedRead(file);
				const score = this.calculateTextScore(content, file.basename, queryLower);
				
				if (score > 0) {
					const preview = this.generatePreview(content, queryLower);
					
					results.push({
						file,
						title: file.basename,
						preview,
						score,
						created: new Date(file.stat.ctime),
						modified: new Date(file.stat.mtime)
					});
				}
			} catch (error) {
				console.error(`Error reading file ${file.path}:`, error);
			}
		}

		return results.sort((a, b) => b.score - a.score);
	}

	private calculateTextScore(content: string, title: string, query: string): number {
		const contentLower = content.toLowerCase();
		const titleLower = title.toLowerCase();
		
		let score = 0;

		// Title matches get highest weight
		if (titleLower.includes(query)) {
			score += 10;
			// Exact title match gets bonus
			if (titleLower === query) {
				score += 20;
			}
		}

		// Content matches
		const contentMatches = this.countOccurrences(contentLower, query);
		score += contentMatches * 2;

		// Word boundary matches get higher score
		const wordBoundaryRegex = new RegExp(`\\b${this.escapeRegExp(query)}\\b`, 'gi');
		const wordMatches = (content.match(wordBoundaryRegex) || []).length;
		score += wordMatches * 3;

		// Fuzzy matching for partial words
		const words = query.split(/\s+/);
		for (const word of words) {
			if (word.length > 2) {
				const fuzzyMatches = this.countOccurrences(contentLower, word.toLowerCase());
				score += fuzzyMatches * 0.5;
			}
		}

		// Bonus for matches in headers
		const headerRegex = /^#+\s+(.*)$/gm;
		let headerMatch;
		while ((headerMatch = headerRegex.exec(content)) !== null) {
			if (headerMatch[1].toLowerCase().includes(query)) {
				score += 5;
			}
		}

		// Recent files get slight boost
		const daysSinceModified = (Date.now() - new Date(content).getTime()) / (1000 * 60 * 60 * 24);
		if (daysSinceModified < 7) {
			score += 1;
		}

		return score;
	}

	private countOccurrences(text: string, substring: string): number {
		if (!substring) return 0;
		let count = 0;
		let pos = 0;
		
		while ((pos = text.indexOf(substring, pos)) !== -1) {
			count++;
			pos += substring.length;
		}
		
		return count;
	}

	private generatePreview(content: string, query: string): string {
		const lines = content.split('\n');
		const queryWords = query.split(/\s+/).filter(word => word.length > 0);
		
		// Find the line with the best match
		let bestLine = '';
		let bestScore = 0;
		
		for (const line of lines) {
			const lineLower = line.toLowerCase();
			let lineScore = 0;
			
			for (const word of queryWords) {
				if (lineLower.includes(word.toLowerCase())) {
					lineScore += word.length;
				}
			}
			
			if (lineScore > bestScore && line.trim().length > 0) {
				bestScore = lineScore;
				bestLine = line.trim();
			}
		}

		// If no good line found, use first non-empty line
		if (!bestLine) {
			for (const line of lines) {
				if (line.trim().length > 0 && !line.startsWith('#')) {
					bestLine = line.trim();
					break;
				}
			}
		}

		// Truncate if too long
		if (bestLine.length > 150) {
			// Try to find a good break point near the query
			const queryIndex = bestLine.toLowerCase().indexOf(query.toLowerCase());
			if (queryIndex !== -1) {
				const start = Math.max(0, queryIndex - 50);
				const end = Math.min(bestLine.length, queryIndex + query.length + 50);
				bestLine = (start > 0 ? '...' : '') + 
					bestLine.substring(start, end) + 
					(end < bestLine.length ? '...' : '');
			} else {
				bestLine = bestLine.substring(0, 147) + '...';
			}
		}

		return bestLine || 'No preview available';
	}

	private escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	async searchInPath(query: string, folderPath: string): Promise<SearchResult[]> {
		const allResults = await this.search(query);
		return allResults.filter(result => result.file.path.startsWith(folderPath));
	}

	async searchByTags(tags: string[]): Promise<SearchResult[]> {
		const files = this.app.vault.getMarkdownFiles();
		const results: SearchResult[] = [];

		for (const file of files) {
			try {
				const cache = this.app.metadataCache.getFileCache(file);
				const fileTags = cache?.tags?.map(t => t.tag.substring(1)) || [];
				
				const matchingTags = tags.filter(tag => 
					fileTags.some(fileTag => 
						fileTag.toLowerCase().includes(tag.toLowerCase())
					)
				);

				if (matchingTags.length > 0) {
					const content = await this.app.vault.cachedRead(file);
					const preview = this.generatePreview(content, matchingTags.join(' '));
					
					results.push({
						file,
						title: file.basename,
						preview,
						score: matchingTags.length * 10,
						created: new Date(file.stat.ctime),
						modified: new Date(file.stat.mtime)
					});
				}
			} catch (error) {
				console.error(`Error reading file ${file.path}:`, error);
			}
		}

		return results.sort((a, b) => b.score - a.score);
	}
}