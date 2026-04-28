import Database from 'better-sqlite3';
import path from 'path';

// Define the path. /tmp is essential for Cloud Run write access.
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/database.sqlite' 
    : './database.sqlite';

let dbInstance = null;

/**
 * Initializes the database and creates tables if they don't exist.
 * better-sqlite3 is synchronous, so we don't need 'async' here.
 */
export function initDb() {
    if (dbInstance) return dbInstance;

    try {
        dbInstance = new Database(dbPath);
        console.log(`📡 Database connected at: ${dbPath}`);

        // Enable WAL mode for better performance
        dbInstance.pragma('journal_mode = WAL');

        // Create all necessary tables in one batch execution
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE,
                name TEXT,
                voice_hash TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE,
                otp TEXT,
                expires_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS threat_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                type TEXT,
                city TEXT,
                severity TEXT,
                scam_score INTEGER,
                transcript TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
        `);

        console.log("✅ Database schema initialized successfully.");
        return dbInstance;
    } catch (error) {
        console.error("❌ Database initialization failed:", error);
        throw error;
    }
}