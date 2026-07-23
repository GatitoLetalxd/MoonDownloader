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
      <div className="logo-container">
        <img 
          src={LogoImg} 
          alt="MoonDownloader Logo" 
          className="header-logo-img"
        />
        <span className="logo-text">MoonDownloader</span>
      </div>

      <div className="header-actions">
        {/* Language Switcher Button */}
        <button
          onClick={toggleLanguage}
          className="lang-switcher-btn"
          title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        >
          <Globe size={15} style={{ color: 'var(--color-primary)' }} />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Binary Status Badges */}
        <div className="header-badges-group">
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
