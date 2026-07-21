import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { exec, execFile, spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { setupBinaries } from './scripts/setup-binaries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration (from .env) ────────────────────────────────────────────────
const PORT = process.env.PORT || 3003;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 3;
const FILE_RETENTION_MIN = parseInt(process.env.FILE_RETENTION_MINUTES) || 5;
const TASK_CLEANUP_MIN = parseInt(process.env.TASK_CLEANUP_MINUTES) || 30;

// ─── Platform-aware paths ─────────────────────────────────────────────────────
const IS_WINDOWS = process.platform === 'win32';
const BIN_DIR = path.join(__dirname, 'bin');
const YTDLP_BINARY = IS_WINDOWS ? 'yt-dlp.exe' : 'yt-dlp';
const YTDLP_PATH = path.join(BIN_DIR, YTDLP_BINARY);
const DOWNLOADS_DIR = path.resolve(process.env.DOWNLOADS_DIR || path.join(__dirname, 'downloads'));
const COOKIES_PATH = process.env.YOUTUBE_COOKIES_PATH || path.join(__dirname, 'cookies.txt');

// Ensure directories exist
[DOWNLOADS_DIR, path.join(__dirname, 'logs')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Structured logger ───────────────────────────────────────────────────────
function log(level, tag, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] [${tag}] ${message}`);
}

// Helper to construct yt-dlp arguments with JS runtime & Cookies support
function getYtDlpArgs(extraArgs = []) {
  const args = [
    '--js-runtimes', 'deno'
  ];

  if (fs.existsSync(COOKIES_PATH)) {
    // Create an isolated temp copy to prevent yt-dlp from deleting/corrupting main cookies.txt on set-cookie responses
    const tempCookiesPath = path.join(DOWNLOADS_DIR, `cookies_temp_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
    try {
      fs.copyFileSync(COOKIES_PATH, tempCookiesPath);
      args.push('--cookies', tempCookiesPath);
      setTimeout(() => {
        try { if (fs.existsSync(tempCookiesPath)) fs.unlinkSync(tempCookiesPath); } catch {}
      }, 60000);
    } catch (e) {
      args.push('--cookies', COOKIES_PATH);
    }
  }

  return [...args, ...extraArgs];
}

// Format friendly error messages for YouTube restrictions
function parseYtDlpError(rawError) {
  const msg = rawError || '';
  if (msg.includes("cookies are no longer valid") || msg.includes("rotated in the browser")) {
    return "Google ha desactivado las cookies anteriores al detectar actividad en tu navegador. Por favor, haz clic en 'Cookies' en el menú superior y pega unas cookies nuevas (se recomienda exportarlas desde una ventana de Incógnito).";
  }
  if (msg.includes("Sign in to confirm you’re not a bot") || msg.includes("Sign in to confirm you're not a bot")) {
    return "YouTube ha bloqueado temporalmente las solicitudes de este servidor. Se requiere actualizar las cookies haciendo clic en el botón 'Cookies' arriba.";
  }
  if (msg.includes("Video unavailable") || msg.includes("Private video")) {
    return "El vídeo no está disponible o es privado.";
  }
  return "Ocurrió un error al procesar el enlace. Por favor, verifica la URL e inténtalo nuevamente.";
}

// ─── Express setup ───────────────────────────────────────────────────────────
const app = express();

// Security & performance middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// CORS — restrict to configured origin in production
app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN,
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Trust proxy (needed behind Nginx for correct IP-based rate limiting)
app.set('trust proxy', 1);

// Rate limiters
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Por favor, espera un momento e intenta de nuevo.' }
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas descargas solicitadas. Por favor, espera un momento.' }
});

// ─── Downloads state ─────────────────────────────────────────────────────────
const activeDownloads = {};

function broadcastProgress(task) {
  const data = JSON.stringify({
    id: task.id,
    title: task.title,
    thumbnail: task.thumbnail,
    status: task.status,
    progress: task.progress,
    speed: task.speed,
    eta: task.eta,
    filename: task.filename,
    error: task.error,
    url: task.url,
    format: task.format,
    quality: task.quality
  });

  task.clients = task.clients.filter(client => {
    try {
      client.res.write(`data: ${data}\n\n`);
      return true;
    } catch (e) {
      return false;
    }
  });
}

// ─── File serving (safe against directory traversal) ─────────────────────────
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  let filePath = path.join(DOWNLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    const sanitized = safeFilename.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.').trim();
    const sanitizedPath = path.join(DOWNLOADS_DIR, sanitized);
    if (fs.existsSync(sanitizedPath)) {
      filePath = sanitizedPath;
    }
  }

  if (!fs.existsSync(filePath)) {
    try {
      const files = fs.readdirSync(DOWNLOADS_DIR);
      const strip = (name) => name.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = strip(safeFilename);
      const matched = files.find(f => strip(f) === target);
      if (matched) {
        filePath = path.join(DOWNLOADS_DIR, matched);
      }
    } catch (e) {
      log('ERROR', 'FileServe', `Fallback error: ${e.message}`);
    }
  }

  if (fs.existsSync(filePath)) {
    const retentionMs = FILE_RETENTION_MIN * 60 * 1000;
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          log('INFO', 'Cleanup', `Auto-deleted file after ${FILE_RETENTION_MIN}min: ${path.basename(filePath)}`);
        }
      } catch (e) {
        log('WARN', 'Cleanup', `Could not auto-delete: ${e.message}`);
      }
    }, retentionMs);

    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        log('ERROR', 'FileServe', `Download error: ${err.message}`);
        if (!res.headersSent) res.status(500).json({ error: 'Error al descargar el archivo.' });
      }
    });
  } else {
    res.status(404).json({ error: 'El archivo solicitado ya no existe o fue eliminado por tiempo de retención.' });
  }
});

// ─── API Endpoints ───────────────────────────────────────────────────────────

// Status check
app.get('/api/status', (req, res) => {
  const ytDlpReady = fs.existsSync(YTDLP_PATH);
  const ffmpegReady = !!ffmpegPath && fs.existsSync(ffmpegPath);
  const hasCookies = fs.existsSync(COOKIES_PATH);

  res.json({
    ytDlpReady,
    ffmpegReady,
    hasCookies,
    ffmpegPath: ffmpegReady ? ffmpegPath : null,
    downloadsDir: DOWNLOADS_DIR,
    activeDownloads: Object.values(activeDownloads).filter(t => ['downloading', 'processing', 'queued'].includes(t.status)).length,
    maxConcurrent: MAX_CONCURRENT
  });
});

// Manage cookies.txt
app.get('/api/cookies', (req, res) => {
  const exists = fs.existsSync(COOKIES_PATH);
  let size = 0;
  let updatedAt = null;

  if (exists) {
    const stats = fs.statSync(COOKIES_PATH);
    size = stats.size;
    updatedAt = stats.mtime;
  }

  res.json({ exists, size, updatedAt });
});

app.post('/api/cookies', (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Se requiere el contenido del archivo cookies.txt en texto plano.' });
  }

  try {
    fs.writeFileSync(COOKIES_PATH, content.trim(), 'utf-8');
    log('INFO', 'Cookies', `cookies.txt guardado exitosamente (${content.length} bytes)`);
    res.json({ success: true, message: 'cookies.txt guardado correctamente.' });
  } catch (error) {
    log('ERROR', 'Cookies', error.message);
    res.status(500).json({ error: `Error al guardar cookies.txt: ${error.message}` });
  }
});

app.delete('/api/cookies', (req, res) => {
  try {
    if (fs.existsSync(COOKIES_PATH)) {
      fs.unlinkSync(COOKIES_PATH);
      log('INFO', 'Cookies', 'cookies.txt eliminado');
    }
    res.json({ success: true, message: 'cookies.txt eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: `Error al eliminar cookies.txt: ${error.message}` });
  }
});

// Install yt-dlp binary
app.post('/api/setup', async (req, res) => {
  try {
    await setupBinaries(true);
    res.json({ success: true, message: 'Descargador instalado con éxito.' });
  } catch (error) {
    res.status(500).json({ error: `Error al instalar: ${error.message}` });
  }
});

// Search YouTube
app.get('/api/search', searchLimiter, (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Falta el parámetro de búsqueda (q).' });
  if (!fs.existsSync(YTDLP_PATH)) return res.status(500).json({ error: 'El descargador no está listo. Por favor, instálalo.' });

  log('INFO', 'Search', `Query: "${q}"`);

  const args = getYtDlpArgs([
    '--dump-json',
    '--flat-playlist',
    `ytsearch6:${q}`
  ]);

  execFile(YTDLP_PATH, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error && !stdout) {
      log('ERROR', 'Search', stderr || error.message);
      const userMsg = parseYtDlpError(stderr || error.message);
      return res.status(500).json({ error: userMsg });
    }

    const results = stdout.split('\n').filter(l => l.trim()).map(line => {
      try {
        const data = JSON.parse(line);
        return {
          id: data.id,
          title: data.title,
          url: `https://www.youtube.com/watch?v=${data.id}`,
          duration: data.duration || 0,
          uploader: data.uploader || data.channel || 'Desconocido',
          thumbnail: data.thumbnail || (data.thumbnails?.length > 0 ? data.thumbnails[data.thumbnails.length - 1].url : null)
        };
      } catch { return null; }
    }).filter(Boolean);

    res.json(results);
  });
});

// Get video info (format extraction)
app.get('/api/info', searchLimiter, (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Falta la URL del video.' });
  if (!fs.existsSync(YTDLP_PATH)) return res.status(500).json({ error: 'El descargador no está listo. Por favor, instálalo.' });

  log('INFO', 'Info', `Extracting formats for: ${url}`);

  const args = getYtDlpArgs([
    '--dump-json',
    '--no-playlist',
    url
  ]);

  execFile(YTDLP_PATH, args, { maxBuffer: 25 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error && !stdout) {
      log('ERROR', 'Info', stderr || error.message);
      const userMsg = parseYtDlpError(stderr || error.message);
      return res.status(500).json({ error: userMsg });
    }

    try {
      const data = JSON.parse(stdout);

      const heights = new Set();
      if (data.formats) {
        data.formats.forEach(f => {
          if (
            f.height && f.height >= 360 &&
            f.vcodec && f.vcodec !== 'none' &&
            !f.vcodec.startsWith('storyboard') &&
            !f.vcodec.startsWith('images') &&
            (!f.protocol || !f.protocol.startsWith('mhtml'))
          ) {
            heights.add(f.height);
          }
        });
      }

      const resolutions = Array.from(heights)
        .sort((a, b) => b - a)
        .map(h => ({ height: h, label: `${h}p ${h >= 720 ? (h >= 1080 ? (h >= 2160 ? '4K Ultra HD' : 'Full HD') : 'HD') : ''}`.trim() }));

      if (resolutions.length === 0) {
        resolutions.push({ height: 720, label: '720p HD (Automático)' });
      }

      res.json({
        id: data.id,
        title: data.title || 'Vídeo de YouTube',
        uploader: data.uploader || data.channel || 'Desconocido',
        duration: data.duration || 0,
        thumbnail: data.thumbnail || (data.thumbnails?.length > 0 ? data.thumbnails[data.thumbnails.length - 1].url : null),
        resolutions,
        url
      });
    } catch (e) {
      log('ERROR', 'Info', `JSON Parse error: ${e.message}`);
      res.status(500).json({ error: 'No se pudo analizar la información del vídeo.' });
    }
  });
});

// ─── Direct CDN URL (video → skip VPS bandwidth) ─────────────────────────────
app.get('/api/direct-url', downloadLimiter, (req, res) => {
  const { url, quality } = req.query;
  if (!url || !quality) return res.status(400).json({ error: 'Faltan parámetros url y quality.' });
  if (!fs.existsSync(YTDLP_PATH)) return res.status(500).json({ error: 'El descargador no está listo.' });

  log('INFO', 'DirectURL', `Getting direct URL for ${url} @ ${quality}p`);

  const args = getYtDlpArgs([
    '-f', `best[height<=${quality}][vcodec!=none][acodec!=none]/best[height<=${quality}]/best`,
    '--get-url',
    '--no-playlist',
    url
  ]);

  execFile(YTDLP_PATH, args, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error && !stdout) {
      log('ERROR', 'DirectURL', stderr || error.message);
      return res.status(500).json({ error: parseYtDlpError(stderr || error.message) });
    }

    const urls = stdout.trim().split('\n').filter(Boolean);
    if (urls.length === 0) {
      return res.status(500).json({ error: 'No se pudo obtener la URL de descarga.' });
    }

    res.json({
      videoUrl: urls[0],
      needsMerge: false
    });
  });
});

// ─── High-speed video stream proxy (Pipes Google CDN → Browser on-the-fly) ─────
app.get('/api/stream', downloadLimiter, (req, res) => {
  const { url: videoUrl, title } = req.query;
  if (!videoUrl) return res.status(400).json({ error: 'Falta la URL de video.' });

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(videoUrl);
    const parsed = new URL(decodedUrl);
    if (!parsed.hostname.endsWith('googlevideo.com') && !parsed.hostname.endsWith('youtube.com')) {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
  } catch {
    return res.status(400).json({ error: 'URL inválida.' });
  }

  log('INFO', 'VideoStream', `Streaming video to user: ${decodedUrl.substring(0, 70)}...`);

  const safeTitle = (title || 'video').replace(/[^\w\s-]/g, '').trim();
  const protocol = decodedUrl.startsWith('https') ? https : http;

  const proxyReq = protocol.get(decodedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com'
    }
  }, (ytRes) => {
    res.setHeader('Content-Type', ytRes.headers['content-type'] || 'video/mp4');
    if (ytRes.headers['content-length']) {
      res.setHeader('Content-Length', ytRes.headers['content-length']);
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.mp4"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.status(ytRes.statusCode || 200);

    ytRes.pipe(res);
    ytRes.on('error', (err) => {
      log('ERROR', 'VideoStream', `Stream error: ${err.message}`);
      if (!res.headersSent) res.status(500).end();
    });
  });

  proxyReq.on('error', (err) => {
    log('ERROR', 'VideoStream', `Request error: ${err.message}`);
    if (!res.headersSent) res.status(500).json({ error: 'Error al conectar con el servidor de video.' });
  });

  req.on('close', () => proxyReq.destroy());
});

// ─── Audio CDN URL (for client-side ffmpeg.wasm conversion) ──────────────────
app.get('/api/audio-url', downloadLimiter, (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Falta el parámetro url.' });
  if (!fs.existsSync(YTDLP_PATH)) return res.status(500).json({ error: 'El descargador no está listo.' });

  log('INFO', 'AudioURL', `Getting audio stream URL for: ${url}`);

  const args = getYtDlpArgs([
    '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
    '--get-url',
    '--no-playlist',
    url
  ]);

  execFile(YTDLP_PATH, args, { maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error && !stdout) {
      log('ERROR', 'AudioURL', stderr || error.message);
      return res.status(500).json({ error: parseYtDlpError(stderr || error.message) });
    }

    const audioUrl = stdout.trim().split('\n')[0];
    if (!audioUrl) {
      return res.status(500).json({ error: 'No se pudo obtener el enlace de audio.' });
    }

    res.json({ audioUrl });
  });
});

// ─── Audio proxy (CORS bridge: browser → VPS → YouTube CDN) ──────────────────
// Streams audio bytes transparently without saving to disk
app.get('/api/proxy-audio', downloadLimiter, (req, res) => {
  const { url: audioUrl, title } = req.query;
  if (!audioUrl) return res.status(400).json({ error: 'Falta el parámetro url.' });

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(audioUrl);
    // Basic URL safety check
    const parsed = new URL(decodedUrl);
    if (!parsed.hostname.endsWith('googlevideo.com') && !parsed.hostname.endsWith('youtube.com')) {
      return res.status(403).json({ error: 'URL de origen no permitida.' });
    }
  } catch {
    return res.status(400).json({ error: 'URL inválida.' });
  }

  log('INFO', 'AudioProxy', `Proxying audio: ${decodedUrl.substring(0, 80)}...`);

  const safeTitle = (title || 'audio').replace(/[^\w\s-]/g, '').trim();

  // Set headers for streaming download
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.webm"`);
  res.setHeader('Content-Type', 'audio/webm');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const protocol = decodedUrl.startsWith('https') ? https : http;

  const proxyReq = protocol.get(decodedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com'
    }
  }, (ytRes) => {
    if (ytRes.headers['content-length']) {
      res.setHeader('Content-Length', ytRes.headers['content-length']);
    }
    res.status(ytRes.statusCode || 200);
    ytRes.pipe(res);
    ytRes.on('error', (err) => {
      log('ERROR', 'AudioProxy', `Stream error: ${err.message}`);
      if (!res.headersSent) res.status(500).end();
    });
  });

  proxyReq.on('error', (err) => {
    log('ERROR', 'AudioProxy', `Request error: ${err.message}`);
    if (!res.headersSent) res.status(500).json({ error: 'Error al obtener el audio de YouTube.' });
  });

  req.on('close', () => proxyReq.destroy());
});

// Trigger download
app.post('/api/download', downloadLimiter, (req, res) => {
  const { url, format, quality, title, thumbnail } = req.body;
  if (!url || !format || !quality) {
    return res.status(400).json({ error: 'Parámetros url, format y quality son requeridos.' });
  }

  const duplicateTask = Object.values(activeDownloads).find(task =>
    task.url === url && task.format === format && task.quality === quality &&
    ['queued', 'downloading', 'processing'].includes(task.status)
  );
  if (duplicateTask) {
    log('INFO', 'Download', `Duplicate request detected, returning existing taskId: ${duplicateTask.id}`);
    return res.json({ success: true, taskId: duplicateTask.id });
  }

  const activeCount = Object.values(activeDownloads).filter(t =>
    ['downloading', 'processing'].includes(t.status)
  ).length;

  if (activeCount >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: `Se alcanzó el límite de ${MAX_CONCURRENT} descargas simultáneas. Espera a que termine alguna.`
    });
  }

  const taskId = `task_${Date.now()}`;

  activeDownloads[taskId] = {
    id: taskId,
    url,
    format,
    quality,
    title: title || 'Analizando video...',
    thumbnail: thumbnail || null,
    status: 'queued',
    progress: 0,
    speed: '0 KB/s',
    eta: '--',
    filename: '',
    error: null,
    clients: [],
    createdAt: Date.now()
  };

  setTimeout(() => runDownloadTask(taskId, url, format, quality), 100);
  res.json({ success: true, taskId });
});

// SSE progress stream
app.get('/api/download/progress/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = activeDownloads[taskId];
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const client = { id: Date.now(), res };
  task.clients.push(client);

  const data = JSON.stringify({
    id: task.id, title: task.title, thumbnail: task.thumbnail,
    status: task.status, progress: task.progress, speed: task.speed,
    eta: task.eta, filename: task.filename, error: task.error,
    url: task.url, format: task.format, quality: task.quality
  });
  res.write(`data: ${data}\n\n`);

  req.on('close', () => {
    task.clients = task.clients.filter(c => c.id !== client.id);
  });
});

// ─── Download Runner ─────────────────────────────────────────────────────────
function runDownloadTask(taskId, url, format, quality) {
  const task = activeDownloads[taskId];
  if (!task) return;

  task.status = 'downloading';
  broadcastProgress(task);

  let baseArgs = [
    '--newline',
    '--no-playlist',
    '-N', '8',
    '--limit-rate', '8M',
    '--progress-template', 'downloading:%(progress._percent_str)s:%(progress._speed_str)s:%(progress._eta_str)s'
  ];

  if (format === 'audio') {
    baseArgs.push(
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', quality.replace('k', 'K'),
      '--no-keep-video',
      '--ffmpeg-location', ffmpegPath,
      '-o', path.join(DOWNLOADS_DIR, `%(title)s [${quality}].%(ext)s`),
      url
    );
  } else {
    baseArgs.push(
      '-f', `bestvideo[height<=${quality}][ext=mp4][vcodec!=none]+bestaudio[ext=m4a]/bestvideo[height<=${quality}][vcodec!=none]+bestaudio/best[height<=${quality}][vcodec!=none]`,
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', ffmpegPath,
      '-o', path.join(DOWNLOADS_DIR, `%(title)s [${quality}p].%(ext)s`),
      url
    );
  }

  const args = getYtDlpArgs(baseArgs);

  log('INFO', 'Download', `Task: ${taskId} started`);

  const child = spawn(YTDLP_PATH, args);
  let accumulatedStderr = '';

  child.stdout.on('data', (buffer) => {
    const text = buffer.toString();
    for (let line of text.split('\n')) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('downloading:')) {
        const parts = line.split(':');
        if (parts.length >= 4) {
          task.progress = parseFloat(parts[1].replace('%', '').trim()) || 0;
          task.speed = parts[2].trim();
          task.eta = parts[3].trim();
          task.status = 'downloading';
          broadcastProgress(task);
        }
      }
      else if (line.includes('[ExtractAudio]') || line.includes('[ffmpeg]')) {
        task.status = 'processing';
        task.progress = 99;
        task.speed = 'Procesando';
        task.eta = 'Convirtiendo a MP3...';
        broadcastProgress(task);
      }
      else if (line.includes('[Merger]')) {
        task.status = 'processing';
        task.progress = 99;
        task.speed = 'Procesando';
        task.eta = 'Preparando archivo de video...';
        broadcastProgress(task);
      }
      else if (line.startsWith('[ExtractAudio] Destination:')) {
        const destPath = line.replace('[ExtractAudio] Destination:', '').trim();
        if (destPath) task.filename = path.basename(destPath);
      }
      else if (line.startsWith('[download] Destination:') || line.startsWith('[Merger] Merging formats into')) {
        if (format !== 'audio') {
          const rawPath = line
            .replace('[download] Destination:', '')
            .replace('[Merger] Merging formats into', '')
            .replace(/^"|"$/g, '')
            .trim();
          if (rawPath) {
            const baseName = path.basename(rawPath);
            const isIntermediate = /\.f\d+\.[a-zA-Z0-9]+$/.test(baseName) ||
                                   baseName.endsWith('.part') || baseName.endsWith('.temp');
            if (!isIntermediate) task.filename = baseName;
          }
        }
      }
    }
  });

  child.stderr.on('data', (buffer) => {
    const errorText = buffer.toString().trim();
    accumulatedStderr += errorText + '\n';
    if (errorText.toLowerCase().includes('error')) {
      log('WARN', 'Download', `StdErr: ${errorText.substring(0, 200)}`);
    }
  });

  child.on('close', (code) => {
    log('INFO', 'Download', `Task: ${taskId} finished with exit code ${code}`);

    try {
      const allFiles = fs.readdirSync(DOWNLOADS_DIR);
      const intermediatePattern = /\.f\d+\.(m4a|mp4|webm|mkv)$/i;
      allFiles.forEach(file => {
        if (intermediatePattern.test(file)) {
          fs.unlinkSync(path.join(DOWNLOADS_DIR, file));
        }
      });
    } catch (e) {
      log('WARN', 'Cleanup', `Could not delete intermediates: ${e.message}`);
    }

    if (code === 0) {
      task.status = 'completed';
      task.progress = 100;
      task.speed = '--';
      task.eta = 'Completado';

      if (task.filename) {
        const isTemp = /\.f\d+\.[a-zA-Z0-9]+$/.test(task.filename) ||
                       task.filename.endsWith('.part') || task.filename.endsWith('.temp');
        const isWrongExt = (format !== 'audio' && (task.filename.endsWith('.m4a') || task.filename.endsWith('.webm')));
        if (isTemp || isWrongExt) {
          task.filename = '';
        }
      }

      if (!task.filename) {
        try {
          const files = fs.readdirSync(DOWNLOADS_DIR);
          const extension = format === 'audio' ? '.mp3' : '.mp4';
          const strip = (name) => name.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const target = strip(task.title);
          const qualityStr = format === 'audio' ? quality : `${quality}p`;

          const matchedFile = files.find(file => {
            if (!file.endsWith(extension)) return false;
            if (!file.toLowerCase().includes(qualityStr.toLowerCase())) return false;
            const fileStripped = strip(file);
            return fileStripped.includes(target) || target.includes(fileStripped);
          });

          task.filename = matchedFile || `${task.title.replace(/[\\/:*?"<>|]/g, '')} [${qualityStr}]${extension}`;
        } catch {
          task.filename = 'descarga_finalizada' + (format === 'audio' ? '.mp3' : '.mp4');
        }
      }

      if (task.filename) {
        const cleanName = task.filename.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.').trim();
        if (cleanName !== task.filename) {
          const oldPath = path.join(DOWNLOADS_DIR, task.filename);
          const newPath = path.join(DOWNLOADS_DIR, cleanName);
          try {
            if (fs.existsSync(oldPath)) {
              fs.renameSync(oldPath, newPath);
              task.filename = cleanName;
            }
          } catch (e) {
            log('ERROR', 'Rename', `Failed: ${e.message}`);
          }
        }
      }

      broadcastProgress(task);
    } else {
      task.status = 'failed';
      task.error = parseYtDlpError(accumulatedStderr);
      broadcastProgress(task);
    }

    setTimeout(() => {
      task.clients.forEach(c => { try { c.res.end(); } catch {} });
      task.clients = [];
    }, 5000);
  });
}

// ─── Periodic cleanup ────────────────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - (TASK_CLEANUP_MIN * 60 * 1000);
  let cleaned = 0;
  for (const [id, task] of Object.entries(activeDownloads)) {
    if (['completed', 'failed'].includes(task.status) && task.createdAt < cutoff) {
      task.clients.forEach(c => { try { c.res.end(); } catch {} });
      delete activeDownloads[id];
      cleaned++;
    }
  }
  if (cleaned > 0) log('INFO', 'Cleanup', `Removed ${cleaned} old task(s) from memory`);
}, 10 * 60 * 1000);

// ─── Static files & SPA fallback ─────────────────────────────────────────────
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('MoonDownloader API en ejecución (Modo Desarrollo). Frontend en puerto 5173.');
  });
}

// ─── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log('INFO', 'Server', '===============================================');
  log('INFO', 'Server', `MoonDownloader running on port ${PORT}`);
  log('INFO', 'Server', `Platform: ${process.platform} | Binary: ${YTDLP_BINARY}`);
  log('INFO', 'Server', `Downloads: ${DOWNLOADS_DIR}`);
  log('INFO', 'Server', `FFmpeg: ${ffmpegPath}`);
  log('INFO', 'Server', `Cookies File: ${fs.existsSync(COOKIES_PATH) ? 'PRESENTE (' + COOKIES_PATH + ')' : 'NO DETECTADO'}`);
  log('INFO', 'Server', `CORS origin: ${CORS_ORIGIN}`);
  log('INFO', 'Server', `Max concurrent: ${MAX_CONCURRENT} | File retention: ${FILE_RETENTION_MIN}min`);
  log('INFO', 'Server', '===============================================');
});
