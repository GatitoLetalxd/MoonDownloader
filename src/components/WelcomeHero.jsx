import React from 'react';
import { Video, Music, Search, Cpu, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function WelcomeHero({ visible }) {
  const { t } = useLanguage();

  return (
    <div className={`welcome-hero-container ${!visible ? 'welcome-hidden' : ''}`}>
      {/* Title Hero */}
      <div className="welcome-hero-header">
        <span className="welcome-badge">{t('hero.badge1')}</span>
        <h1>{t('hero.h1Title')}</h1>
        <p>{t('hero.subtitle')}</p>
      </div>

      {/* Grid Cards */}
      <div className="welcome-grid">
        <div className="welcome-card glass-card">
          <div className="welcome-icon-box primary">
            <Video size={24} />
          </div>
          <h3>{t('hero.badge2')}</h3>
          <p>{t('seo.feat1Desc')}</p>
        </div>

        <div className="welcome-card glass-card">
          <div className="welcome-icon-box secondary">
            <Music size={24} />
          </div>
          <h3>{t('hero.badge3')}</h3>
          <p>{t('seo.feat2Desc')}</p>
        </div>

        <div className="welcome-card glass-card">
          <div className="welcome-icon-box accent">
            <Search size={24} />
          </div>
          <h3>{t('seo.feat3Title')}</h3>
          <p>{t('seo.feat3Desc')}</p>
        </div>
      </div>

      {/* Stats/Badge Banner */}
      <div className="welcome-banner glass-card">
        <div className="banner-item">
          <Cpu size={20} className="banner-icon" />
          <div>
            <h4>{t('seo.feat2Title')}</h4>
            <p>{t('seo.feat2Desc')}</p>
          </div>
        </div>
        <div className="banner-divider" />
        <div className="banner-item">
          <ShieldCheck size={20} className="banner-icon" />
          <div>
            <h4>{t('seo.feat3Title')}</h4>
            <p>{t('seo.feat3Desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
