#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
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
  private db: any;
  private client: any;
  private embedder: any;

  constructor() {
    // Database connection - use peer authentication (same as psql -U postgres)
    this.client = postgres({
      host: '/var/run/postgresql',
      database: 'fleeting_notes',
      username: 'postgres'
    });
    this.db = drizzle(this.client);
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

  async getExistingNotes(): Promise<any[]> {
    const result = await this.client`SELECT * FROM notes`;
    return result;
  }

  async getExistingEmbeddings(): Promise<any[]> {
    const result = await this.client`SELECT note_id FROM embeddings`;
    return result;
  }

  async insertNote(noteData: any): Promise<string> {
    const noteId = crypto.randomUUID();
    
    await this.client`
      INSERT INTO notes (id, path, title, content, created, modified, size, tags)
      VALUES (${noteId}, ${noteData.path}, ${noteData.title}, ${noteData.content}, 
              ${noteData.created}, ${noteData.modified}, ${noteData.size}, ${noteData.tags})
      ON CONFLICT (path) DO UPDATE SET
        content = EXCLUDED.content,
        modified = EXCLUDED.modified,
        size = EXCLUDED.size
      RETURNING id
    `;
    
    return noteId;
  }

  async insertEmbedding(noteId: string, embedding: number[], content: string): Promise<void> {
    const embeddingId = crypto.randomUUID();
    
    await this.client`
      INSERT INTO embeddings (id, note_id, embedding, model, created, chunk, chunk_index)
      VALUES (${embeddingId}, ${noteId}, ${JSON.stringify(embedding)}, 'Xenova/all-MiniLM-L6-v2', 
              ${new Date()}, ${content.substring(0, 500)}, 0)
    `;
  }

  async indexVault(): Promise<void> {
    console.log('🚀 Starting vault indexing...');
    
    const vaultPath = '/home/mat/Documents/ProgramExperiments/exp/obs-auto-sort/claude_responses';
    
    // Get all notes from vault
    const vaultNotes = await this.getAllNotesFromVault(vaultPath);
    console.log(`📖 Found ${vaultNotes.length} notes in vault`);
    
    // Get existing notes and embeddings from database
    const existingNotes = await this.getExistingNotes();
    const existingEmbeddings = await this.getExistingEmbeddings();
    
    const existingNotePaths = new Set(existingNotes.map(n => n.path));
    const embeddedNoteIds = new Set(existingEmbeddings.map(e => e.note_id));
    
    console.log(`💾 Found ${existingNotes.length} existing notes in database`);
    console.log(`🧠 Found ${existingEmbeddings.length} existing embeddings in database`);
    
    let newNotesCount = 0;
    let newEmbeddingsCount = 0;
    
    for (const vaultNote of vaultNotes) {
      const title = vaultNote.path.replace('.md', '');
      let noteId: string;
      
      // Insert note if it doesn't exist
      if (!existingNotePaths.has(vaultNote.path)) {
        noteId = await this.insertNote({
          path: vaultNote.path,
          title,
          content: vaultNote.content,
          created: new Date(vaultNote.stats.birthtime),
          modified: new Date(vaultNote.stats.mtime),
          size: vaultNote.stats.size,
          tags: []
        });
        newNotesCount++;
        console.log(`📝 Added new note: ${title}`);
      } else {
        // Find existing note ID
        const existingNote = existingNotes.find(n => n.path === vaultNote.path);
        noteId = existingNote?.id;
      }
      
      // Generate embedding if it doesn't exist
      if (noteId && !embeddedNoteIds.has(noteId)) {
        try {
          console.log(`🧠 Generating embedding for: ${title}`);
          const embedding = await this.generateEmbedding(vaultNote.content);
          await this.insertEmbedding(noteId, embedding, vaultNote.content);
          newEmbeddingsCount++;
          console.log(`✅ Generated embedding for: ${title} (${embedding.length} dimensions)`);
        } catch (error) {
          console.error(`❌ Failed to generate embedding for ${title}:`, error);
        }
      }
    }
    
    console.log(`🎉 Indexing complete!`);
    console.log(`📝 New notes added: ${newNotesCount}`);
    console.log(`🧠 New embeddings generated: ${newEmbeddingsCount}`);
  }

  async close(): Promise<void> {
    await this.client.end();
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