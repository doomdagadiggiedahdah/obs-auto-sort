import { App, PluginSettingTab, Setting, Plugin } from 'obsidian';

interface FleetingNotesSettings {
	panelVisible: boolean;
	dbConnectionString: string;
	enableSemanticSearch: boolean;
	embeddingModel: string;
}

export class FleetingNotesSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: FleetingNotesSettings; saveSettings(): Promise<void> };

	constructor(app: App, plugin: Plugin & { settings: FleetingNotesSettings; saveSettings(): Promise<void> }) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Fleeting Notes Sorter Settings' });

		// Database connection setting
		new Setting(containerEl)
			.setName('Database Connection String')
			.setDesc('PostgreSQL connection string for storing note embeddings and metadata')
			.addText(text => text
				.setPlaceholder('postgresql://user:password@localhost:5432/fleeting_notes')
				.setValue(this.plugin.settings.dbConnectionString)
				.onChange(async (value) => {
					this.plugin.settings.dbConnectionString = value;
					await this.plugin.saveSettings();
				}));

		// Semantic search toggle
		new Setting(containerEl)
			.setName('Enable Semantic Search')
			.setDesc('Enable semantic search using local embeddings (requires database connection)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableSemanticSearch)
				.onChange(async (value) => {
					this.plugin.settings.enableSemanticSearch = value;
					await this.plugin.saveSettings();
				}));

		// Embedding model setting
		new Setting(containerEl)
			.setName('Embedding Model')
			.setDesc('Local embedding model to use for semantic search')
			.addDropdown(dropdown => dropdown
				.addOption('local', 'Local bi-encoder')
				.addOption('sentence-transformers', 'Sentence Transformers')
				.setValue(this.plugin.settings.embeddingModel)
				.onChange(async (value) => {
					this.plugin.settings.embeddingModel = value;
					await this.plugin.saveSettings();
				}));

		// Panel visibility setting
		new Setting(containerEl)
			.setName('Panel Visible by Default')
			.setDesc('Show the fleeting notes panel when Obsidian starts')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.panelVisible)
				.onChange(async (value) => {
					this.plugin.settings.panelVisible = value;
					await this.plugin.saveSettings();
				}));

		// Privacy notice
		containerEl.createEl('h3', { text: 'Privacy & Local Processing' });
		const privacyNotice = containerEl.createDiv();
		privacyNotice.innerHTML = `
			<p>This plugin prioritizes your privacy by processing all embeddings locally:</p>
			<ul>
				<li>No data is sent to external APIs</li>
				<li>All semantic processing happens on your machine</li>
				<li>Your notes and embeddings stay under your control</li>
				<li>Database storage is local or self-hosted</li>
			</ul>
		`;
	}
}