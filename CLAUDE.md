# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**For detailed project specifications and context, see [README.md](README.md)**

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

Since this is an Obsidian plugin project, typical commands would include:
- `npm install` - Install dependencies
- `npm run build` - Build the plugin
- `npm run dev` - Development build with watching

Note: Package.json and build configuration files need to be created as development progresses.