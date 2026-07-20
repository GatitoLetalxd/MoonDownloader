import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, execFile, spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { setupBinaries } from './scripts/setup-binaries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration (from .env) ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
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

// Ensure directories exist
[DOWNLOADS_DIR, path.join(__dirname, 'logs')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Structured logger ───────────────────────────────────────────────────────
function log(level, tag, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] [${tag}] ${message}`);
}

// ─── Express setup ───────────────────────────────────────────────────────────
const app = express();

// Security & performance middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json());

// CORS — restrict to configured origin in production
app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN,
  methods: ['GET', 'POST'],
  credentials: true
}));

// Trust proxy (needed behind Nginx for correct IP-based rate limiting)
app.set('trust proxy', 1);

// Rate limiters
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 15,                    // 15 searches per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas búsquedas. Espera un momento e intenta de nuevo.' }
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,                    // 10 download requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas descargas. Espera un momento e intenta de nuevo.' }
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

  task.clients.forEach(client => {
    try { client.res.write(`data: ${data}\n\n`); } catch (e) { /* client disconnected */ }
  });
}

// ─── File serving (safe against directory traversal) ─────────────────────────
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  let filePath = path.join(DOWNLOADS_DIR, safeFilename);

  // Fallback 1: sanitized filename (double dots → single dot)
  if (!fs.existsSync(filePath)) {
    const sanitized = safeFilename.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.').trim();
    const sanitizedPath = path.join(DOWNLOADS_DIR, sanitized);
    if (fs.existsSync(sanitizedPath)) {
      log('INFO', 'FileServe', `Fallback: "${safeFilename}" → "${sanitized}"`);
      filePath = sanitizedPath;
    }
  }

  // Fallback 2: alphanumeric match (Windows character replacements)
  if (!fs.existsSync(filePath)) {
    try {
      const files = fs.readdirSync(DOWNLOADS_DIR);
      const strip = (name) => name.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = strip(safeFilename);
      const matched = files.find(f => strip(f) === target);
      if (matched) {
        log('INFO', 'FileServe', `Alphanumeric match: "${safeFilename}" → "${matched}"`);
        filePath = path.join(DOWNLOADS_DIR, matched);
      }
    } catch (e) {
      log('ERROR', 'FileServe', `Alphanumeric fallback error: ${e.message}`);
    }
  }

  if (fs.existsSync(filePath)) {
    // Schedule file deletion after the configured retention time
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
    res.status(404).json({ error: 'Archivo no encontrado.' });
  }
});

// ─── API Endpoints ───────────────────────────────────────────────────────────

// Status check
app.get('/api/status', (req, res) => {
  const ytDlpReady = fs.existsSync(YTDLP_PATH);
  const ffmpegReady = !!ffmpegPath && fs.existsSync(ffmpegPath);

  res.json({
    ytDlpReady,
    ffmpegReady,
    ffmpegPath: ffmpegReady ? ffmpegPath : null,
    downloadsDir: DOWNLOADS_DIR,
    activeDownloads: Object.values(activeDownloads).filter(t => ['downloading', 'processing', 'queued'].includes(t.status)).length,
    maxConcurrent: MAX_CONCURRENT
  });
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

  execFile(YTDLP_PATH, [
    '--js-runtimes', 'node',
    '--dump-json',
    '--flat-playlist',
    `ytsearch6:${q}`
  ], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error && !stdout) {
      log('ERROR', 'Search', error.message);
      return res.status(500).json({ error: 'Ocurrió un error al buscar. Intenta de nuevo.' });
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

  execFile(YTDLP_PATH, [
    '--js-runtimes', 'node',
    '--dump-json',
    '--no-playlist',
    url
  ], { maxBuffer: 25 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      log('ERROR', 'Info', error.message);
      return res.status(500).json({ error: 'No se pudo obtener información del video. Verifica el enlace.' });
    }

    try {
      const data = JSON.parse(stdout);

      // Filter real video streams only
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
        .map(h => {
          let label = `${h}p`;
          if (h >= 2160) label = `4K Ultra HD (${h}p)`;
          else if (h >= 1440) label = `2K Quad HD (${h}p)`;
          else if (h >= 1080) label = `Full HD (${h}p)`;
          else if (h === 720) label = `HD (${h}p)`;
          else if (h === 480) label = `SD (${h}p)`;
          return { height: h, label };
        });

      res.json({
        id: data.id,
        title: data.title,
        uploader: data.uploader || data.channel || 'Canal Desconocido',
        duration: data.duration || 0,
        thumbnail: data.thumbnail || (data.thumbnails?.length > 0 ? data.thumbnails[data.thumbnails.length - 1].url : null),
        url: `https://www.youtube.com/watch?v=${data.id}`,
        resolutions
      });
    } catch (e) {
      log('ERROR', 'Info', `JSON parse error: ${e.message}`);
      res.status(500).json({ error: 'Error al procesar la respuesta del servidor.' });
    }
  });
});

// Start download task
app.post('/api/download', downloadLimiter, (req, res) => {
  const { url, format, quality, title, thumbnail } = req.body;
  if (!url || !format || !quality) {
    return res.status(400).json({ error: 'Parámetros url, format y quality son requeridos.' });
  }

  // Check for duplicate active task
  const duplicateTask = Object.values(activeDownloads).find(task =>
    task.url === url && task.format === format && task.quality === quality &&
    ['queued', 'downloading', 'processing'].includes(task.status)
  );
  if (duplicateTask) {
    log('INFO', 'Download', `Duplicate request detected, returning existing taskId: ${duplicateTask.id}`);
    return res.json({ success: true, taskId: duplicateTask.id });
  }

  // Check concurrent download limit
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
    'X-Accel-Buffering': 'no' // Nginx: disable proxy buffering for SSE
  });

  const client = { id: Date.now(), res };
  task.clients.push(client);

  // Send immediate current state
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

  let args = [
    '--newline',
    '--js-runtimes', 'node',
    '--no-playlist',
    '--progress-template', 'downloading:%(progress._percent_str)s:%(progress._speed_str)s:%(progress._eta_str)s'
  ];

  if (format === 'audio') {
    args.push(
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
    args.push(
      '-f', `bestvideo[height<=${quality}][ext=mp4][vcodec!=none]+bestaudio[ext=m4a]/bestvideo[height<=${quality}][vcodec!=none]+bestaudio/best[height<=${quality}][vcodec!=none]`,
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', ffmpegPath,
      '-o', path.join(DOWNLOADS_DIR, `%(title)s [${quality}p].%(ext)s`),
      url
    );
  }

  log('INFO', 'Download', `Task: ${taskId} started`);

  const child = spawn(YTDLP_PATH, args);

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
    if (errorText.toLowerCase().includes('error')) {
      log('WARN', 'Download', `StdErr: ${errorText.substring(0, 200)}`);
    }
  });

  child.on('close', (code) => {
    log('INFO', 'Download', `Task: ${taskId} finished with exit code ${code}`);

    // Cleanup intermediate split-stream files
    try {
      const allFiles = fs.readdirSync(DOWNLOADS_DIR);
      const intermediatePattern = /\.f\d+\.(m4a|mp4|webm|mkv)$/i;
      allFiles.forEach(file => {
        if (intermediatePattern.test(file)) {
          fs.unlinkSync(path.join(DOWNLOADS_DIR, file));
          log('INFO', 'Cleanup', `Deleted intermediate: ${file}`);
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

      // Clear wrong filenames
      if (task.filename) {
        const isTemp = /\.f\d+\.[a-zA-Z0-9]+$/.test(task.filename) ||
                       task.filename.endsWith('.part') || task.filename.endsWith('.temp');
        const isWrongExt = (format !== 'audio' && (task.filename.endsWith('.m4a') || task.filename.endsWith('.webm')));
        if (isTemp || isWrongExt) {
          log('INFO', 'Download', `Cleared wrong filename: "${task.filename}"`);
          task.filename = '';
        }
      }

      // Scan folder for matching file if filename couldn't be parsed
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

      // Sanitize double dots in filename
      if (task.filename) {
        const cleanName = task.filename.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.').trim();
        if (cleanName !== task.filename) {
          const oldPath = path.join(DOWNLOADS_DIR, task.filename);
          const newPath = path.join(DOWNLOADS_DIR, cleanName);
          try {
            if (fs.existsSync(oldPath)) {
              fs.renameSync(oldPath, newPath);
              log('INFO', 'Rename', `"${task.filename}" → "${cleanName}"`);
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
      task.error = 'Ocurrió un error durante la descarga. Inténtalo de nuevo.';
      broadcastProgress(task);
    }

    // Close SSE clients after a delay
    setTimeout(() => {
      task.clients.forEach(c => { try { c.res.end(); } catch {} });
      task.clients = [];
    }, 5000);
  });
}

// ─── Periodic cleanup ────────────────────────────────────────────────────────

// Clean old tasks from memory every 10 minutes
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
  log('INFO', 'Server', `CORS origin: ${CORS_ORIGIN}`);
  log('INFO', 'Server', `Max concurrent: ${MAX_CONCURRENT} | File retention: ${FILE_RETENTION_MIN}min`);
  log('INFO', 'Server', '===============================================');
});
