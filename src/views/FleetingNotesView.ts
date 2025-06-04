import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import FleetingNotesPlugin from '../main';
import { TextSearch } from '../search/TextSearch';
import { SemanticSearch } from '../search/SemanticSearch';

export const VIEW_TYPE_FLEETING_NOTES = 'fleeting-notes-view';

export interface SearchResult {
	file: TFile;
	title: string;
	preview: string;
	score: number;
	created: Date;
	modified: Date;
}

export class FleetingNotesView extends ItemView {
	private plugin: FleetingNotesPlugin;
	private textSearch: TextSearch;
	private semanticSearch: SemanticSearch;
	private currentSearchMode: 'text' | 'semantic' = 'text';
	private searchResults: SearchResult[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: FleetingNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.textSearch = new TextSearch(this.app);
		this.semanticSearch = new SemanticSearch(this.app);
	}

	getViewType() {
		return VIEW_TYPE_FLEETING_NOTES;
	}

	getDisplayText() {
		return 'Fleeting Notes';
	}

	getIcon() {
		return 'search';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('fleeting-notes-panel');

		this.renderHeader(container);
		this.renderSearchInterface(container);
		this.renderResultsArea(container);
		this.renderVisualizationArea(container);
	}

	private renderHeader(container: Element) {
		const header = container.createDiv('fleeting-notes-header');
		
		const title = header.createEl('h3', { cls: 'fleeting-notes-title' });
		title.textContent = 'Fleeting Notes';

		const toggleBtn = header.createEl('button', { cls: 'fleeting-notes-toggle' });
		toggleBtn.innerHTML = '×';
		toggleBtn.addEventListener('click', () => {
			this.plugin.toggleFleetingNotesView();
		});
	}

	private renderSearchInterface(container: Element) {
		const searchContainer = container.createDiv('fleeting-notes-search-container');

		// Search input
		const searchInput = searchContainer.createEl('input', {
			cls: 'fleeting-notes-search-input',
			attr: { placeholder: 'Search fleeting notes...', type: 'text' }
		});

		// Search mode toggle
		const toggleContainer = searchContainer.createDiv('fleeting-notes-search-toggle');
		
		const textBtn = toggleContainer.createEl('button');
		textBtn.textContent = 'Text';
		textBtn.classList.add('active');
		
		const semanticBtn = toggleContainer.createEl('button');
		semanticBtn.textContent = 'Semantic';

		// Event listeners
		searchInput.addEventListener('input', (e) => {
			const query = (e.target as HTMLInputElement).value;
			this.performSearch(query);
		});

		textBtn.addEventListener('click', () => {
			this.setSearchMode('text');
			textBtn.classList.add('active');
			semanticBtn.classList.remove('active');
		});

		semanticBtn.addEventListener('click', () => {
			this.setSearchMode('semantic');
			semanticBtn.classList.add('active');
			textBtn.classList.remove('active');
		});
	}

	private renderResultsArea(container: Element) {
		const resultsContainer = container.createDiv('fleeting-notes-results');
		resultsContainer.id = 'fleeting-notes-results';
		
		// Initial empty state
		this.updateResultsDisplay();
	}

	private renderVisualizationArea(container: Element) {
		const vizContainer = container.createDiv('fleeting-notes-visualization');
		
		const title = vizContainer.createDiv('fleeting-notes-viz-title');
		title.textContent = 'Note Clusters';

		const vizArea = vizContainer.createDiv('fleeting-notes-viz-container');
		vizArea.id = 'fleeting-notes-viz';
		
		// Placeholder for visualization
		vizArea.textContent = 'Visualization will appear here';
	}

	private async performSearch(query: string) {
		if (!query.trim()) {
			this.searchResults = [];
			this.updateResultsDisplay();
			return;
		}

		try {
			if (this.currentSearchMode === 'text') {
				this.searchResults = await this.textSearch.search(query);
			} else {
				this.searchResults = await this.semanticSearch.search(query);
			}
			this.updateResultsDisplay();
		} catch (error) {
			console.error('Search error:', error);
			this.searchResults = [];
			this.updateResultsDisplay();
		}
	}

	private setSearchMode(mode: 'text' | 'semantic') {
		this.currentSearchMode = mode;
		// Re-run search if there's an active query
		const searchInput = this.containerEl.querySelector('.fleeting-notes-search-input') as HTMLInputElement;
		if (searchInput && searchInput.value.trim()) {
			this.performSearch(searchInput.value);
		}
	}

	private updateResultsDisplay() {
		const resultsContainer = this.containerEl.querySelector('#fleeting-notes-results');
		if (!resultsContainer) return;

		resultsContainer.empty();

		if (this.searchResults.length === 0) {
			const emptyState = resultsContainer.createDiv('fleeting-notes-empty-state');
			emptyState.textContent = 'No results found';
			return;
		}

		this.searchResults.forEach(result => {
			const resultItem = resultsContainer.createDiv('fleeting-notes-result-item');
			
			const title = resultItem.createDiv('fleeting-notes-result-title');
			title.textContent = result.title;

			const preview = resultItem.createDiv('fleeting-notes-result-preview');
			preview.textContent = result.preview;

			const meta = resultItem.createDiv('fleeting-notes-result-meta');
			const score = meta.createSpan();
			score.textContent = `Score: ${result.score.toFixed(2)}`;
			
			const modified = meta.createSpan();
			modified.textContent = result.modified.toLocaleDateString();

			// Click handler to open file
			resultItem.addEventListener('click', () => {
				this.app.workspace.openLinkText(result.file.path, '', false);
			});
		});
	}

	async onClose() {
		// Cleanup if needed
	}
}