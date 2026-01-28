import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const staticDir = join(__dirname, '..', 'static');
const logoPath = join(staticDir, 'logo.svg');

// Read the SVG file
const svgBuffer = readFileSync(logoPath);

// Icon sizes to generate
const icons = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'maskable-icon-512.png', size: 512 },
];

// OG Image size (1200x630 with the logo centered)
const ogImageWidth = 1200;
const ogImageHeight = 630;

async function generateIcons() {
  console.log('🎨 Generating icons from logo.svg...\n');

  for (const icon of icons) {
    const outputPath = join(staticDir, icon.name);
    
    await sharp(svgBuffer)
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    
    console.log(`✅ Generated ${icon.name} (${icon.size}x${icon.size})`);
  }

  // Generate OG image with logo centered on a nice background
  const logoSize = 400;
  const resizedLogo = await sharp(svgBuffer)
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();

  // Create gradient background with logo centered
  const ogBackground = Buffer.from(`
    <svg width="${ogImageWidth}" height="${ogImageHeight}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <text x="${ogImageWidth / 2}" y="${ogImageHeight - 80}" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="48" 
            font-weight="bold"
            fill="#ffffff" 
            text-anchor="middle">
        Kiokun
      </text>
      <text x="${ogImageWidth / 2}" y="${ogImageHeight - 30}" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="24" 
            fill="#a0a0a0" 
            text-anchor="middle">
        Chinese &amp; Japanese Dictionary
      </text>
    </svg>
  `);

  await sharp(ogBackground)
    .composite([{
      input: resizedLogo,
      top: Math.floor((ogImageHeight - logoSize) / 2) - 40,
      left: Math.floor((ogImageWidth - logoSize) / 2)
    }])
    .png()
    .toFile(join(staticDir, 'og-image.png'));
  
  console.log(`✅ Generated og-image.png (${ogImageWidth}x${ogImageHeight})`);

  console.log('\n🎉 All icons generated successfully!');
}

generateIcons().catch(console.error);

