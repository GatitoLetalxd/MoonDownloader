# 📖 Documentación de Arquitectura y Funciones (features.md)

Este documento detalla el diseño técnico, las decisiones de arquitectura y la lógica interna detrás de las características clave implementadas en **MoonDownloader**.

---

## 1. Arquitectura de Comunicación en Tiempo Real (SSE)

Para evitar peticiones repetitivas (*polling*) y mantener la CPU libre de carga innecesaria, MoonDownloader utiliza **Server-Sent Events (SSE)** en lugar de WebSockets o llamadas periódicas AJAX.

### Flujo de Datos:
1. El frontend envía una solicitud de descarga vía `POST /api/download`.
2. El servidor responde inmediatamente con un identificador único de tarea (`taskId`).
3. El frontend abre una conexión SSE persistente con el servidor apuntando a `/api/download/progress/:taskId`.
4. El backend inicia el proceso hijo de `yt-dlp` en segundo plano.
5. El servidor lee la salida estándar (`stdout`) de `yt-dlp` línea por línea, parsea los porcentajes, velocidades y ETA, y transmite los datos en formato de texto plano estructurado:
   ```text
   data: {"id":"task_1784305914935","progress":45.2,"speed":"3.4MB/s","eta":"00:08","status":"downloading",...}
   ```
6. Cuando la descarga finaliza (código `0` de éxito o error), el servidor envía el estado final (`completed` o `failed`) y cierra de forma segura la conexión del cliente a los 5 segundos para liberar descriptores de archivos y memoria.

### Configuración para Proxies (Nginx):
Para que SSE no sufra retrasos, el proxy de Nginx debe tener el buffering desactivado:
```nginx
proxy_buffering off;
proxy_read_timeout 86400s;
```
En el backend, Express también envía la cabecera `X-Accel-Buffering: no` para eludir cualquier almacenamiento intermedio.

---

## 2. Prevención y Saneamiento contra Fallos de Servidor Estático (Double Dot Bug)

Un problema común en descargas de YouTube son los títulos de video que terminan en punto (ej. `Video de Prueba.`), generando nombres de archivos con doble punto antes de la extensión (ej. `Video de Prueba..mp4`).

### El Problema:
Express.js utiliza internamente la biblioteca `send` para servir carpetas estáticas. Por motivos de seguridad, `send` bloquea de forma estricta cualquier ruta de archivo que contenga dos puntos seguidos (`..`), interpretándolos como un posible ataque de *Directory Traversal* (navegación hacia directorios superiores). Esto resultaba en descargas truncadas de 1.4KB (un error HTML de Express).

### La Solución de Dos Capas implementada:
1. **Endpoint de Entrega Dinámica (`/api/files/:filename`):**
   No servimos los archivos descargados a través de un directorio estático directo. En su lugar, el endpoint utiliza `path.basename` para extraer única y exclusivamente el nombre del archivo, haciéndolo 100% inmune a ataques de evasión de directorios y permitiendo la entrega segura de cualquier archivo que contenga doble punto.
2. **Saneamiento Automático de Nombres:**
   Al finalizar cada descarga, el servidor escanea el nombre del archivo resultante. Si detecta la presencia de múltiples puntos consecutivos o espacios superfluos antes del formato, los renombra en el sistema de archivos (`fs.renameSync`) a una estructura limpia (ej. reemplaza `..mp4` por `.mp4`) y actualiza el estado de la tarea antes de notificar al usuario.
3. **Búsqueda Alfanumérica de Respaldo:**
   Si por problemas de caracteres especiales de Windows (ej. conversión automática de caracteres prohibidos como `|` a `｜`) el archivo solicitado no se encuentra con su nombre exacto en el disco, el backend ejecuta una búsqueda alfanumérica comparativa sobre el directorio `/downloads`, encontrando y entregando el archivo correcto sin lanzar un error `404`.

---

## 3. Mitigación de Playlists No Deseadas

Al pegar una dirección web que proviene de una lista de reproducción (URL que contiene parámetros como `&list=...` o `&start_radio=1`), `yt-dlp` tiende por defecto a descargar la playlist completa de forma recursiva, consumiendo rápidamente el almacenamiento del VPS.

### Implementación contra Playlists:
- **En el backend (`/api/info`):** Se añade de forma obligatoria el argumento `--no-playlist` al invocar `yt-dlp`. Además, el servidor devuelve al cliente una URL normalizada basada exclusivamente en el identificador único del video (`data.id`), eliminando de raíz cualquier parámetro de lista.
- **En el frontend (`App.jsx`):** Al guardar la información del video analizado, el estado React descarta la URL ingresada originalmente por el usuario y adopta la URL normalizada provista por el backend. Esto garantiza que la posterior petición de descarga enviada a `/api/download` sea 100% limpia.

---

## 4. Gestión Autónoma de Recursos en VPS

Para evitar que MoonDownloader llene el almacenamiento de tu VPS y agote la memoria RAM del servidor de producción, se implementaron rutinas autónomas de mantenimiento:

* **Límite de Descargas Simultáneas (`MAX_CONCURRENT_DOWNLOADS`):**
  Definido en el archivo `.env`. Si hay más de $N$ descargas activas en curso (`downloading` o `processing`), las nuevas solicitudes se rechazan con un código `429 (Too Many Requests)` indicando al usuario que espere a que finalice alguna.
* **Auto-eliminación de Archivos (Retention Timer):**
  Al momento en que un usuario solicita la descarga de un archivo finalizado, se programa una tarea diferida (`setTimeout`) en el backend que eliminará físicamente el archivo del disco de tu VPS transcurridos **5 minutos** (`FILE_RETENTION_MINUTES`).
* **Mantenimiento Periódico de Tareas en Memoria:**
  Un intervalo global (`setInterval`) se ejecuta cada 10 minutos en el backend para limpiar el objeto de estado en memoria `activeDownloads`. Cualquier registro de tarea finalizado (con éxito o error) con más de 30 minutos de antigüedad es purgado de la memoria RAM del servidor.

---

## 5. Seguridad y Rendimiento

* **Helmet:** Previene ataques comunes como inyección de clickjacking y cross-site scripting (XSS) configurando de manera segura las cabeceras HTTP de respuesta del servidor web.
* **Compression:** Comprime mediante algoritmo Gzip todas las respuestas de texto, reduciendo significativamente el consumo de transferencia mensual del VPS y acelerando la visualización de búsquedas y skeletons de carga.
* **Rate Limiting:** Protege el backend contra ataques de denegación de servicio (DoS) o scripts automatizados de descarga repetida. El límite se aplica por IP a nivel de red, permitiendo un máximo de 15 búsquedas de catálogo y 10 descargas por minuto.
