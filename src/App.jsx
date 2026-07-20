import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import SearchBox from './components/SearchBox.jsx';
import SearchResults from './components/SearchResults.jsx';
import DownloadPanel from './components/DownloadPanel.jsx';
import DownloadProgress from './components/DownloadProgress.jsx';
import WelcomeHero from './components/WelcomeHero.jsx';
import DonateModal from './components/DonateModal.jsx';
import { AlertCircle, Terminal, HelpCircle } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState({ ytDlpReady: false, ffmpegReady: false });
  const [searchResults, setSearchResults] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [activeTaskIds, setActiveTaskIds] = useState([]);
  const [downloadingConfigs, setDownloadingConfigs] = useState([]); // Array of "url_format_quality"
  
  // Loading states
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  
  // Modal states
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  
  // Feedback states
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Fetch status of backend bin files on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('No se pudo verificar el estado del servidor.');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
      setError('El servidor backend local no responde. Asegúrate de iniciar la aplicación con "npm run dev".');
    }
  };

  const handleSearch = async (query, isUrl) => {
    setError(null);
    setSuccessMsg(null);
    
    if (isUrl) {
      // Analyze URL
      setIsAnalyzing(true);
      setVideoInfo(null);
      setSearchResults(null);
      
      try {
        const response = await fetch(`/api/info?url=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo obtener información del video.');
        }
        
        // Use the clean URL from the backend (strips playlist params like &list=)
        setVideoInfo({ ...data, url: data.url || query });
      } catch (e) {
        setError(e.message);
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      // Search term
      setIsSearching(true);
      setVideoInfo(null);
      setSearchResults(null);
      
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Ocurrió un error al buscar.');
        }
        
        setSearchResults(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleDownload = async (format, quality) => {
    if (!videoInfo) return;
    setError(null);

    const configKey = `${videoInfo.url}_${format}_${quality}`;
    
    // Prevent starting the exact same download if it's already active
    if (downloadingConfigs.includes(configKey)) {
      return;
    }

    // Add config key to disable buttons on panel
    setDownloadingConfigs((prev) => [...prev, configKey]);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.url,
          format,
          quality,
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo iniciar la descarga.');
      }

      // Add task ID to our active list to spawn a progress card (prevent duplicate cards)
      setActiveTaskIds((prev) => {
        if (prev.includes(data.taskId)) {
          return prev;
        }
        return [data.taskId, ...prev];
      });
    } catch (e) {
      setError(e.message);
      // Remove config key on direct network trigger failure
      setDownloadingConfigs((prev) => prev.filter(key => key !== configKey));
    }
  };

  // Monitor progress changes and sync active downloading configurations
  const handleTaskUpdate = (taskData) => {
    if (taskData.url && taskData.format && taskData.quality) {
      const configKey = `${taskData.url}_${taskData.format}_${taskData.quality}`;
      
      if (taskData.status === 'completed' || taskData.status === 'failed') {
        // Remove from active downloading configs once finished/failed
        setDownloadingConfigs((prev) => prev.filter(key => key !== configKey));
      } else {
        // Add to active downloading list if it isn't there already (e.g. on SSE reconnect/sync)
        setDownloadingConfigs((prev) => {
          if (prev.includes(configKey)) return prev;
          return [...prev, configKey];
        });
      }
    }
  };

  const handleSelectVideo = (videoUrl) => {
    handleSearch(videoUrl, true);
  };

  const handleSetup = async () => {
    setIsWorking(true);
    setError(null);
    setSuccessMsg('Descargando e instalando yt-dlp.exe. Por favor, espera...');
    
    try {
      const response = await fetch('/api/setup', { method: 'POST' });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Error al descargar el ejecutable.');
      
      setSuccessMsg('yt-dlp.exe se instaló correctamente.');
      fetchStatus();
    } catch (e) {
      setError(e.message);
      setSuccessMsg(null);
    } finally {
      setIsWorking(false);
    }
  };

  const allReady = status.ytDlpReady && status.ffmpegReady;

  return (
    <div>
      <Header 
        status={status} 
        onSetup={handleSetup} 
        isWorking={isWorking}
        onOpenDonate={() => setIsDonateOpen(true)}
      />

      <main className="container">
        
        {/* Error Alert Box */}
        {error && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <div>{error}</div>
          </div>
        )}

        {/* Success / Status Messages Banner */}
        {successMsg && (
          <div className="glass-card" style={{ borderLeft: '4px solid var(--color-secondary)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Terminal size={18} style={{ color: 'var(--color-secondary)' }} />
            <div style={{ fontSize: '0.9rem', color: 'var(--color-foreground)' }}>{successMsg}</div>
          </div>
        )}

        {/* Informative onboarding panel if dependencies are missing */}
        {!allReady && !isWorking && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid var(--color-primary)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-foreground)' }}>
              <HelpCircle size={20} style={{ color: 'var(--color-primary)' }} />
              Configuración Inicial
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-foreground-muted)', lineHeight: '1.6' }}>
              Para descargar videos y música, la aplicación necesita instalar unas herramientas la primera vez. 
              Solo toma un momento.
            </p>
            <button className="btn-primary" onClick={handleSetup} style={{ width: 'fit-content' }}>
              Configurar Automáticamente
            </button>
          </div>
        )}

        {/* Search Field Control */}
        {allReady && (
          <>
            <SearchBox onSearch={handleSearch} isSearching={isSearching || isAnalyzing} />
            <WelcomeHero visible={!searchResults && !videoInfo && !isSearching && !isAnalyzing} />
          </>
        )}

        {/* Loading Skeletons for Search Results */}
        {isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="skeleton" style={{ height: '24px', width: '200px' }} />
            <div className="results-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card" style={{ padding: '0.85rem' }}>
                  <div className="skeleton skeleton-thumb" />
                  <div className="skeleton skeleton-text" />
                  <div className="skeleton skeleton-text short" />
                  <div className="skeleton" style={{ height: '35px', marginTop: '1rem', borderRadius: '10px' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading Skeleton for Video Analysis */}
        {isAnalyzing && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div className="download-panel-layout">
              <div className="panel-left">
                <div className="skeleton selected-thumbnail" style={{ height: '220px' }} />
                <div className="skeleton skeleton-text" style={{ height: '28px', marginTop: '1rem' }} />
                <div className="skeleton skeleton-text short" style={{ height: '16px' }} />
              </div>
              <div className="panel-right" style={{ gap: '1rem' }}>
                <div className="skeleton" style={{ height: '40px', width: '250px', marginBottom: '1rem' }} />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: '60px', borderRadius: '10px' }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search Results Display */}
        {searchResults && (
          <SearchResults results={searchResults} onSelectVideo={handleSelectVideo} />
        )}

        {/* Selected Video Config Panel */}
        {videoInfo && (
          <DownloadPanel 
            videoInfo={videoInfo} 
            onDownload={handleDownload} 
            activeConfigs={downloadingConfigs} 
          />
        )}

        {/* Active Downloads List */}
        <DownloadProgress 
          taskIds={activeTaskIds} 
          onTaskUpdate={handleTaskUpdate} 
        />

      </main>

      {/* Donation Modal */}
      <DonateModal 
        isOpen={isDonateOpen} 
        onClose={() => setIsDonateOpen(false)} 
      />
    </div>
  );
}
