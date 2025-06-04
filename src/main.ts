import { Plugin, Notice } from 'obsidian';
import { FleetingNotesView, VIEW_TYPE_FLEETING_NOTES } from './views/FleetingNotesView';
import { FleetingNotesSettingTab } from './settings/SettingsTab';

interface FleetingNotesSettings {
	panelVisible: boolean;
	dbConnectionString: string;
	enableSemanticSearch: boolean;
	embeddingModel: string;
}

const DEFAULT_SETTINGS: FleetingNotesSettings = {
	panelVisible: true,
	dbConnectionString: '',
	enableSemanticSearch: true,
	embeddingModel: 'local'
};

export default class FleetingNotesPlugin extends Plugin {
	settings: FleetingNotesSettings;

	async onload() {
		await this.loadSettings();

		// Register the fleeting notes view
		this.registerView(
			VIEW_TYPE_FLEETING_NOTES,
			(leaf) => new FleetingNotesView(leaf, this)
		);

		// Add ribbon icon
		this.addRibbonIcon('search', 'Toggle Fleeting Notes', (evt: MouseEvent) => {
			this.toggleFleetingNotesView();
		});

		// Add commands
		this.addCommand({
			id: 'toggle-fleeting-notes-view',
			name: 'Toggle Fleeting Notes View',
			callback: () => {
				this.toggleFleetingNotesView();
			}
		});

		this.addCommand({
			id: 'index-all-notes',
			name: 'Index All Notes for Semantic Search',
			callback: () => {
				this.indexAllNotes();
			}
		});

		this.addCommand({
			id: 'index-current-note',
			name: 'Index Current Note for Semantic Search',
			callback: () => {
				this.indexCurrentNote();
			}
		});

		// Add settings tab
		this.addSettingTab(new FleetingNotesSettingTab(this.app, this));

		// Initialize view if panel should be visible
		if (this.settings.panelVisible) {
			this.initFleetingNotesView();
		}
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_FLEETING_NOTES);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async toggleFleetingNotesView() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLEETING_NOTES);
		
		if (existing.length > 0) {
			// Close existing view
			existing.forEach(leaf => leaf.detach());
			this.settings.panelVisible = false;
		} else {
			// Open new view
			await this.initFleetingNotesView();
			this.settings.panelVisible = true;
		}
		
		await this.saveSettings();
	}

	async initFleetingNotesView() {
		const { workspace } = this.app;
		
		let leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			leaf = workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
		}
		
		await leaf.setViewState({
			type: VIEW_TYPE_FLEETING_NOTES,
			active: true,
		});
		
		workspace.revealLeaf(leaf);
	}

	async indexAllNotes() {
		if (!this.settings.dbConnectionString) {
			new Notice('Please configure database connection in settings first');
			return;
		}

		const { SemanticSearch } = await import('./search/SemanticSearch');
		const semanticSearch = new SemanticSearch(this.app);
		
		const initialized = await semanticSearch.initialize(this.settings.dbConnectionString);
		if (!initialized) {
			new Notice('Failed to connect to database');
			return;
		}

		new Notice('Starting to index all notes...');
		
		try {
			const result = await semanticSearch.indexAllNotes();
			new Notice(`Indexing complete: ${result.indexed} notes indexed, ${result.failed} failed`);
		} catch (error) {
			console.error('Indexing failed:', error);
			new Notice('Indexing failed - check console for details');
		} finally {
			await semanticSearch.close();
		}
	}

	async indexCurrentNote() {
		if (!this.settings.dbConnectionString) {
			new Notice('Please configure database connection in settings first');
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file to index');
			return;
		}

		const { SemanticSearch } = await import('./search/SemanticSearch');
		const semanticSearch = new SemanticSearch(this.app);
		
		const initialized = await semanticSearch.initialize(this.settings.dbConnectionString);
		if (!initialized) {
			new Notice('Failed to connect to database');
			return;
		}

		try {
			const success = await semanticSearch.indexNote(activeFile);
			if (success) {
				new Notice(`Successfully indexed: ${activeFile.basename}`);
			} else {
				new Notice(`Failed to index: ${activeFile.basename}`);
			}
		} catch (error) {
			console.error('Indexing failed:', error);
			new Notice('Indexing failed - check console for details');
		} finally {
			await semanticSearch.close();
		}
	}
}