# Saved Todo List - Full Infrastructure Setup

## Previously Active Todos:

1. **Copy plugin files to Obsidian plugins directory** - ✅ COMPLETED (symlink created)
2. **Run npm install in the plugin directory** - ✅ COMPLETED 
3. **Run npm run build to compile the TypeScript code** - 🔄 IN PROGRESS (has compilation errors)
4. **Create PostgreSQL database and run database-setup.sql script** - ⏳ PENDING
5. **[USER ACTION] Enable the plugin in Obsidian Settings > Community plugins** - ⏳ PENDING
6. **[USER ACTION] Configure database connection string in plugin settings** - ⏳ PENDING  
7. **[USER ACTION] Test the plugin by opening the fleeting notes panel** - ⏳ PENDING
8. **Set up development workflow with hot reload and deploy script** - ⏳ PENDING

## TypeScript Issues Found:
- Database schema vector types need fixing
- Database queries rowCount property errors
- Need allowSyntheticDefaultImports in tsconfig (partially fixed)

## Database Status:
- PostgreSQL is installed and running ✅
- pgvector extension needs installation
- Database and user creation needed
- Schema setup pending