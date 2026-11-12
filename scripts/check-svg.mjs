// Self-check: boots the built server, hits /api/card.svg in both orientations.
// Usage: npm run build && node scripts/check-svg.mjs
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const PORT = 8199;
const base = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: 'ignore',
});

async function get(path) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(base + path);
      if (res.ok) return await res.text();
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`no response from ${path}`);
}

try {
  const portrait = await get('/api/card.svg?nama=Adly%20Fahreza&role=Sysadmin&tags=Linux,Networking,Terraform&brand=ACME%20Labs&meta=OPS%20CARD');
  const land = await get('/api/card.svg?nama=Adly&landscape=true&dark=true&website=adly.id');

  assert.match(portrait, /viewBox="0 0 420 490"/);
  assert.match(land, /viewBox="0 0 620 320"/);
  assert.match(portrait, /Adly Fahreza/);
  assert.match(land, /#1C1917/);           // dark card body
  assert.match(portrait, /<path d="M/);     // QR path embedded
  assert.match(portrait, /data:image\/png;base64/); // default avatar inlined
  assert.match(land, /text-anchor="end"[^>]*>adly\.id</); // footer rail alignment
  assert.match(portrait, />ACME Labs</);                   // custom wordmark
  assert.match(portrait, />OPS CARD</);                   // custom corner label
  assert.match(await get('/api/card.svg?brand=&meta='), /letter-spacing="2.4"><\/text>/); // empty = hidden
  assert.ok(!portrait.includes('undefined'), 'no undefined leaked into the SVG');
  console.log('check-svg: ok');
} finally {
  server.kill();
}
