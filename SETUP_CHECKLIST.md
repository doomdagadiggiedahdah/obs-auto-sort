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
- [x] Create symlink to Obsidian plugins directory
- [x] Install npm dependencies
- [ ] Complete successful build
- [ ] Restart Obsidian to detect plugin

### 4. User Configuration Steps
- [ ] [USER] Enable plugin in Obsidian Settings > Community plugins
- [ ] [USER] Configure database connection string in plugin settings
- [ ] [USER] Test plugin by opening fleeting notes panel
- [ ] [USER] Test text search functionality
- [ ] [USER] Test semantic search (requires database)

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
- Symlink created: ✓
- Dependencies installed: ✓
- TypeScript compilation: ❌ (needs fixes)
- Database setup: ❓ (needs checking)
- Plugin enabled in Obsidian: ❓ (user action needed)