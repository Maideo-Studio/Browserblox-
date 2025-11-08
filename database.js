const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Initialize sql.js synchronously
const SQL = initSqlJs();

// Create database connection
const dbPath = path.join(__dirname, 'rogold.db');
let db;
try {
  const filebuffer = fs.readFileSync(dbPath);
  db = new SQL.Database(filebuffer);
} catch (err) {
  db = new SQL.Database(); // Create new database if file doesn't exist
}

// Function to save database to file
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Create tables
db.run(`
    CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        thumbnail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS maps (
        name TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        nickname TEXT UNIQUE NOT NULL,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Save database after creating tables
saveDatabase();

// Game functions
function saveGame(gameId, gameData) {
    return new Promise((resolve, reject) => {
        try {
            const { title, thumbnail, ...data } = gameData;
            const sql = `
                INSERT OR REPLACE INTO games (id, title, data, thumbnail, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            const stmt = db.prepare(sql);
            stmt.run([gameId, title, JSON.stringify(data), thumbnail]);
            stmt.free();
            saveDatabase();
            resolve({ success: true });
        } catch (err) {
            reject(err);
        }
    });
}

function getGame(gameId) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `SELECT * FROM games WHERE id = ?`;
            const stmt = db.prepare(sql);
            const result = stmt.getAsObject([gameId]);
            stmt.free();
            if (result && result.id) {
                const data = JSON.parse(result.data);
                resolve({
                    id: result.id,
                    title: result.title,
                    thumbnail: result.thumbnail,
                    ...data,
                    createdAt: result.created_at,
                    updatedAt: result.updated_at
                });
            } else {
                resolve(null);
            }
        } catch (err) {
            reject(err);
        }
    });
}

function getAllGames() {
    return new Promise((resolve, reject) => {
        try {
            const sql = `SELECT id, title, thumbnail, created_at FROM games ORDER BY updated_at DESC`;
            const stmt = db.prepare(sql);
            const results = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push({
                    id: row.id,
                    title: row.title,
                    thumbnail: row.thumbnail,
                    timestamp: row.created_at
                });
            }
            stmt.free();
            resolve(results);
        } catch (err) {
            reject(err);
        }
    });
}

function deleteGame(gameId) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `DELETE FROM games WHERE id = ?`;
            const stmt = db.prepare(sql);
            stmt.run([gameId]);
            stmt.free();
            saveDatabase();
            resolve({ success: true });
        } catch (err) {
            reject(err);
        }
    });
}

// Synchronous versions for backward compatibility
function saveGameSync(gameId, gameData) {
    try {
        const { title, thumbnail, ...data } = gameData;
        const sql = `
            INSERT OR REPLACE INTO games (id, title, data, thumbnail, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const stmt = db.prepare(sql);
        stmt.run([gameId, title, JSON.stringify(data), thumbnail]);
        stmt.free();
        saveDatabase();
        return { success: true };
    } catch (error) {
        console.error('Error saving game:', error);
        return { success: false, error: error.message };
    }
}

function getGameSync(gameId) {
    try {
        const sql = `SELECT * FROM games WHERE id = ?`;
        const stmt = db.prepare(sql);
        const result = stmt.getAsObject([gameId]);
        stmt.free();
        if (result && result.id) {
            const data = JSON.parse(result.data);
            return {
                id: result.id,
                title: result.title,
                thumbnail: result.thumbnail,
                ...data,
                createdAt: result.created_at,
                updatedAt: result.updated_at
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting game:', error);
        return null;
    }
}

function getAllGamesSync() {
    try {
        const sql = `SELECT id, title, thumbnail, created_at FROM games ORDER BY updated_at DESC`;
        const stmt = db.prepare(sql);
        const results = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push({
                id: row.id,
                title: row.title,
                thumbnail: row.thumbnail,
                timestamp: row.created_at
            });
        }
        stmt.free();
        return results;
    } catch (error) {
        console.error('Error getting all games:', error);
        return [];
    }
}

function deleteGameSync(gameId) {
    try {
        const sql = `DELETE FROM games WHERE id = ?`;
        const stmt = db.prepare(sql);
        stmt.run([gameId]);
        stmt.free();
        saveDatabase();
        return { success: true };
    } catch (error) {
        console.error('Error deleting game:', error);
        return { success: false, error: error.message };
    }
}

// Map functions
function saveMap(mapName, mapData) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `
                INSERT OR REPLACE INTO maps (name, data, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `;
            const stmt = db.prepare(sql);
            stmt.run([mapName, JSON.stringify(mapData)]);
            stmt.free();
            saveDatabase();
            resolve({ success: true });
        } catch (err) {
            reject(err);
        }
    });
}

function getMap(mapName) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `SELECT * FROM maps WHERE name = ?`;
            const stmt = db.prepare(sql);
            const result = stmt.getAsObject([mapName]);
            stmt.free();
            if (result && result.name) {
                resolve(JSON.parse(result.data));
            } else {
                resolve(null);
            }
        } catch (err) {
            reject(err);
        }
    });
}

function getAllMaps() {
    return new Promise((resolve, reject) => {
        try {
            const sql = `SELECT name FROM maps ORDER BY updated_at DESC`;
            const stmt = db.prepare(sql);
            const results = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push(row.name);
            }
            stmt.free();
            resolve(results);
        } catch (err) {
            reject(err);
        }
    });
}

function deleteMap(mapName) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `DELETE FROM maps WHERE name = ?`;
            const stmt = db.prepare(sql);
            stmt.run([mapName]);
            stmt.free();
            saveDatabase();
            resolve({ success: true });
        } catch (err) {
            reject(err);
        }
    });
}

// Player functions
function savePlayer(playerId, nickname, playerData = {}) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `
                INSERT OR REPLACE INTO players (id, nickname, data, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `;
            const stmt = db.prepare(sql);
            stmt.run([playerId, nickname, JSON.stringify(playerData)]);
            stmt.free();
            saveDatabase();
            resolve({ success: true });
        } catch (err) {
            reject(err);
        }
    });
}

function getPlayer(playerId) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `SELECT * FROM players WHERE id = ?`;
            const stmt = db.prepare(sql);
            const result = stmt.getAsObject([playerId]);
            stmt.free();
            if (result && result.id) {
                resolve({
                    id: result.id,
                    nickname: result.nickname,
                    data: JSON.parse(result.data || '{}'),
                    createdAt: result.created_at,
                    updatedAt: result.updated_at
                });
            } else {
                resolve(null);
            }
        } catch (err) {
            reject(err);
        }
    });
}

function getPlayerByNickname(nickname) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `SELECT * FROM players WHERE nickname = ?`;
            const stmt = db.prepare(sql);
            const result = stmt.getAsObject([nickname]);
            stmt.free();
            if (result && result.id) {
                resolve({
                    id: result.id,
                    nickname: result.nickname,
                    data: JSON.parse(result.data || '{}'),
                    createdAt: result.created_at,
                    updatedAt: result.updated_at
                });
            } else {
                resolve(null);
            }
        } catch (err) {
            reject(err);
        }
    });
}

function getAllNicknames() {
    return new Promise((resolve, reject) => {
        try {
            const sql = `SELECT nickname FROM players`;
            const stmt = db.prepare(sql);
            const results = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push(row.nickname);
            }
            stmt.free();
            resolve(results);
        } catch (err) {
            reject(err);
        }
    });
}

function deletePlayer(playerId) {
    return new Promise((resolve, reject) => {
        try {
            const sql = `DELETE FROM players WHERE id = ?`;
            const stmt = db.prepare(sql);
            stmt.run([playerId]);
            stmt.free();
            saveDatabase();
            resolve({ success: true });
        } catch (err) {
            reject(err);
        }
    });
}


// Export functions
module.exports = {
    saveGame,
    getGame,
    getAllGames,
    deleteGame,
    saveGameSync,
    getGameSync,
    getAllGamesSync,
    deleteGameSync,
    saveMap,
    getMap,
    getAllMaps,
    deleteMap,
    savePlayer,
    getPlayer,
    getPlayerByNickname,
    getAllNicknames,
    deletePlayer,
    db // Export db for direct access if needed
};