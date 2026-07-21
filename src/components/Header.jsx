import React from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Heart, Globe, ShieldAlert } from 'lucide-react';
import LogoImg from '../logo.png';
import { useLanguage } from '../context/LanguageContext';

export default function Header({ status, onSetup, isWorking, onOpenDonate, onOpenCookies }) {
  const { lang, setLang, t } = useLanguage();
  const allReady = status.ytDlpReady && status.ffmpegReady;

  const toggleLanguage = () => {
    setLang(lang === 'es' ? 'en' : 'es');
  };

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Language Switcher Button */}
        <button
          onClick={toggleLanguage}
          className="lang-switcher-btn"
          title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--color-foreground)',
            padding: '0.4rem 0.75rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          <Globe size={15} style={{ color: 'var(--color-primary)' }} />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Cookies / Anti-bot Badge */}
        <button
          onClick={onOpenCookies}
          title={status.hasCookies ? 'Cookies.txt activo' : 'Configurar cookies para evitar bloqueos de YouTube'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: status.hasCookies ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 171, 0, 0.12)',
            border: status.hasCookies ? '1px solid var(--color-success)' : '1px solid var(--color-warning)',
            color: status.hasCookies ? 'var(--color-success)' : 'var(--color-warning)',
            padding: '0.4rem 0.75rem',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          {status.hasCookies ? <CheckCircle size={14} /> : <ShieldAlert size={14} />}
          <span>Cookies</span>
        </button>

        {/* Binary Status Badges */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
          title={t('header.supportTitle')}
        >
          <Heart size={15} className="donate-heart-icon" />
          <span>{t('header.support')}</span>
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
            {t('header.installBinaries')}
          </button>
        )}
      </div>
    </header>
  );
}
