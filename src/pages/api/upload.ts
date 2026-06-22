import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { getDb, getUploadsDir } from '../../utils/db';

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
    
    // Detect extension from MIME type
    let ext = '.jpg';
    if (file.type === 'image/gif') {
      ext = '.gif';
    } else if (file.type === 'image/png') {
      ext = '.png';
    } else if (file.type === 'image/webp') {
      ext = '.webp';
    }
    const filename = `${id}${ext}`;
    
    // Get persistent uploads folder
    const uploadsDir = getUploadsDir();
    const filePath = path.join(uploadsDir, filename);
    
    // Save file to disk
    fs.writeFileSync(filePath, buffer);

    // Save metadata to SQLite
    const db = getDb();
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
