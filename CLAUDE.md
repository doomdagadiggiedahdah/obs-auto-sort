# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**For detailed project specifications and context, see [README.md](README.md)**

## Vault Structure

This project now includes an Obsidian vault in `claude_responses/` with the plugin installed at:
- **Vault location**: `claude_responses/` (contains all the markdown notes)
- **Plugin location**: `claude_responses/.obsidian/plugins/fleeting-notes-sorter/`

## Project Overview

This is an Obsidian plugin called "Fleeting Notes Sorter" that provides comprehensive fleeting notes management with semantic search, visualization, and intelligent organization capabilities. The project is in early development stages.

## Architecture

### Technology Stack
- **TypeScript** - Primary development language
- **PostgreSQL** - Database for note storage and querying
- **DrizzleORM** - Database ORM layer
- **Local bi-encoder embeddings** - Privacy-focused semantic search
- **t-SNE clustering** - Note visualization
- **Obsidian Plugin API** - Platform integration

### Planned File Structure
```
src/
├── main.ts                 # Plugin entry point
├── views/
│   ├── FleetingNotesView.ts
│   └── components/
├── search/
│   ├── TextSearch.ts
│   └── SemanticSearch.ts
├── database/
│   ├── schema.ts
│   └── queries.ts
├── analysis/
│   ├── ThemeExtractor.ts
│   └── Visualizer.ts
└── settings/
    └── SettingsTab.ts
```

## Core Features to Implement

1. **Side Panel Interface** - Right-side panel with toggleable visibility
2. **Dual Search System** - Text search and semantic search with local embeddings
3. **Database Integration** - PostgreSQL with DrizzleORM for data persistence
4. **Visualization** - Interactive t-SNE plots for note clustering
5. **Theme Analysis** - Multi-note selection with frequency and n-gram analysis
6. **Timeline Features** - Temporal browsing and trend analysis

## Development Guidelines

### Privacy Focus
- All embeddings processing must be local (no external API calls)
- Maintain data sovereignty principles
- Document privacy benefits of local processing

### Architecture Principles
- **Modular Design** - Clean separation between search, analysis, and visualization
- **Experimentable Layouts** - Use CSS custom properties for easy UI iteration
- **Incremental Development** - Test at each step during implementation

### Key Technical Considerations
- Right-side panel should persist state across sessions
- Database schema should support complex querying for analysis features
- Embedding system should work entirely offline
- t-SNE visualization should be interactive for multi-note selection

## Common Commands

### Development
- `npm install` - Install dependencies
- `npm run build` - Build the plugin (creates main.js)
- `npm run dev` - Development build with watching
- `npm run deploy` - Build and copy files to the vault's plugin directory

### Plugin Installation
The plugin is installed in the vault at `claude_responses/.obsidian/plugins/fleeting-notes-sorter/` with the essential files:
- `main.js` (compiled plugin code)
- `manifest.json` (plugin metadata)
- `styles.css` (plugin styles)

### Testing
1. Open `claude_responses/` folder as an Obsidian vault
2. Enable the plugin in Settings > Community plugins
3. Use the ribbon icon or command palette to access the fleeting notes panel

## Debugging Against Working Codebases

When issues arise, compare incrementally against a known working Obsidian plugin:

### Process
1. **Identify the broken functionality** (e.g., plugin not loading, UI not showing, search not working)
2. **Find a working reference** (similar Obsidian plugin or official sample)
3. **Compare piece by piece**:
   - `manifest.json` - Check version compatibility, required fields
   - `main.ts` - Compare plugin initialization, view registration
   - View files - Compare UI creation, event handlers
   - Search logic - Compare text processing, result formatting
4. **Apply specific fixes** rather than wholesale rewrites
5. **Test each change** before moving to the next component

### File-by-File Comparison Priority
1. `manifest.json` (plugin metadata and compatibility)
2. `src/main.ts` (core plugin initialization)
3. `src/views/FleetingNotesView.ts` (UI panel creation)
4. `src/search/TextSearch.ts` (basic search functionality)
5. Event handling and user interactions

This incremental approach helps identify exactly what patterns work vs. what doesn't, leading to faster and more reliable fixes.