import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';

export function getDataDir(): string {
  const dir = process.env.DATA_DIR || path.join(os.homedir(), '.sync-card-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getUploadsDir(): string {
  const dir = path.join(getDataDir(), 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

let dbInstance: any = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  
  const dbPath = path.join(getDataDir(), 'images.db');
  dbInstance = new Database(dbPath);
  
  // Initialize table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      filename TEXT,
      file_path TEXT,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  return dbInstance;
}
