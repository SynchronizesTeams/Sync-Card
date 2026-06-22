import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'images.db');
const db = new Database(dbPath);

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT,
    file_path TEXT,
    mime_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique ID and filename
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const ext = file.type === 'image/png' ? '.png' : '.jpg';
    const filename = `${id}${ext}`;
    
    // Create uploads directory inside public/ so it can be served if needed
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    // Save metadata to SQLite
    const stmt = db.prepare('INSERT INTO images (id, filename, file_path, mime_type) VALUES (?, ?, ?, ?)');
    stmt.run(id, file.name, filePath, file.type);

    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
