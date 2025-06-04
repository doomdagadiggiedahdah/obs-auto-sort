import { ChromaClient } from 'chromadb';

async function testConnection() {
    console.log('Testing ChromaDB connection...');
    
    try {
        const client = new ChromaClient();
        console.log('ChromaClient created successfully');
        
        const heartbeat = await client.heartbeat();
        console.log('ChromaDB heartbeat:', heartbeat);
        console.log('✅ Connection successful!');
        
        // List all collections
        const collections = await client.listCollections();
        console.log('📋 Collections found:', collections.length);
        
        for (const collection of collections) {
            console.log(`- Collection: ${collection.name}`);
            const count = await collection.count();
            console.log(`  Records: ${count}`);
        }
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.log('Make sure ChromaDB server is running on localhost:8000');
        console.log('Run: chroma run --path ./chroma-data');
    }
}

testConnection();