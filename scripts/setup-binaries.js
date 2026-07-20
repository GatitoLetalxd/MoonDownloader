import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_WINDOWS = process.platform === 'win32';
const BIN_DIR = path.join(__dirname, '..', 'bin');
const YTDLP_BINARY = IS_WINDOWS ? 'yt-dlp.exe' : 'yt-dlp';
const YTDLP_PATH = path.join(BIN_DIR, YTDLP_BINARY);

// Select the correct download URL based on platform
const YTDLP_URLS = {
  win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
};
const YTDLP_URL = YTDLP_URLS[process.platform] || YTDLP_URLS.linux;

// Helper function to download following redirects
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = https.get(url, (response) => {
      // Handle redirects
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download binary: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

export async function setupBinaries(force = false) {
  try {
    if (!fs.existsSync(BIN_DIR)) {
      fs.mkdirSync(BIN_DIR, { recursive: true });
    }

    if (fs.existsSync(YTDLP_PATH) && !force) {
      console.log(`[Setup] ${YTDLP_BINARY} already installed at: ${YTDLP_PATH}`);
      return YTDLP_PATH;
    }

    console.log(`[Setup] Platform: ${process.platform} → downloading ${YTDLP_BINARY}`);
    console.log(`[Setup] URL: ${YTDLP_URL}`);

    await downloadFile(YTDLP_URL, YTDLP_PATH);

    // Make executable on Linux/macOS
    if (!IS_WINDOWS) {
      fs.chmodSync(YTDLP_PATH, 0o755);
      console.log(`[Setup] Set executable permissions on ${YTDLP_BINARY}`);
    }

    console.log(`[Setup] ${YTDLP_BINARY} downloaded successfully to ${YTDLP_PATH}`);
    return YTDLP_PATH;
  } catch (error) {
    console.error(`[Setup] Error setting up binaries:`, error.message);
    throw error;
  }
}

// Run directly if executed as a script
if (process.argv[1] === __filename || process.argv[1].endsWith('setup-binaries.js')) {
  setupBinaries()
    .then(() => console.log('[Setup] Binary setup complete!'))
    .catch((err) => {
      console.error('[Setup] Binary setup failed:', err);
      process.exit(1);
    });
}
