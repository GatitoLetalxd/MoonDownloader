import React from 'react';
import { Video, Music, Search, Cpu, ShieldCheck } from 'lucide-react';

export default function WelcomeHero({ visible }) {
  return (
    <div className={`welcome-hero-container ${!visible ? 'welcome-hidden' : ''}`}>
      {/* Title Hero */}
      <div className="welcome-hero-header">
        <span className="welcome-badge">Descargas al instante</span>
        <h1>Descarga videos y música sin límites</h1>
        <p>Busca tus canciones o pega un enlace para bajarlos en alta calidad de forma muy sencilla.</p>
      </div>

      {/* Grid Cards */}
      <div className="welcome-grid">
        <div className="welcome-card glass-card">
          <div className="welcome-icon-box primary">
            <Video size={24} />
          </div>
          <h3>Calidad de Imagen Máxima</h3>
          <p>Descarga tus videos en alta definición (1080p, 720p y más) listos para ver con audio integrado.</p>
        </div>

        <div className="welcome-card glass-card">
          <div className="welcome-icon-box secondary">
            <Music size={24} />
          </div>
          <h3>Música en MP3</h3>
          <p>Guarda tus canciones favoritas en archivos de sonido MP3 limpios y listos para escuchar.</p>
        </div>

        <div className="welcome-card glass-card">
          <div className="welcome-icon-box accent">
            <Search size={24} />
          </div>
          <h3>Búsqueda Simple</h3>
          <p>Escribe el nombre del video o copia la dirección de la página. Te daremos las mejores opciones de inmediato.</p>
        </div>
      </div>

      {/* Stats/Badge Banner */}
      <div className="welcome-banner glass-card">
        <div className="banner-item">
          <Cpu size={20} className="banner-icon" />
          <div>
            <h4>Descargas Rápidas</h4>
            <p>Compatible con todos los videos y canciones de la plataforma.</p>
          </div>
        </div>
        <div className="banner-divider" />
        <div className="banner-item">
          <ShieldCheck size={20} className="banner-icon" />
          <div>
            <h4>Seguro y Privado</h4>
            <p>Tus descargas son 100% privadas y se guardan directamente en tu computadora.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
