# Obsidian Plugin Setup Checklist

## Infrastructure Setup Tasks

### 1. Fix TypeScript Compilation Issues
- [x] Update tsconfig.json with allowSyntheticDefaultImports
- [ ] Fix remaining database schema issues (vector types)
- [ ] Fix database queries (rowCount property)
- [ ] Complete npm run build successfully

### 2. Database Infrastructure
- [x] Check if PostgreSQL is installed (✓ active)
- [x] Check if PostgreSQL service is running (✓ active)
- [ ] [USER] Install pgvector extension if needed
- [ ] [USER] Create fleeting_notes database
- [ ] [USER] Create database user with permissions
- [ ] [USER] Run database-setup.sql script
- [ ] Test database connection

### 3. Plugin Installation in Obsidian
- [x] Create proper vault structure in claude_responses/.obsidian/plugins/
- [x] Install npm dependencies  
- [x] Complete successful build
- [x] Copy built files to vault plugin directory
- [ ] Open claude_responses/ as Obsidian vault
- [ ] Restart Obsidian to detect plugin

### 4. User Configuration Steps
- [ ] [USER] Open claude_responses/ folder as an Obsidian vault
- [ ] [USER] Enable plugin in Obsidian Settings > Community plugins  
- [ ] [USER] Test plugin by opening fleeting notes panel
- [ ] [USER] Test text search functionality
- [ ] [USER] Configure database connection string in plugin settings (optional)
- [ ] [USER] Test semantic search (requires database setup)

### 5. Development Workflow Setup
- [ ] Set up hot reload for development
- [ ] Create npm scripts for easy deployment
- [ ] Verify symlink allows live editing

## Commands to Run

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Install PostgreSQL if needed
sudo apt install postgresql postgresql-contrib

# Install pgvector extension
sudo apt install postgresql-15-pgvector

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE fleeting_notes;"
sudo -u postgres psql -c "CREATE USER fleeting_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fleeting_notes TO fleeting_user;"

# Enable vector extension
sudo -u postgres psql fleeting_notes -c "CREATE EXTENSION vector;"

# Run database setup
sudo -u postgres psql fleeting_notes < database-setup.sql

# Build plugin
cd /home/mat/Documents/ProgramExperiments/exp/obs-auto-sort
npm run build
```

## Current Status
- Vault structure created: ✓
- Dependencies installed: ✓  
- TypeScript compilation: ✓
- Plugin files deployed: ✓
- Database setup: ⏳ (user action needed)
- Plugin enabled in Obsidian: ⏳ (user action needed)

## Quick Start
1. Open Obsidian
2. Open folder: `/home/mat/Documents/ProgramExperiments/exp/obs-auto-sort/claude_responses/`
3. Enable the "Fleeting Notes Sorter" plugin in Settings > Community plugins
4. Click the search icon in the ribbon or use Ctrl+P → "Toggle Fleeting Notes View"