const sqlite3 = require('sqlite3').verbose();
const { PATHS } = require('../config/environment');

class DatabaseService {
  constructor() {
    this.db = new sqlite3.Database(PATHS.DATABASE);
    this.initializeDatabase();
  }

  initializeDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        salvar INTEGER DEFAULT 0
      )
    `);
  }

  saveVideo(filename, filepath, salvar = false) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      this.db.run(
        `INSERT INTO videos (filename, path, timestamp, salvar) VALUES (?, ?, ?, ?)`,
        [filename, filepath, timestamp, salvar ? 1 : 0],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  getImportantVideos() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT filename, path, datetime(timestamp / 1000, 'unixepoch', 'localtime') as data_hora 
         FROM videos WHERE salvar = 1 ORDER BY timestamp DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  markAsImportant(filename) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE videos SET salvar = 1 WHERE filename = ?`,
        [filename],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  getOldVideos(timestamp) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM videos WHERE salvar = 0 AND timestamp < ?`,
        [timestamp],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  deleteVideo(id) {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM videos WHERE id = ?`, [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new DatabaseService(); 