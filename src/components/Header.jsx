import React from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Heart } from 'lucide-react';
import LogoImg from '../logo.png';

export default function Header({ status, onSetup, isWorking, onOpenDonate }) {
  const allReady = status.ytDlpReady && status.ffmpegReady;

  return (
    <header className="header">
      <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img 
          src={LogoImg} 
          alt="MoonDownloader Logo" 
          style={{ 
            width: '36px', 
            height: '36px', 
            objectFit: 'contain', 
            borderRadius: '50%', 
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }} 
        />
        <span className="logo-text" style={{ letterSpacing: '0.05em' }}>MoonDownloader</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Binary Status Badges */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div className={`status-badge ${status.ytDlpReady ? 'ready' : 'missing'}`}>
            {status.ytDlpReady ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            <span>yt-dlp</span>
          </div>

          <div className={`status-badge ${status.ffmpegReady ? 'ready' : 'missing'}`}>
            {status.ffmpegReady ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            <span>ffmpeg</span>
          </div>
        </div>

        {/* Support / Donate Button */}
        <button 
          className="btn-donate-header" 
          onClick={onOpenDonate}
          title="Apoyar a mantener MoonDownloader libre de anuncios"
        >
          <Heart size={15} className="donate-heart-icon" />
          <span>Apoyar proyecto</span>
          <div className="header-donate-badges">
            <span className="mini-badge yape">Yape</span>
            <span className="mini-badge plin">Plin</span>
            <span className="mini-badge paypal">PayPal</span>
          </div>
        </button>

        {/* Action Controls */}
        {!allReady && (
          <button 
            className="btn-primary" 
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }} 
            onClick={onSetup}
            disabled={isWorking}
          >
            <RefreshCw size={14} className={isWorking ? 'skeleton' : ''} />
            Instalar Binarios
          </button>
        )}
      </div>
    </header>
  );
}
