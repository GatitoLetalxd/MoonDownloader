# 🌙 MoonDownloader

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v6-646CFF.svg)](https://vite.dev/)
[![Express](https://img.shields.io/badge/Express-v4-000000.svg)](https://expressjs.com/)

**MoonDownloader** es una suite de descarga de contenido multimedia premium diseñada para VPS y despliegues locales. Ofrece una interfaz de usuario cinematográfica, moderna y de alto rendimiento basada en *Glassmorphism*, con seguimiento en tiempo real del progreso de descargas de audio y video de YouTube de forma 100% autogestionada.

---

## 🚀 Características Clave

* **Diseño Premium Cinema Dark & Glassmorphism:** Interfaz visualmente impactante construida con efectos de desenfoque de fondo (*frosted glass*), microanimaciones suaves y gradientes dinámicos libres de emojis.
* **Seguimiento del Progreso en Tiempo Real:** Comunicación bidireccional mediante *Server-Sent Events (SSE)* para reportar velocidad de descarga, porcentaje completado, estado de procesamiento y tiempo estimado (ETA) al instante.
* **Soporte Multiplataforma Inteligente:** Detección de entorno automatizada (Windows, Linux y macOS) para descargar la arquitectura correcta del binario `yt-dlp` y otorgar permisos de ejecución nativos.
* **Fusión de Pistas en Silencio:** Descarga de calidades de alta definición (1080p, 2K, 4K) combinando el flujo de video con el de audio de forma transparente utilizando `ffmpeg` en el servidor.
* **Extracción de Audio Simplificada (MP3):** Conversión directa a formato MP3 con calidad de sonido regulable (320kbps, 256kbps, 128kbps) consumiendo únicamente el canal de audio del video original para ahorrar recursos y ancho de banda.
* **Filtro Inteligente de Playlists:** Evita la descarga de listas de reproducción completas por accidente; la aplicación detecta parámetros de lista (`&list=...`) y aísla el video individual activo.
* **Preparado para VPS:**
  * **Rate Limiting:** Límites por dirección IP en endpoints críticos para mitigar abusos de tráfico.
  * **Retención de Disco:** Eliminación automática de archivos temporales 5 minutos después de su descarga.
  * **Cola de Trabajo:** Límite configurable de descargas concurrentes simultáneas.
  * **Integración con PM2 & Nginx:** Estructurado para correr como servicio y detrás de un proxy inverso con SSE configurado correctamente.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 19, Vite 6, Lucide Icons, Vanilla CSS (Premium Custom Design System).
* **Backend:** Node.js, Express, Server-Sent Events (SSE), Child Process Spawning.
* **Utilidades del Core:** `yt-dlp` (Motor de descargas), `ffmpeg` (Fusión y codificación de audio/video).
* **Seguridad y Producción:** `helmet` (Cabeceras de protección), `compression` (Gzip), `express-rate-limit` (Prevención de spam), `dotenv` (Gestión de configuración).

---

## 📦 Estructura del Proyecto

```text
├── bin/                       # Directorio de binarios locales (yt-dlp)
├── dist/                      # Compilación de producción del frontend
├── downloads/                 # Carpeta temporal de archivos descargados
├── scripts/
│   └── setup-binaries.js      # Descarga multiplataforma de yt-dlp
├── src/
│   ├── components/            # Componentes React de la interfaz
│   ├── utils.js               # Utilidades globales (formateo de tiempo)
│   ├── App.jsx                # Componente principal y controlador de estado
│   └── index.css              # Sistema de diseño y variables visuales
├── server.js                  # Servidor de la API Express y logs de progreso
├── nginx.conf.example         # Ejemplo de configuración para Nginx
└── ecosystem.config.cjs       # Configuración del gestor de procesos PM2
```

---

## ⚙️ Configuración (.env)

Configura las opciones de tu despliegue creando un archivo `.env` en la raíz del proyecto:

```env
PORT=3001
CORS_ORIGIN=https://mdownload.moondev.online
DOWNLOADS_DIR=./downloads
MAX_CONCURRENT_DOWNLOADS=3
FILE_RETENTION_MINUTES=5
TASK_CLEANUP_MINUTES=30
```

* **CORS_ORIGIN**: Restringe las peticiones HTTP externas únicamente a tu dominio de producción.
* **MAX_CONCURRENT_DOWNLOADS**: Número máximo de descargas ejecutándose al mismo tiempo para no saturar la CPU.
* **FILE_RETENTION_MINUTES**: Tiempo en minutos que permanecerá el archivo en el servidor antes de ser auto-eliminado.

---

## 🔧 Instalación y Arranque Local

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/tu-usuario/moondownloader.git
cd moondownloader
npm install
```

### 2. Configurar binarios locales
```bash
npm run setup
```
*Este comando descargará de forma automática el motor de descargas correspondiente a tu sistema operativo (Windows, Linux, macOS) y le asignará los permisos pertinentes.*

### 3. Ejecutar en modo desarrollo
```bash
npm run dev
```
*Inicia el frontend en `http://localhost:5173` y la API Express en `http://localhost:3001` con recarga rápida (HMR) activada.*

### 4. Compilar y arrancar en producción
```bash
npm run build
npm start
```
*Compila el código frontend de React y levanta un único servidor unificado en el puerto `3001` sirviendo tanto el cliente web optimizado como los endpoints de la API.*

---

## ☁️ Despliegue en VPS (Nginx + PM2)

### 1. Preparar el servidor y construir la app
```bash
npm run deploy
```

### 2. Ejecutar la aplicación con PM2
Inicia el proceso en segundo plano para que se mantenga ejecutándose 24/7 y se reinicie en caso de errores del sistema:
```bash
pm2 start ecosystem.config.cjs
```

### 3. Configurar Nginx
Crea un archivo de configuración en tu servidor (ej. `/etc/nginx/sites-available/mdownload.moondev.online`) usando el archivo modelo [`nginx.conf.example`](./nginx.conf.example).

> [!IMPORTANT]
> Es crucial añadir la directiva `proxy_buffering off;` y configurar un tiempo de espera de lectura largo (`proxy_read_timeout 86400s;`). De lo contrario, Nginx retendrá los buffers de progreso y los Server-Sent Events (SSE) no se mostrarán fluidamente en tiempo real en la pantalla del navegador.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para obtener más detalles.
