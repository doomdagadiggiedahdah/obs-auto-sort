#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { ChromaClient } from 'chromadb';
import { pipeline } from '@xenova/transformers';
import * as crypto from 'crypto';

// Database schema types (simplified from the plugin)
const notes = {
  id: 'id',
  path: 'path',
  title: 'title',
  content: 'content',
  created: 'created',
  modified: 'modified',
  size: 'size',
  tags: 'tags'
};

const embeddings = {
  id: 'id',
  noteId: 'note_id',
  embedding: 'embedding',
  model: 'model',
  created: 'created',
  chunk: 'chunk',
  chunkIndex: 'chunk_index'
};

class EmbeddingIndexer {
  private client: ChromaClient;
  private notesCollection: any;
  private embedder: any;

  constructor() {
    // ChromaDB connection
    this.client = new ChromaClient();
    this.notesCollection = null;
    this.embedder = null;
  }

  async initializeEmbedder(): Promise<void> {
    if (!this.embedder) {
      console.log('🔧 Loading embedding model...');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('✅ Embedding model loaded');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.initializeEmbedder();
    
    // Generate embedding using Transformers.js
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async getAllNotesFromVault(vaultPath: string): Promise<Array<{path: string, content: string, stats: fs.Stats}>> {
    const notesData = [];
    const files = fs.readdirSync(vaultPath).filter(f => f.endsWith('.md') && f !== 'README.md');
    
    for (const filename of files) {
      const filePath = path.join(vaultPath, filename);
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      
      notesData.push({
        path: filename,
        content,
        stats
      });
    }
    
    return notesData;
  }

  async initialize(): Promise<void> {
    this.notesCollection = await this.client.getOrCreateCollection({
      name: 'notes',
      metadata: { description: 'Obsidian notes with embeddings' }
    });
  }

  async getExistingNotes(): Promise<any[]> {
    if (!this.notesCollection) return [];
    
    try {
      const results = await this.notesCollection.get({
        include: ['metadatas']
      });
      return results.ids.map((id: string, index: number) => ({
        id,
        path: results.metadatas[index]?.path,
        title: results.metadatas[index]?.title
      }));
    } catch (error) {
      console.error('Error getting existing notes:', error);
      return [];
    }
  }

  async insertNoteWithEmbedding(noteData: any, embedding: number[]): Promise<string> {
    if (!this.notesCollection) {
      throw new Error('Collection not initialized');
    }
    
    const noteId = crypto.randomUUID();
    
    await this.notesCollection.add({
      ids: [noteId],
      documents: [noteData.content],
      metadatas: [{
        path: noteData.path,
        title: noteData.title,
        created: noteData.created.toISOString(),
        modified: noteData.modified.toISOString(),
        size: noteData.size
      }],
      embeddings: [embedding]
    });
    
    return noteId;
  }

  async indexVault(): Promise<void> {
    console.log('🚀 Starting vault indexing...');
    
    await this.initialize();
    
    const vaultPath = '/home/mat/Documents/ProgramExperiments/exp/obs-auto-sort/claude_responses';
    
    // Get all notes from vault
    const vaultNotes = await this.getAllNotesFromVault(vaultPath);
    console.log(`📖 Found ${vaultNotes.length} notes in vault`);
    
    // Get existing notes from ChromaDB
    const existingNotes = await this.getExistingNotes();
    const existingNotePaths = new Set(existingNotes.map(n => n.path));
    
    console.log(`💾 Found ${existingNotes.length} existing notes in ChromaDB`);
    
    let newNotesCount = 0;
    
    for (const vaultNote of vaultNotes) {
      const title = vaultNote.path.replace('.md', '');
      
      // Insert note if it doesn't exist
      if (!existingNotePaths.has(vaultNote.path)) {
        try {
          console.log(`🧠 Generating embedding for: ${title}`);
          const embedding = await this.generateEmbedding(vaultNote.content);
          
          await this.insertNoteWithEmbedding({
            path: vaultNote.path,
            title,
            content: vaultNote.content,
            created: new Date(vaultNote.stats.birthtime),
            modified: new Date(vaultNote.stats.mtime),
            size: vaultNote.stats.size
          }, embedding);
          
          newNotesCount++;
          console.log(`✅ Added note with embedding: ${title} (${embedding.length} dimensions)`);
        } catch (error) {
          console.error(`❌ Failed to process ${title}:`, error);
        }
      } else {
        console.log(`⏭️  Skipping existing note: ${title}`);
      }
    }
    
    console.log(`🎉 Indexing complete!`);
    console.log(`📝 New notes added: ${newNotesCount}`);
  }

  async close(): Promise<void> {
    // ChromaDB doesn't require explicit connection closing
  }
}

// Main execution
async function main() {
  const indexer = new EmbeddingIndexer();
  
  try {
    await indexer.indexVault();
  } catch (error) {
    console.error('❌ Indexing failed:', error);
  } finally {
    await indexer.close();
  }
}

if (require.main === module) {
  main();
}

export { EmbeddingIndexer };