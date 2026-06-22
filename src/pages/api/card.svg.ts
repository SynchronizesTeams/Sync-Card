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

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const nama = url.searchParams.get('nama') || 'John Doe';
  const role = url.searchParams.get('role') || 'Software Engineer';
  const qrText = url.searchParams.get('qr') || 'https://github.com/johndoe';
  const gambarUrl = url.searchParams.get('gambar');
  const tagsParam = url.searchParams.get('tags') || 'HTML,CSS,JavaScript,React';
  const ig = url.searchParams.get('ig') || '@johndoe';
  const website = url.searchParams.get('website') || 'johndoe.com';

  // Check config flags (supports ?dark, ?dark=true, ?landscape, ?landscape=true)
  const isDark = url.searchParams.has('dark') || url.searchParams.get('dark') === 'true' || url.searchParams.get('theme') === 'dark';
  const isLandscape = url.searchParams.has('landscape') || url.searchParams.get('landscape') === 'true' || url.searchParams.get('pos') === 'landscape';

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
      defaultScale = 1.5;
      defaultX = -34;
    } else {
      defaultScale = 1.33;
      defaultX = -26;
    }
  }

  const imgScale = hasImgScale ? parseFloat(url.searchParams.get('img_scale')!) : defaultScale;
  const imgX = hasImgX ? parseFloat(url.searchParams.get('img_x')!) : defaultX;
  const imgY = hasImgY ? parseFloat(url.searchParams.get('img_y')!) : defaultY;

  // Custom photo background color parameter
  let imgBg = url.searchParams.get('img_bg') || '';
  if (!imgBg) {
    imgBg = isDark ? '#3b82f6' : '#fca2a2';
  } else if (/^[0-9a-fA-F]{3,8}$/.test(imgBg)) {
    imgBg = '#' + imgBg;
  }

  const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);

  // Transform and escape text inputs
  const uppercasedNama = nama.toUpperCase();
  const escapedNama = escapeXml(uppercasedNama);

  const uppercasedRole = role.toUpperCase();
  const escapedRole = escapeXml(uppercasedRole);

  const escapedIg = escapeXml(ig);
  const escapedWebsite = escapeXml(website);

  // Setup paths for default images
  const assetsDir = path.join(process.cwd(), 'public', 'assets');
  let defaultFaceBase64 = '';
  let logoBase64 = '';

  try {
    const defaultFaceBuffer = fs.readFileSync(path.join(assetsDir, 'face.png'));
    defaultFaceBase64 = `data:image/png;base64,${defaultFaceBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Error reading default face image:', err);
  }

  try {
    const logoBuffer = fs.readFileSync(path.join(assetsDir, 'SynchronizeTeams Logo Dark(1)(1).png'));
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Error reading logo image:', err);
  }

  // Handle avatar image embedding (fetch from web, read base64 raw, or load path from SQLite images.db)
  let avatarBase64 = defaultFaceBase64;
  if (gambarUrl) {
    if (gambarUrl.startsWith('db:')) {
      const id = gambarUrl.substring(3);
      try {
        const Database = (await import('better-sqlite3')).default;
        const dbPath = path.join(process.cwd(), 'images.db');
        const db = new Database(dbPath);
        
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
          const arrayBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'image/png';
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          avatarBase64 = `data:${contentType};base64,${base64}`;
        }
      } catch (error) {
        console.error('Failed to fetch user avatar from url:', gambarUrl, error);
      }
    }
  }

  // Generate QR Code path
  let qrPath = '';
  let qrScale = 4.4; 
  const qrTargetSize = isLandscape ? 116 : 110;
  try {
    const qrSvg = await QRCode.toString(qrText, {
      type: 'svg',
      margin: 0,
      color: {
        dark: '#111111',
        light: '#ffffff'
      }
    });

    const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const qrGridSize = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : 25;
    qrScale = qrTargetSize / qrGridSize;

    const paths = qrSvg.match(/<path[^>]+>/g) || [];
    const strokePath = paths.find(p => p.includes('stroke='));
    const dMatch = strokePath ? strokePath.match(/d="([^"]+)"/) : null;
    
    if (dMatch) {
      qrPath = dMatch[1];
    }
  } catch (err) {
    console.error('Error generating QR code:', err);
  }

  // Calculate dynamic font size for name if too long
  let nameFontSize = 24;
  if (uppercasedNama.length > 15) {
    nameFontSize = Math.max(16, 24 - (uppercasedNama.length - 15) * 0.4);
  }

  // Word-wrap long names to prevent collisions with the photo card
  const maxChars = isLandscape ? 18 : 12;
  const nameLinesRaw = wrapText(uppercasedNama, maxChars);
  const nameLineHeight = nameFontSize * 1.05;
  const nameOffset = (nameLinesRaw.length - 1) * nameLineHeight;

  // Define Theme Color Variables
  const strokeColor = isDark ? '#ffffff' : '#111111';
  const shadowColor = isDark ? '#ffffff' : '#111111';
  const textColor = isDark ? '#ffffff' : '#111111';
  const subtitleColor = isDark ? '#60a5fa' : '#3a86c8';
  const cardBgColor = isDark ? '#1e1e1e' : '#ffffff';
  const barBgColor = isDark ? '#262626' : '#ffffff';
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(17, 17, 17, 0.05)';

  let nameSvg = '';
  nameLinesRaw.forEach((line, i) => {
    const escapedLine = escapeXml(line);
    const lineY = (isLandscape ? 79 : 98) + (i * nameLineHeight);
    nameSvg += `<text x="${isLandscape ? 157 : 33}" y="${lineY}" class="font-poppins" font-weight="900" font-size="${nameFontSize}" fill="${textColor}" letter-spacing="-0.5">${escapedLine}</text>\n      `;
  });

  // Define Tag Colors
  const colors = isDark 
    ? ['#3b82f6', '#f43f5e', '#10b981', '#d946ef'] 
    : ['#a2c2fc', '#fca2a2', '#a2fca2', '#fca2fc']; 
  const tagTextColor = isDark ? '#ffffff' : '#111111';

  // Calculate dynamic positioning for Tags (shifted by nameOffset)
  const tagLimitX = isLandscape ? 430 : 200;
  let curX = isLandscape ? 157 : 33;
  let curY = isLandscape ? 119 + nameOffset : 290 + nameOffset;
  let tagsSvg = '';

  tags.forEach((tag, index) => {
    const uppercasedTag = tag.toUpperCase();
    const tagW = Math.max(50, uppercasedTag.length * 7 + 22);
    if (curX + tagW > tagLimitX) {
      curX = isLandscape ? 157 : 33;
      curY += 28;
    }
    const color = colors[index % colors.length];
    const escapedTag = escapeXml(uppercasedTag);
    tagsSvg += `
      <g>
        <rect x="${curX}" y="${curY}" width="${tagW}" height="22" rx="11" fill="${color}" stroke="${strokeColor}" stroke-width="2" />
        <text x="${curX + tagW/2}" y="${curY + 11}" font-family="'Poppins', system-ui, -apple-system, sans-serif" font-weight="700" font-size="10.5" fill="${tagTextColor}" text-anchor="middle" dominant-baseline="middle" letter-spacing="0.5">${escapedTag}</text>
      </g>
    `;
    curX += tagW + 6;
  });

  // Dynamic Alignment calculations for footer text/icons inside the bar (justify-between alignment)
  const igTextWidth = ig.length * 7.5 + 24; 
  const webTextWidth = website.length * 7.5 + 24;

  let igGroupX = 0;
  let webGroupX = 0;

  if (isLandscape) {
    igGroupX = 157 + 24; // 24px padding from left edge of footer bar
    webGroupX = 583 - 24 - webTextWidth; // 24px padding from right edge of footer bar
  } else {
    igGroupX = 33 + 20; // 20px padding from left edge of footer bar
    webGroupX = 377 - 20 - webTextWidth; // 20px padding from right edge of footer bar
  }

  // --- SVG View Templates ---
  let svgContent = '';

  if (isLandscape) {
    // Landscape SVG layout (620x320)
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 320" width="620" height="320" fill="none">
      <defs>
        <!-- Background grid pattern -->
        <pattern id="card-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${gridStroke}" stroke-width="1"/>
        </pattern>
        
        <!-- Avatar image pattern (acts as a robust clipping container with zoom/pan transforms) -->
        ${avatarBase64 ? `
        <pattern id="avatar-pattern" x="21" y="57" width="120" height="200" patternUnits="userSpaceOnUse">
          <image href="${avatarBase64}" x="0" y="0" width="120" height="200" preserveAspectRatio="xMidYMax slice" transform="translate(${imgX}, ${imgY}) scale(${imgScale})" transform-origin="60 100" />
        </pattern>` : ''}

        <!-- Dark Mode Invert Filter for Logo -->
        ${isDark ? `
        <filter id="invert-logo">
          <feColorMatrix type="matrix" values="
            -1  0  0  0  1
             0 -1  0  0  1
             0  0 -1  0  1
             0  0  0  1  0" />
        </filter>` : ''}
      </defs>

      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&amp;display=swap');
        .font-poppins { font-family: 'Poppins', system-ui, -apple-system, sans-serif; }
      </style>

      <!-- Card Shadow -->
      <rect x="15" y="15" width="600" height="300" rx="16" fill="${shadowColor}" />

      <!-- Card Body Background -->
      <rect x="5" y="5" width="600" height="300" rx="16" fill="${cardBgColor}" />
      
      <!-- Card Body Grid Overlay & Main Border -->
      <rect x="5" y="5" width="600" height="300" rx="16" fill="url(#card-grid)" stroke="${strokeColor}" stroke-width="3" />

      <!-- Left Column (Avatar Image) -->
      <!-- Image Shadow -->
      <rect x="25" y="61" width="120" height="200" rx="12" fill="${shadowColor}" />
      <!-- Image Background (Fills with custom color imgBg) -->
      <rect x="21" y="57" width="120" height="200" rx="12" fill="${imgBg}" />
      <!-- Image body filled with pattern to guarantee perfect overflow clipping in sandboxed contexts -->
      <rect x="21" y="57" width="120" height="200" rx="12" fill="url(#avatar-pattern)" stroke="${strokeColor}" stroke-width="3" />

      <!-- Middle Column (Profile Info) -->
      <!-- Logo -->
      <g transform="translate(205, 15)">
        ${logoBase64 ? `<image href="${logoBase64}" width="200" height="42" preserveAspectRatio="xMidYMid meet" ${isDark ? 'filter="url(#invert-logo)" style="filter: invert(1) brightness(2);"' : ''} />` : ''}
      </g>
      <!-- Name -->
      ${nameSvg.trim()}
      <!-- Role -->
      <text x="157" y="${99 + nameOffset}" class="font-poppins" font-weight="600" font-size="13" fill="${subtitleColor}" letter-spacing="0.5">${escapedRole}</text>

      <!-- Dynamic Tags -->
      ${tagsSvg}

      <!-- Social Footer Bar -->
      <!-- Shadow -->
      <rect x="161" y="211" width="426" height="44" rx="12" fill="${shadowColor}" />
      <!-- Body -->
      <rect x="157" y="207" width="426" height="44" rx="12" fill="${barBgColor}" stroke="${strokeColor}" stroke-width="3" />

      <!-- Instagram Handle -->
      <g transform="translate(${igGroupX}, 217)">
        <rect x="0" y="2" width="20" height="20" rx="5" ry="5" stroke="${strokeColor}" stroke-width="2.5" fill="none" />
        <circle cx="10" cy="12" r="4" stroke="${strokeColor}" stroke-width="2.5" fill="none" />
        <circle cx="15" cy="7" r="1" fill="${strokeColor}" />
        <text x="28" y="12" class="font-poppins" font-weight="700" font-size="12" fill="${textColor}" dominant-baseline="middle">${escapedIg}</text>
      </g>

      <!-- Website Link -->
      <g transform="translate(${webGroupX}, 217)">
        <circle cx="10" cy="12" r="10" stroke="${strokeColor}" stroke-width="2.5" fill="none" />
        <path d="M10 2 C14.5 6, 14.5 18, 10 22 C5.5 18, 5.5 6, 10 2" stroke="${strokeColor}" stroke-width="2" fill="none" />
        <path d="M0 12h20" stroke="${strokeColor}" stroke-width="2" />
        <text x="28" y="12" class="font-poppins" font-weight="700" font-size="12" fill="${textColor}" dominant-baseline="middle">${escapedWebsite}</text>
      </g>

      <!-- Right Column (QR Code) -->
      <!-- Box Shadow -->
      <rect x="451" y="61" width="136" height="136" rx="12" fill="${shadowColor}" />
      <!-- Box Body -->
      <rect x="447" y="57" width="136" height="136" rx="12" fill="#ffffff" stroke="${strokeColor}" stroke-width="3" />
      <!-- Dynamic QR Code Path -->
      ${qrPath ? `<path d="${qrPath}" stroke="#111111" stroke-width="1" shape-rendering="crispEdges" transform="translate(457, 67) scale(${qrScale})" />` : ''}
    </svg>`;
  } else {
    // Portrait SVG layout (420x490)
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 490" width="420" height="490" fill="none">
      <defs>
        <!-- Background grid pattern -->
        <pattern id="card-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${gridStroke}" stroke-width="1"/>
        </pattern>
        
        <!-- Avatar image pattern (acts as a robust clipping container with zoom/pan transforms) -->
        ${avatarBase64 ? `
        <pattern id="avatar-pattern" x="221" y="80" width="156" height="295" patternUnits="userSpaceOnUse">
          <image href="${avatarBase64}" x="0" y="0" width="156" height="295" preserveAspectRatio="xMidYMax slice" transform="translate(${imgX}, ${imgY}) scale(${imgScale})" transform-origin="78 147.5" />
        </pattern>` : ''}

        <!-- Dark Mode Invert Filter for Logo -->
        ${isDark ? `
        <filter id="invert-logo">
          <feColorMatrix type="matrix" values="
            -1  0  0  0  1
             0 -1  0  0  1
             0  0 -1  0  1
             0  0  0  1  0" />
        </filter>` : ''}
      </defs>

      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&amp;display=swap');
        .font-poppins { font-family: 'Poppins', system-ui, -apple-system, sans-serif; }
      </style>

      <!-- Card Shadow -->
      <rect x="15" y="20" width="400" height="460" rx="16" fill="${shadowColor}" />

      <!-- Card Body Background -->
      <rect x="5" y="10" width="400" height="460" rx="16" fill="${cardBgColor}" />
      
      <!-- Card Body Grid Overlay & Main Border -->
      <rect x="5" y="10" width="400" height="460" rx="16" fill="url(#card-grid)" stroke="${strokeColor}" stroke-width="3" />

      <!-- Logo -->
      <g transform="translate(85, 20)">
        ${logoBase64 ? `<image href="${logoBase64}" width="240" height="52" preserveAspectRatio="xMidYMid meet" ${isDark ? 'filter="url(#invert-logo)" style="filter: invert(1) brightness(2);"' : ''} />` : ''}
      </g>

      <!-- Left Column -->
      <!-- Name -->
      ${nameSvg.trim()}
      <!-- Role -->
      <text x="33" y="${118 + nameOffset}" class="font-poppins" font-weight="600" font-size="13" fill="${subtitleColor}" letter-spacing="0.5">${escapedRole}</text>

      <!-- QR Code border & box -->
      <rect x="33" y="${145 + nameOffset}" width="130" height="130" rx="12" fill="#ffffff" stroke="${strokeColor}" stroke-width="3" />
      <!-- Dynamic QR Code Path with crisp edge rendering -->
      ${qrPath ? `<path d="${qrPath}" stroke="#111111" stroke-width="1" shape-rendering="crispEdges" transform="translate(43, ${155 + nameOffset}) scale(${qrScale})" />` : ''}

      <!-- Dynamic Tags -->
      ${tagsSvg}

      <!-- Right Column (Avatar Image) -->
      <!-- Image Shadow -->
      <rect x="225" y="84" width="156" height="295" rx="12" fill="${shadowColor}" />
      <!-- Image Background (Fills with custom color imgBg) -->
      <rect x="221" y="80" width="156" height="295" rx="12" fill="${imgBg}" />
      <!-- Image body filled with pattern to guarantee perfect overflow clipping in sandboxed contexts -->
      <rect x="221" y="80" width="156" height="295" rx="12" fill="url(#avatar-pattern)" stroke="${strokeColor}" stroke-width="3" />

      <!-- Bottom Social Footer Bar Shadow -->
      <rect x="37" y="414" width="344" height="44" rx="12" fill="${shadowColor}" />
      <!-- Bottom Social Footer Bar Body -->
      <rect x="33" y="410" width="344" height="44" rx="12" fill="${barBgColor}" stroke="${strokeColor}" stroke-width="3" />

      <!-- Instagram Handle -->
      <g transform="translate(${igGroupX}, 420)">
        <rect x="0" y="2" width="20" height="20" rx="5" ry="5" stroke="${strokeColor}" stroke-width="2.5" fill="none" />
        <circle cx="10" cy="12" r="4" stroke="${strokeColor}" stroke-width="2.5" fill="none" />
        <circle cx="15" cy="7" r="1" fill="${strokeColor}" />
        <text x="28" y="12" class="font-poppins" font-weight="700" font-size="12" fill="${textColor}" dominant-baseline="middle">${escapedIg}</text>
      </g>

      <!-- Website Link -->
      <g transform="translate(${webGroupX}, 420)">
        <circle cx="10" cy="12" r="10" stroke="${strokeColor}" stroke-width="2.5" fill="none" />
        <path d="M10 2 C14.5 6, 14.5 18, 10 22 C5.5 18, 5.5 6, 10 2" stroke="${strokeColor}" stroke-width="2" fill="none" />
        <path d="M0 12h20" stroke="${strokeColor}" stroke-width="2" />
        <text x="28" y="12" class="font-poppins" font-weight="700" font-size="12" fill="${textColor}" dominant-baseline="middle">${escapedWebsite}</text>
      </g>
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
