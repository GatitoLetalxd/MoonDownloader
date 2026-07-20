import React, { useState, useEffect } from 'react';
import { Search, Link, X, Loader2 } from 'lucide-react';

export default function SearchBox({ onSearch, isSearching }) {
  const [query, setQuery] = useState('');
  const [isUrl, setIsUrl] = useState(false);

  // Detect if the query is a YouTube URL
  useEffect(() => {
    const trimmed = query.trim();
    const isYoutubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(trimmed);
    setIsUrl(isYoutubeUrl);
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), isUrl);
    }
  };

  const handleClear = () => {
    setQuery('');
  };

  return (
    <form className="glass-card" style={{ padding: '1.5rem' }} onSubmit={handleSubmit}>
      <div className="search-box-wrapper">
        <label 
          htmlFor="search-input" 
          style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-foreground-muted)', display: 'block' }}
        >
          Ingresa un enlace de YouTube o escribe términos de búsqueda
        </label>
        
        <div className="search-input-container">
          {isUrl ? (
            <Link className="search-icon" size={20} />
          ) : (
            <Search className="search-icon" size={20} />
          )}
          
          <input
            id="search-input"
            type="text"
            className="search-input"
            placeholder="Pegar enlace (https://youtube.com/watch?v=...) o buscar canciones, canales, mixes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
            autoComplete="off"
          />

          {query && (
            <button 
              type="button" 
              className="search-clear-btn" 
              onClick={handleClear}
              disabled={isSearching}
              style={{ right: '11rem' }}
            >
              <X size={18} />
            </button>
          )}

          <button 
            type="submit" 
            className="btn-primary search-btn"
            disabled={!query.trim() || isSearching}
          >
            {isSearching ? (
              <>
                <Loader2 size={16} className="skeleton" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                {isUrl ? 'Analizar Enlace' : 'Buscar'}
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}
