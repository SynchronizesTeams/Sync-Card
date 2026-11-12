import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

// XML Escaping function to prevent SVG rendering errors
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Word-wrapping function for name
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    if (currentLine === '') {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

// paper-card palette — mirrors DESIGN.md tokens (no raw hex outside these objects)
const light = {
  card: '#FAF7F2',
  text: '#1C1917',
  muted: '#57534E',
  line: '#E2DCD0',
  chip: '#E2DCD0',
  qrBox: '#FFFFFF',
};
const dark = {
  card: '#1C1917',
  text: '#FAF7F2',
  muted: '#B8B2AA',
  line: '#4A443C',
  chip: '#4A443C',
  qrBox: '#FFFFFF',
};
const accent = '#E4572E';
const qrInk = '#1C1917';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const nama = url.searchParams.get('nama') || 'John Doe';
  const role = url.searchParams.get('role') || 'Software Engineer';
  const qrText = url.searchParams.get('qr') || 'https://github.com/johndoe';
  const gambarUrl = url.searchParams.get('gambar');
  const tagsParam = url.searchParams.get('tags') || 'Linux,Networking,Automation';
  const ig = url.searchParams.get('ig') || '@johndoe';
  const brandParam = url.searchParams.get('brand');
  const metaParam = url.searchParams.get('meta');
  const brand = brandParam === null ? 'SynchronizeTeams' : brandParam;
  const meta = metaParam === null ? 'ID / SVG' : metaParam;
  const website = url.searchParams.get('website') || 'johndoe.com';

  // (?dark, ?landscape also accept =true / theme=dark / pos=landscape)
  const isDark = url.searchParams.has('dark') || url.searchParams.get('theme') === 'dark';
  const isLandscape = url.searchParams.has('landscape') || url.searchParams.get('pos') === 'landscape';

  const c = isDark ? dark : light;

  // Parse image positioning & background custom settings
  const hasImgScale = url.searchParams.has('img_scale');
  const hasImgX = url.searchParams.has('img_x');
  const hasImgY = url.searchParams.has('img_y');

  let defaultScale = 1.0;
  let defaultX = 0;
  let defaultY = 0;

  // Presets to perfectly center and crop the default face avatar
  if (!gambarUrl) {
    if (isLandscape) {
      defaultScale = 1.0;
      defaultX = 0;
      defaultY = 30;
    } else {
      defaultScale = 1.33;
      defaultX = -26;
    }
  }

  const imgScale = hasImgScale ? parseFloat(url.searchParams.get('img_scale')!) : defaultScale;
  const imgX = hasImgX ? parseFloat(url.searchParams.get('img_x')!) : defaultX;
  const imgY = hasImgY ? parseFloat(url.searchParams.get('img_y')!) : defaultY;

  // Photo backdrop (paper stock by default, not a highlight colour)
  let imgBg = url.searchParams.get('img_bg') || '';
  if (!imgBg) {
    imgBg = isDark ? '#262220' : '#F1EDE5';
  } else if (/^[0-9a-fA-F]{3,8}$/.test(imgBg)) {
    imgBg = '#' + imgBg;
  }

  const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);

  const escapedNama = escapeXml(nama);
  const escapedIg = escapeXml(ig);
  const escapedWebsite = escapeXml(website);
  const escapedBrand = escapeXml(brand);
  const escapedMeta = escapeXml(meta);

  // long wordmarks step down instead of running into the corner label
  const brandFontSize = brand.length > 18 ? Math.max(7.5, 10.5 - (brand.length - 18) * 0.28) : 10.5;

  // Default avatar
  const assetsDir = path.join(process.cwd(), 'public', 'assets');
  let defaultFaceBase64 = '';
  try {
    const defaultFaceBuffer = fs.readFileSync(path.join(assetsDir, 'face.png'));
    defaultFaceBase64 = `data:image/png;base64,${defaultFaceBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Error reading default face image:', err);
  }

  // Avatar embedding: db:<id> | data: | remote URL
  let avatarBase64 = defaultFaceBase64;
  if (gambarUrl) {
    if (gambarUrl.startsWith('db:')) {
      const id = gambarUrl.substring(3);
      try {
        const { getDb } = await import('../../utils/db');
        const db = getDb();
        const stmt = db.prepare('SELECT file_path, mime_type FROM images WHERE id = ?');
        const row = stmt.get(id) as { file_path: string, mime_type: string } | undefined;

        if (row && fs.existsSync(row.file_path)) {
          const buffer = fs.readFileSync(row.file_path);
          avatarBase64 = `data:${row.mime_type};base64,${buffer.toString('base64')}`;
        }
      } catch (error) {
        console.error('Failed to retrieve image from SQLite database:', id, error);
      }
    } else if (gambarUrl.startsWith('data:image/')) {
      avatarBase64 = gambarUrl;
    } else {
      try {
        const response = await fetch(gambarUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());

          // Detect mime type from magic bytes
          let contentType = response.headers.get('content-type') || 'image/png';
          if (buffer.length > 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
            contentType = 'image/gif';
          } else if (buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            contentType = 'image/png';
          } else if (buffer.length > 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
            contentType = 'image/jpeg';
          }

          avatarBase64 = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      } catch (error) {
        console.error('Failed to fetch user avatar from url:', gambarUrl, error);
      }
    }
  }

  // QR code path — square; in landscape its side tracks the photo height.
  const AVATAR_BOX = isLandscape
    ? { x: 32, y: 68, w: 116, h: 155 }
    : { x: 226, y: 85, w: 156, h: 295 };
  const qrSide = isLandscape ? AVATAR_BOX.h : 130;
  const qrX = isLandscape ? 588 - qrSide : 38;

  let qrPath = '';
  let qrScale = 4.4;
  try {
    const qrSvg = await QRCode.toString(qrText, {
      type: 'svg',
      margin: 0,
      color: { dark: qrInk, light: '#ffffff' }
    });

    const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const qrGridSize = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : 25;
    // always exactly 4 modules of quiet zone per side, whatever the module count
    qrScale = qrSide / (qrGridSize + 8);

    const paths = qrSvg.match(/<path[^>]+>/g) || [];
    const strokePath = paths.find(p => p.includes('stroke='));
    const dMatch = strokePath ? strokePath.match(/d="([^"]+)"/) : null;

    if (dMatch) qrPath = dMatch[1];
  } catch (err) {
    console.error('Error generating QR code:', err);
  }

  // quiet zone actually drawn = 4 modules, same number the scale was computed with
  const qrPad = 4 * qrScale;

  // Dynamic font size for long names
  let nameFontSize = isLandscape ? 24 : 26;
  if (escapedNama.length > 16) {
    nameFontSize = Math.max(16, nameFontSize - (escapedNama.length - 16) * 0.45);
  }

  // Word-wrap long names so they never collide with the photo
  const nameLinesRaw = wrapText(nama, isLandscape ? 18 : 13);
  const nameLineHeight = nameFontSize * 1.08;
  const nameBlockH = nameLinesRaw.length * nameLineHeight;

  // Tags — justified rows inside the left column: every row closes on the same
  // right rail, slack is shared between chips, and a too-long label shrinks its
  // own type instead of crossing into the portrait.
  const TAG_GAP = 6;
  const TAG_H = 20;
  const TAG_ROW_H = 26;
  const tagX0 = isLandscape ? 176 : 38;
  const tagX1 = isLandscape ? qrX - 12 : 210;
  const tagBudget = tagX1 - tagX0;
  const tagCharW = 6.9; // 9.5px mono advance + 1.2 tracking
  const chipWidth = (label: string) => Math.max(44, label.length * tagCharW + 16);

  const labels = tags.map(t => t.toUpperCase());
  const rows: string[][] = [];
  let row: string[] = [];
  let rowWidth = 0;
  for (const label of labels) {
    const w = chipWidth(label);
    const grown = row.length ? rowWidth + TAG_GAP + w : w;
    if (row.length && grown > tagBudget) {
      rows.push(row);
      row = [label];
      rowWidth = w;
    } else {
      row.push(label);
      rowWidth = grown;
    }
  }
  if (row.length) rows.push(row);

  // Role wraps inside the text column (never under the photo/QR): 8.1px per char
  // at 10.5px mono + 1.8 tracking. Line count is bounded later by the photo band.
  const roleRight = (isLandscape ? qrX : AVATAR_BOX.x) - 8; // stop short of the QR/photo
  const roleMaxChars = Math.max(8, Math.floor(((roleRight - (isLandscape ? 190 : 52))) / 8.1));
  const roleLinesRaw = wrapText(role.toUpperCase(), roleMaxChars);
  const ROLE_LINE_H = 14;
  const roleBlockH = () => Math.max(1, roleLinesRaw.length) * ROLE_LINE_H;

  // --- vertical rhythm: the left stack is justified against the photo's height.
  // Few blocks → big gaps, many blocks → gaps tighten, overflow folds into "+N".
  const bandTop = isLandscape ? 68 : 85;
  const bandBottom = isLandscape ? 223 : 380;
  const band = bandBottom - bandTop;
  const qrSize = isLandscape ? 124 : 130;
  const gapCount = isLandscape ? 1 : 2; // name+role read as one block
  const ROLE_GAP = 6;                   // fixed: role hugs the name
  const tagsBlockH = () => rows.length * TAG_ROW_H - (TAG_ROW_H - TAG_H);
  const stackH = () => nameBlockH + ROLE_GAP + roleBlockH() + tagsBlockH() + (isLandscape ? 0 : qrSize);

  const MIN_GAP = 6;
  while (rows.length > 1 && band - stackH() < MIN_GAP * gapCount) {
    rows.pop();
    const tail = rows[rows.length - 1];
    const shownBefore = rows.slice(0, -1).reduce((n, r) => n + r.length, 0) + tail.length - 1;
    tail[tail.length - 1] = `+${labels.length - shownBefore}`;
  }
  while (roleLinesRaw.length > 1 && band - stackH() < MIN_GAP * gapCount) {
    roleLinesRaw.pop();
    roleLinesRaw[roleLinesRaw.length - 1] = roleLinesRaw[roleLinesRaw.length - 1].slice(0, -1) + '…';
  }

  const ROLE_H = roleBlockH();
  const gap = Math.max(MIN_GAP, (band - stackH()) / gapCount);
  const nameY = bandTop;
  const roleY = nameY + nameBlockH + ROLE_GAP;
  const qrY = isLandscape ? bandTop : roleY + ROLE_H + gap;
  const tagTop = isLandscape ? roleY + ROLE_H + gap : qrY + qrSize + gap;
  const nameBaseline = nameY + nameFontSize * 0.72; // cap height ≈ top of the block
  const roleBaseline = roleY + 10;

  let roleSvg = '';
  (roleLinesRaw.length ? roleLinesRaw : ['']).forEach((line, i) => {
    const safe = line.length > roleMaxChars ? line.slice(0, roleMaxChars - 1) + '…' : line;
    roleSvg += `<text x="${isLandscape ? 190 : 52}" y="${(roleBaseline + i * ROLE_LINE_H).toFixed(2)}" class="mono" font-weight="400" font-size="10.5" fill="${c.muted}" letter-spacing="1.8">${escapeXml(safe)}</text>\n      `;
  });

  let nameSvg = '';
  nameLinesRaw.forEach((line, i) => {
    const lineY = nameBaseline + (i * nameLineHeight);
    nameSvg += `<text x="${isLandscape ? 176 : 38}" y="${lineY.toFixed(2)}" class="display" font-weight="600" font-size="${nameFontSize}" fill="${c.text}" letter-spacing="-0.3">${escapeXml(line)}</text>\n      `;
  });

  let tagsSvg = '';
  rows.forEach((r, i) => {
    const y = tagTop + i * TAG_ROW_H;
    const natural = r.reduce((sum, label) => sum + chipWidth(label), 0) + TAG_GAP * (r.length - 1);
    const widen = Math.max(0, tagBudget - natural) / r.length;
    let x = tagX0;
    for (const label of r) {
      const w = Math.min(tagBudget, chipWidth(label) + widen);
      // 0.726 ≈ per-char width of the mono face at 1px, tracking included
      const fitted = Math.min(9.5, (w - 16) / (label.length * 0.726));
      const fontSize = Math.max(7, fitted);
      // absurdly long single label: shorten rather than drop below 7px type
      const shown = fitted >= 7 ? label : label.slice(0, Math.floor((w - 16) / (fontSize * 0.726)) - 1) + '…';
      tagsSvg += `
      <g>
        <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${TAG_H}" rx="2" fill="none" stroke="${c.chip}" stroke-width="1" />
        <text x="${(x + w / 2).toFixed(2)}" y="${(y + TAG_H / 2).toFixed(2)}" class="mono" font-weight="400" font-size="${fontSize.toFixed(2)}" fill="${c.muted}" text-anchor="middle" dominant-baseline="middle" letter-spacing="1.2">${escapeXml(shown)}</text>
      </g>
    `;
      x += w + TAG_GAP;
    }
  });

  // footer alignment: ig pinned left, website right-aligned to the same rail as the QR
  const monoAdvance = 6.3; // JetBrains Mono advance at 10.5px
  const igGroupX = isLandscape ? 32 : 38;
  const footerEndX = isLandscape ? 588 : 382;
  const webTextWidth = website.length * monoAdvance;
  const footerY = isLandscape ? 252 : 421;

  // shared glyphs: instagram mark + globe, hairline stroke
  const socialGlyphs = (x: number, y: number) => `<g transform="translate(${x}, ${y})">
        <rect x="0" y="2" width="14" height="14" rx="4" stroke="${c.muted}" stroke-width="1.4" fill="none" />
        <circle cx="7" cy="9" r="3" stroke="${c.muted}" stroke-width="1.4" fill="none" />
        <circle cx="11" cy="5" r="0.9" fill="${c.muted}" />
      </g>`;

  const websiteGlyph = (x: number, y: number) => `<g transform="translate(${x}, ${y})">
        <circle cx="7" cy="9" r="7" stroke="${c.muted}" stroke-width="1.4" fill="none" />
        <path d="M7 2 C10 5, 10 13, 7 16 C4 13, 4 5, 7 2" stroke="${c.muted}" stroke-width="1.1" fill="none" />
        <path d="M0 9h14" stroke="${c.muted}" stroke-width="1.1" />
      </g>`;

  const styleBlock = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap');
        .display { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; }
        .mono { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace; }
      </style>`;

  const avatarPattern = (x: number, y: number, w: number, h: number, origin: string) =>
    avatarBase64
      ? (avatarBase64.startsWith('data:image/gif')
        ? `<image href="${avatarBase64}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax slice" transform="translate(${imgX}, ${imgY}) scale(${imgScale})" />`
        : `<pattern id="avatar-pattern" x="${x}" y="${y}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
          <image href="${avatarBase64}" xlink:href="${avatarBase64}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMax slice" transform="translate(${imgX}, ${imgY}) scale(${imgScale})" transform-origin="${origin}" />
        </pattern>`)
      : '';

  const avatarFill = avatarBase64 && avatarBase64.startsWith('data:image/gif') ? 'none' : 'url(#avatar-pattern)';

  const socialFooter = (startX: number, endX: number) => `<!-- footer rule + socials -->
      <rect x="${startX}" y="${footerY}" width="${endX - startX}" height="1" fill="${c.line}" />
      <g transform="translate(${igGroupX}, ${footerY + 9})">
        ${socialGlyphs(0, 0)}
        <text x="26" y="9" class="mono" font-weight="400" font-size="10.5" fill="${c.text}" dominant-baseline="middle">${escapedIg}</text>
      </g>
      <g transform="translate(${footerEndX}, ${footerY + 9})">
        <g transform="translate(${-(webTextWidth + 26)}, 0)">
          ${websiteGlyph(0, 0)}
        </g>
        <text x="0" y="9" class="mono" font-weight="400" font-size="10.5" fill="${c.text}" text-anchor="end" dominant-baseline="middle">${escapedWebsite}</text>
      </g>`;

  let svgContent = '';

  if (isLandscape) {
    // Landscape SVG layout (620x320) — symmetric 22px inner padding, single rail
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 620 320" width="620" height="320" fill="none">
      <defs>
        ${avatarPattern(32, 68, 116, 155, '58 77.5')}
      </defs>
      ${styleBlock}

      <!-- card body -->
      <rect x="10" y="10" width="600" height="300" rx="2" fill="${c.card}" stroke="${c.line}" stroke-width="1" />

      <!-- header: accent rule, wordmark, meta -->
      <rect x="32" y="36" width="26" height="2" fill="${accent}" />
      <text x="32" y="52" class="mono" font-weight="500" font-size="${brandFontSize}" fill="${c.muted}" letter-spacing="2.4">${escapedBrand}</text>
      <text x="588" y="52" class="mono" font-weight="400" font-size="10" fill="${c.muted}" letter-spacing="2" text-anchor="end">${escapedMeta}</text>

      <!-- avatar -->
      <rect x="32" y="68" width="116" height="155" rx="2" fill="${imgBg}" />
      <rect x="32" y="68" width="116" height="155" rx="2" fill="${avatarFill}" stroke="${c.line}" stroke-width="1" />

      <!-- name + role -->
      ${nameSvg.trim()}
      <circle cx="180" cy="${(roleBaseline - 3.5).toFixed(2)}" r="3" fill="${accent}" />
      ${roleSvg.trim()}

      <!-- tags -->
      ${tagsSvg}

      <!-- qr -->
      <rect x="${qrX}" y="${AVATAR_BOX.y}" width="${qrSide}" height="${qrSide}" rx="2" fill="${c.qrBox}" stroke="${c.line}" stroke-width="1" />
      ${qrPath ? `<path d="${qrPath}" stroke="${qrInk}" stroke-width="1" shape-rendering="crispEdges" transform="translate(${(qrX + qrPad).toFixed(2)}, ${(AVATAR_BOX.y + qrPad).toFixed(2)}) scale(${qrScale.toFixed(3)})" />` : ''}

      ${socialFooter(32, 588)}
    </svg>`;
  } else {
    // Portrait SVG layout (420x490) — 28px inner padding
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 420 490" width="420" height="490" fill="none">
      <defs>
        ${avatarPattern(226, 85, 156, 295, '78 147.5')}
      </defs>
      ${styleBlock}

      <!-- card body -->
      <rect x="10" y="15" width="400" height="460" rx="2" fill="${c.card}" stroke="${c.line}" stroke-width="1" />

      <!-- header: accent rule, wordmark, meta -->
      <rect x="38" y="40" width="26" height="2" fill="${accent}" />
      <text x="38" y="56" class="mono" font-weight="500" font-size="${brandFontSize}" fill="${c.muted}" letter-spacing="2.4">${escapedBrand}</text>
      <text x="382" y="56" class="mono" font-weight="400" font-size="10" fill="${c.muted}" letter-spacing="2" text-anchor="end">${escapedMeta}</text>

      <!-- name + role -->
      ${nameSvg.trim()}
      <circle cx="42" cy="${(roleBaseline - 3.5).toFixed(2)}" r="3" fill="${accent}" />
      ${roleSvg.trim()}

      <!-- qr -->
      <rect x="${qrX}" y="${qrY.toFixed(2)}" width="${qrSide}" height="${qrSide}" rx="2" fill="${c.qrBox}" stroke="${c.line}" stroke-width="1" />
      ${qrPath ? `<path d="${qrPath}" stroke="${qrInk}" stroke-width="1" shape-rendering="crispEdges" transform="translate(${(qrX + qrPad).toFixed(2)}, ${(qrY + qrPad).toFixed(2)}) scale(${qrScale.toFixed(3)})" />` : ''}

      <!-- tags -->
      ${tagsSvg}

      <!-- avatar -->
      <rect x="${AVATAR_BOX.x}" y="${AVATAR_BOX.y}" width="${AVATAR_BOX.w}" height="${AVATAR_BOX.h}" rx="2" fill="${imgBg}" />
      <rect x="${AVATAR_BOX.x}" y="${AVATAR_BOX.y}" width="${AVATAR_BOX.w}" height="${AVATAR_BOX.h}" rx="2" fill="${avatarFill}" stroke="${c.line}" stroke-width="1" />

      ${socialFooter(38, 382)}
    </svg>`;
  }

  return new Response(svgContent, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    }
  });
};
