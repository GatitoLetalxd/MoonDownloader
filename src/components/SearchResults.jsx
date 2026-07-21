import React from 'react';
import { Play } from 'lucide-react';
import { formatDuration } from '../utils.js';
import { useLanguage } from '../context/LanguageContext';

export default function SearchResults({ results, onSelectVideo }) {
  const { t } = useLanguage();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h3 style={{ fontSize: '1.2rem', fontWeight: '700', borderLeft: '3px solid var(--color-secondary)', paddingLeft: '0.65rem' }}>
        {t('results.title')}
      </h3>

      <div className="results-grid">
        {results.map((video) => (
          <div key={video.id} className="glass-card result-card" style={{ padding: '0.85rem' }}>
            <div className="thumbnail-wrapper">
              <img 
                src={video.thumbnail} 
                alt={video.title} 
                className="thumbnail-img" 
                loading="lazy" 
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'; }}
              />
              <span className="duration-tag">
                {formatDuration(video.duration)}
              </span>
            </div>

            <div className="video-info-meta">
              <h4 className="video-title" title={video.title}>
                {video.title}
              </h4>
              <span className="video-channel">
                {video.uploader}
              </span>
            </div>

            <button 
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}
              onClick={() => onSelectVideo(video.url)}
            >
              <Play size={14} style={{ color: 'var(--color-secondary)' }} />
              {t('results.selectBtn')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
