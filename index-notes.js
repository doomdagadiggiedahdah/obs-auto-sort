#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const crypto = require('crypto');

// Simple embedding function (placeholder - in production you'd use a real embedding model)
function generateSimpleEmbedding(text) {
    // Create a simple hash-based embedding (384 dimensions to match schema)
    const hash = crypto.createHash('sha256').update(text).digest();
    const embedding = [];
    for (let i = 0; i < 384; i++) {
        embedding.push((hash[i % hash.length] - 128) / 128.0);
    }
    return embedding;
}

async function indexNotes() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'fleeting_notes',
        password: '',
        port: 5432,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const notesDir = '/home/mat/Documents/ProgramExperiments/exp/obs-auto-sort/claude_responses';
        const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.md') && f !== 'README.md');
        
        console.log(`Found ${files.length} markdown files to index`);

        for (const filename of files) {
            const filePath = path.join(notesDir, filename);
            const content = fs.readFileSync(filePath, 'utf8');
            const stats = fs.statSync(filePath);
            
            const noteId = crypto.randomUUID();
            const title = filename.replace('.md', '');
            
            // Insert note
            await client.query(`
                INSERT INTO notes (id, path, title, content, created, modified, size, tags)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (path) DO UPDATE SET
                content = EXCLUDED.content,
                modified = EXCLUDED.modified,
                size = EXCLUDED.size
            `, [
                noteId,
                filename,
                title,
                content,
                new Date(stats.birthtime),
                new Date(stats.mtime),
                stats.size,
                []
            ]);

            // Generate and insert embedding
            const embedding = generateSimpleEmbedding(content);
            const embeddingId = crypto.randomUUID();
            
            await client.query(`
                INSERT INTO embeddings (id, note_id, embedding, model, created, chunk, chunk_index)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [
                embeddingId,
                noteId,
                `[${embedding.join(',')}]`,
                'simple-hash',
                new Date(),
                content.substring(0, 500), // First 500 chars as chunk
                0
            ]);

            console.log(`Indexed: ${filename}`);
        }

        console.log('All notes indexed successfully');
        
    } catch (error) {
        console.error('Error indexing notes:', error);
    } finally {
        await client.end();
    }
}

indexNotes();