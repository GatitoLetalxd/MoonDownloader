import React, { useState } from 'react';
import { Video, Music, Download, Clock, User } from 'lucide-react';
import { formatDuration } from '../utils.js';

export default function DownloadPanel({ videoInfo, onDownload, activeConfigs = [] }) {
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'audio'

  const isConfigActive = (format, quality) => {
    const key = `${videoInfo.url}_${format}_${quality}`;
    return activeConfigs.includes(key);
  };

  const audioOptions = [
    { quality: '320k', label: 'Calidad Máxima (320 kbps)', sub: 'La mejor definición de sonido, ideal para escuchar música.' },
    { quality: '256k', label: 'Calidad Alta (256 kbps)', sub: 'Excelente sonido, ocupa menos espacio en tu dispositivo.' },
    { quality: '128k', label: 'Calidad Estándar (128 kbps)', sub: 'Calidad básica de audio, se descarga muy rápido.' }
  ];

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <div className="download-panel-layout">
        
        {/* Left Side: Thumbnail & Meta */}
        <div className="panel-left">
          <img 
            src={videoInfo.thumbnail} 
            alt={videoInfo.title} 
            className="selected-thumbnail"
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'; }}
          />
          <div className="selected-video-meta">
            <h3 className="selected-video-title">{videoInfo.title}</h3>
            
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-foreground-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} />
                <span>{videoInfo.uploader}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} />
                <span>{formatDuration(videoInfo.duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Options Form */}
        <div className="panel-right">
          <div className="format-choice-tabs">
            <button 
              className={`format-tab-btn ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => setActiveTab('video')}
            >
              <Video size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
              Video (MP4)
            </button>
            <button 
              className={`format-tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
              onClick={() => setActiveTab('audio')}
            >
              <Music size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
              Audio (MP3)
            </button>
          </div>

          <div className="options-list">
            {activeTab === 'video' ? (
              // Video Resolutions List
              videoInfo.resolutions.length > 0 ? (
                videoInfo.resolutions.map((res) => {
                  const isActive = isConfigActive('video', res.height.toString());
                  return (
                    <div key={res.height} className="option-row">
                      <div className="option-details">
                        <span className="option-name">{res.label}</span>
                        <span className="option-sub">Video compatible con celulares y computadoras</span>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => onDownload('video', res.height.toString())}
                        disabled={isActive}
                      >
                        <Download size={14} />
                        {isActive ? 'Descargando...' : 'Descargar'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-foreground-muted)' }}>
                  No se encontraron calidades de video estándar. Intenta con calidad automática.
                </div>
              )
            ) : (
              // Audio Bitrates List
              audioOptions.map((opt) => {
                const isActive = isConfigActive('audio', opt.quality);
                return (
                  <div key={opt.quality} className="option-row">
                    <div className="option-details">
                      <span className="option-name">{opt.label}</span>
                      <span className="option-sub">{opt.sub}</span>
                    </div>
                    <button 
                      className="btn-primary" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      onClick={() => onDownload('audio', opt.quality)}
                      disabled={isActive}
                    >
                      <Download size={14} />
                      {isActive ? 'Descargando...' : 'Extraer MP3'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
