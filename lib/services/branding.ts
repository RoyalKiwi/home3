import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_PATH = process.env.DATA_PATH || './data';
const CACHE_PATH = path.join(DATA_PATH, 'cache');

interface IconSource {
  url: string;
  size: number;
  type: string;
}

/**
 * Fetch icon from a URL - supports both direct image URLs and website URLs
 * Priority: Direct image URL → Web App Manifest → Apple Touch Icon → Favicon
 */
export async function fetchIconFromUrl(appUrl: string): Promise<string | null> {
  try {
    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_PATH)) {
      fs.mkdirSync(CACHE_PATH, { recursive: true });
    }

    const url = new URL(appUrl);

    // Check if this is a direct image URL
    const pathname = url.pathname.toLowerCase();
    const isDirectImage = /\.(svg|png|jpg|jpeg|ico|webp|gif)$/.test(pathname);

    if (isDirectImage) {
      console.log(`🎯 Direct image URL detected: ${appUrl}`);

      // Download the image directly
      const iconBuffer = await downloadIcon(appUrl);
      if (!iconBuffer) {
        console.log('❌ Failed to download direct image');
        return null;
      }

      // Determine file extension from URL
      const extension = pathname.split('.').pop() || 'png';
      const hash = crypto.createHash('md5').update(appUrl).digest('hex');
      const filename = `${hash}.${extension}`;
      const filepath = path.join(CACHE_PATH, filename);

      // Save icon to cache
      fs.writeFileSync(filepath, iconBuffer);
      console.log(`💾 Saved direct image to: ${filepath}`);

      return `/cache/${filename}`;
    }

    // Otherwise, treat as website URL and search for icons
    const baseUrl = `${url.protocol}//${url.host}`;
    console.log(`🔍 Fetching icon for website: ${baseUrl}`);

    // Try to find the best icon source
    const iconSource = await findBestIconSource(baseUrl);

    if (!iconSource) {
      console.log('❌ No icon found');
      return null;
    }

    console.log(`✅ Found icon: ${iconSource.url} (${iconSource.size}px)`);

    // Download the icon
    const iconBuffer = await downloadIcon(iconSource.url);

    if (!iconBuffer) {
      console.log('❌ Failed to download icon');
      return null;
    }

    // Generate hash-based filename
    const hash = crypto.createHash('md5').update(baseUrl).digest('hex');
    const extension = getExtensionFromType(iconSource.type) || 'png';
    const filename = `${hash}.${extension}`;
    const filepath = path.join(CACHE_PATH, filename);

    // Save icon to cache
    fs.writeFileSync(filepath, iconBuffer);
    console.log(`💾 Saved icon to: ${filepath}`);

    // Return relative path from /data
    return `/cache/${filename}`;
  } catch (error) {
    console.error('Icon fetch error:', error);
    return null;
  }
}

/**
 * Find the best icon source by checking manifest and standard locations
 */
async function findBestIconSource(baseUrl: string): Promise<IconSource | null> {
  // 1. Try Web App Manifest
  const manifestIcon = await checkWebAppManifest(baseUrl);
  if (manifestIcon) return manifestIcon;

  // 2. Try Apple Touch Icon (multiple sizes)
  const appleTouchSizes = [180, 152, 144, 120, 114, 76, 72, 60, 57];
  for (const size of appleTouchSizes) {
    const url = `${baseUrl}/apple-touch-icon-${size}x${size}.png`;
    if (await urlExists(url)) {
      return { url, size, type: 'image/png' };
    }
  }

  // Try generic apple-touch-icon.png
  const genericAppleIcon = `${baseUrl}/apple-touch-icon.png`;
  if (await urlExists(genericAppleIcon)) {
    return { url: genericAppleIcon, size: 180, type: 'image/png' };
  }

  // 3. Try Favicon (multiple formats)
  const faviconFormats = [
    { path: '/favicon.ico', type: 'image/x-icon', size: 32 },
    { path: '/favicon.png', type: 'image/png', size: 32 },
    { path: '/favicon.svg', type: 'image/svg+xml', size: 999 }, // SVG is scalable
  ];

  for (const favicon of faviconFormats) {
    const url = `${baseUrl}${favicon.path}`;
    if (await urlExists(url)) {
      return { url, size: favicon.size, type: favicon.type };
    }
  }

  return null;
}

/**
 * Check Web App Manifest for icons
 */
async function checkWebAppManifest(baseUrl: string): Promise<IconSource | null> {
  try {
    // Fetch the HTML to find manifest link
    const htmlResponse = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Homepage3/1.0)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!htmlResponse.ok) return null;

    const html = await htmlResponse.text();

    // Find manifest link
    const manifestMatch = html.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i);
    if (!manifestMatch) return null;

    let manifestUrl = manifestMatch[1];

    // Handle relative URLs
    if (manifestUrl.startsWith('/')) {
      manifestUrl = `${baseUrl}${manifestUrl}`;
    } else if (!manifestUrl.startsWith('http')) {
      manifestUrl = `${baseUrl}/${manifestUrl}`;
    }

    // Fetch manifest
    const manifestResponse = await fetch(manifestUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Homepage3/1.0)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!manifestResponse.ok) return null;

    const manifest = await manifestResponse.json();

    // Find largest icon
    if (!manifest.icons || !Array.isArray(manifest.icons)) return null;

    let bestIcon: IconSource | null = null;

    for (const icon of manifest.icons) {
      if (!icon.src) continue;

      let iconUrl = icon.src;

      // Handle relative URLs
      if (iconUrl.startsWith('/')) {
        iconUrl = `${baseUrl}${iconUrl}`;
      } else if (!iconUrl.startsWith('http')) {
        iconUrl = `${baseUrl}/${iconUrl}`;
      }

      // Parse size (e.g., "192x192" or "any")
      const size = icon.sizes === 'any' ? 512 : parseInt(icon.sizes?.split('x')[0] || '0');
      const type = icon.type || 'image/png';

      if (!bestIcon || size > bestIcon.size) {
        bestIcon = { url: iconUrl, size, type };
      }
    }

    return bestIcon;
  } catch (error) {
    console.error('Manifest check error:', error);
    return null;
  }
}

/**
 * Check if a URL exists (HEAD request)
 */
async function urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Homepage3/1.0)' },
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Download icon and return buffer
 */
async function downloadIcon(url: string): Promise<Buffer | null> {
  try {
    console.log(`📥 Downloading icon from: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Homepage3/1.0)',
        'Accept': 'image/*,*/*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`❌ Download failed: ${response.status} ${response.statusText}`);
      return null;
    }

    console.log(`✅ Download successful: ${response.headers.get('content-type')}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`💾 Downloaded ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error('❌ Download error:', error);
    return null;
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromType(type: string): string | null {
  const types: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
  };
  return types[type.toLowerCase()] || null;
}

/**
 * Save uploaded file to uploads directory
 */
export function saveUploadedIcon(buffer: Buffer, filename: string): string {
  const UPLOADS_PATH = path.join(DATA_PATH, 'uploads');

  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_PATH)) {
    fs.mkdirSync(UPLOADS_PATH, { recursive: true });
  }

  // Generate unique filename
  const hash = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(filename);
  const uniqueFilename = `${hash}${extension}`;
  const filepath = path.join(UPLOADS_PATH, uniqueFilename);

  // Save file
  fs.writeFileSync(filepath, buffer);
  console.log(`💾 Saved uploaded icon to: ${filepath}`);

  // Return relative path from /data
  return `/uploads/${uniqueFilename}`;
}
