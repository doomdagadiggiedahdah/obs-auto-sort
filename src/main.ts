import { Plugin } from 'obsidian';
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

		// Add command
		this.addCommand({
			id: 'toggle-fleeting-notes-view',
			name: 'Toggle Fleeting Notes View',
			callback: () => {
				this.toggleFleetingNotesView();
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
}