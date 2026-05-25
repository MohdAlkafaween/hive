// Run once after creating the database to enable WAL mode for crash safety.
// WAL (Write-Ahead Logging) ensures data is never lost on power loss or restart.
// Usage: node scripts/init-db.js

const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'dev.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

console.log('SQLite WAL mode enabled for:', dbPath)
console.log('Journal mode:', db.pragma('journal_mode', { simple: true }))

db.close()
