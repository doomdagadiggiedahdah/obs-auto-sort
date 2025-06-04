# Fleeting Notes Sorter Plugin - Agent Message Store

## 🚀 FIRST TIME HERE? START HERE!

**SEE THE STRUCTURED MESSAGE STORE**: Check the companion "Message Store - Structured for LLM" artifact for the formal coordination system.

### Quick Instructions
1. **Read the structured message store** - It contains all task definitions, status, and protocols
2. **Check PROJECT_STATUS** - See what's currently active
3. **Follow LLM instructions** - Step-by-step protocol for agents
4. **Reference this document** - For project overview and context

### What This Document Contains
- Project overview and features
- Architecture decisions and rationale  
- Technical implementation details
- Background context for development

---

# Fleeting Notes Sorter Plugin - Project Overview

## Project Vision
An Obsidian plugin that creates a comprehensive fleeting notes management system with semantic search, visualization, and intelligent note organization capabilities.

## Core Features

### 1. Side Panel Interface
- Right-side panel for fleeting notes management
- Toggleable visibility with state persistence
- Modular, experimentable layout system using CSS custom properties
- Easy iteration on UI components

### 2. Search System
- **Text Search**: Basic search with title/content toggle button
- **Semantic Search**: Bi-encoder based similarity search using local embeddings
- **Database**: PostgreSQL with DrizzleORM for data persistence
- **Privacy Focus**: Local embeddings processing (include research links on privacy benefits)

### 3. Visualization & Analysis
- **t-SNE Visualization**: Interactive plot showing note clusters in semantic space
- **Multi-note Selection**: Select multiple notes for batch analysis
- **Extract Themes**: Advanced analysis including:
  - Word frequency analysis
  - N-gram analysis
  - Global semantic mapping
  - Contextual cluster positioning

### 4. Timeline Features
- Temporal note browsing (YYYY-MM-DD format)
- Monthly trend analysis
- Time-based pattern recognition
- Historical note snapshots

## Technical Architecture

### Stack
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: DrizzleORM
- **Embeddings**: Local bi-encoder model
- **Visualization**: t-SNE clustering
- **Framework**: Obsidian Plugin API

### Privacy & Local Processing
- Local embedding generation (no external API calls)
- Research documentation on privacy benefits of local models
- Data sovereignty - all processing stays on user's machine

### File Structure
```
fleeting-notes-sorter/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── views/
│   │   ├── FleetingNotesView.ts
│   │   └── components/
│   ├── search/
│   │   ├── TextSearch.ts
│   │   └── SemanticSearch.ts
│   ├── database/
│   │   ├── schema.ts
│   │   └── queries.ts
│   ├── analysis/
│   │   ├── ThemeExtractor.ts
│   │   └── Visualizer.ts
│   └── settings/
│       └── SettingsTab.ts
├── styles.css
├── manifest.json
└── package.json
```

## Feature Specifications

### Cool Button Ideas
- **Connect Similar Notes**: Auto-suggest/create links between related notes
- **Extract Themes**: Multi-note analysis with statistical insights
- **Create Summary Note**: Synthesis of related fleeting notes
- **Archive Batch**: Organized migration to permanent storage
- **Timeline View**: Chronological thought evolution
- **Export Cluster**: Bundle related notes for export
- **Global Map**: Show selected notes in full semantic space

### Settings & Configuration
- Vault structure mirroring for fleeting note identification
- Layout customization options
- Database connection configuration
- Embedding model selection
- Visualization preferences

## Development Philosophy
- Incremental development with testing at each step
- Focus on modularity for easy experimentation
- Maintain clean separation between search, analysis, and visualization components
- Document privacy benefits of local processing throughout development

## Context Notes
- UI/UX should prioritize easy experimentation with layouts
- Database approach allows for complex querying and analysis
- t-SNE visualizations help users understand thought patterns and note relationships
- Timeline features enable temporal analysis of thinking patterns