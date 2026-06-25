import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.NODE_ENV === 'production'
    ? '/tmp/database.sqlite'
    : path.join(__dirname, 'database.sqlite');

let dbInstance = null;

/**
 * Thin wrapper around a sql.js Database that mimics the better-sqlite3 API
 * so the rest of the codebase needs minimal changes.
 *
 *  db.prepare(sql).run(...params)
 *  db.prepare(sql).get(...params)   → first row as plain object, or undefined
 *  db.prepare(sql).all(...params)   → array of plain objects
 *  db.exec(sql)
 */
class SqlJsDb {
    constructor(sqlJsDb) {
        this._db = sqlJsDb;
    }

    /** Persist to disk after every write so data survives restarts */
    _save() {
        try {
            const data = this._db.export();
            fs.writeFileSync(dbPath, Buffer.from(data));
        } catch (e) {
            console.error('⚠️  DB save error:', e.message);
        }
    }

    exec(sql) {
        this._db.run(sql);
        this._save();
    }

    // No-op — sql.js handles WAL mode differently; intentionally left empty for API compatibility
    pragma(_name, _value) {}

    prepare(sql) {
        const db = this._db;
        const save = this._save.bind(this);

        return {
            run(...params) {
                const stmt = db.prepare(sql);
                stmt.run(params);
                stmt.free();
                save();
                return { changes: db.getRowsModified() };
            },
            get(...params) {
                const stmt = db.prepare(sql);
                stmt.bind(params);
                let row;
                if (stmt.step()) {
                    const cols = stmt.getColumnNames();
                    const vals = stmt.get();
                    row = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
                }
                stmt.free();
                return row;
            },
            all(...params) {
                const stmt = db.prepare(sql);
                stmt.bind(params);
                const rows = [];
                while (stmt.step()) {
                    const cols = stmt.getColumnNames();
                    const vals = stmt.get();
                    rows.push(Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
                }
                stmt.free();
                return rows;
            }
        };
    }
}

/**
 * Initializes the database asynchronously (sql.js loads a WASM binary).
 * Returns a SqlJsDb instance that exposes a synchronous-style API.
 */
export async function initDb() {
    if (dbInstance) return dbInstance;

    try {
        const SQL = await initSqlJs();

        let sqlJsDb;
        if (fs.existsSync(dbPath)) {
            const fileBuffer = fs.readFileSync(dbPath);
            sqlJsDb = new SQL.Database(fileBuffer);
            console.log(`📡 Database loaded from: ${dbPath}`);
        } else {
            sqlJsDb = new SQL.Database();
            console.log(`📡 New database created at: ${dbPath}`);
        }

        dbInstance = new SqlJsDb(sqlJsDb);

        // Create tables
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

        console.log('✅ Database schema initialized successfully.');
        return dbInstance;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}
