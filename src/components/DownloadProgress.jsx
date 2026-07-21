import React, { useState, useEffect } from 'react';
import { DownloadCloud, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

function ProgressItem({ taskId, onTaskUpdate }) {
  const { t, lang } = useLanguage();
  const [task, setTask] = useState(null);

  useEffect(() => {
    // Open Server-Sent Events connection
    const eventSource = new EventSource(`/api/download/progress/${taskId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTask(data);
        
        // Notify parent of state/status change (e.g. format, quality, status)
        if (onTaskUpdate) {
          onTaskUpdate(data);
        }

        // If completed or failed, close SSE connection
        if (data.status === 'completed' || data.status === 'failed') {
          eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE data:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [taskId]);

  if (!task) {
    return (
      <div className="glass-card queue-card skeleton" style={{ height: '90px' }} />
    );
  }

  const getStatusText = () => {
    switch (task.status) {
      case 'queued': return lang === 'es' ? 'En cola...' : 'Queued...';
      case 'downloading': return t('progress.statusDownloading');
      case 'processing': return task.eta || t('progress.statusProcessing');
      case 'completed': return t('progress.statusCompleted');
      case 'failed': return t('progress.statusFailed');
      default: return '...';
    }
  };

  const isDownloading = task.status === 'downloading';
  const isProcessing = task.status === 'processing';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  return (
    <div className={`glass-card queue-card ${isFailed ? 'failed-card' : ''}`} style={{ padding: '1rem', borderLeft: isCompleted ? '4px solid var(--color-success)' : (isFailed ? '4px solid var(--color-error)' : '1px solid var(--border-light)') }}>
      
      {/* Thumbnail */}
      <img 
        src={task.thumbnail} 
        alt={task.title} 
        className="queue-card-thumb"
        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200'; }}
      />

      {/* Progress Core */}
      <div className="queue-card-content">
        <div className="queue-card-title" title={task.title}>
          {task.title}
        </div>

        {/* Progress Bar */}
        {!isFailed && !isCompleted && (
          <div className="queue-progress-bar-container">
            <div 
              className="queue-progress-bar" 
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}

        {/* Details and Speed */}
        <div className="queue-meta-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {(isDownloading || isProcessing) && <span className="pulse-dot" />}
            <span className={`queue-status-text ${task.status}`}>
              {getStatusText()}
            </span>
          </div>

          {!isCompleted && !isFailed && (
            <div className="queue-speed-eta">
              <span>{task.speed}</span>
              <span>{task.eta}</span>
            </div>
          )}

          {isCompleted && (
            <span style={{ color: 'var(--color-success)', fontSize: '0.85rem' }}>
              {t('progress.statusCompleted')}
            </span>
          )}
        </div>

        {/* Error message */}
        {isFailed && (
          <div style={{ color: '#ff8a80', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {task.error || (lang === 'es' ? 'Ocurrió un error inesperado.' : 'An unexpected error occurred.')}
          </div>
        )}
      </div>

      {/* Actions (Browser download trigger) */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
        {isCompleted && task.filename && (
          <a 
            href={`/api/files/${encodeURIComponent(task.filename)}`}
            download={task.filename}
            className="btn-primary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', textDecoration: 'none' }}
          >
            <ExternalLink size={12} />
            {t('progress.downloadFile')}
          </a>
        )}
        
        {(isDownloading || isProcessing) && (
          <Loader2 size={20} className="skeleton" style={{ animation: 'spin 1s linear infinite', color: 'var(--color-secondary)' }} />
        )}
        
        {isCompleted && (
          <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
        )}

        {isFailed && (
          <AlertCircle size={20} style={{ color: 'var(--color-error)' }} />
        )}
      </div>
    </div>
  );
}

export default function DownloadProgress({ taskIds, onTaskUpdate }) {
  const { t } = useLanguage();
  if (taskIds.length === 0) return null;

  return (
    <div className="queue-wrapper">
      <div className="queue-title">
        <DownloadCloud size={20} style={{ color: 'var(--color-secondary)' }} />
        <h3>{t('progress.activeTitle')}</h3>
      </div>
      
      <div className="queue-items">
        {taskIds.map((taskId) => (
          <ProgressItem 
            key={taskId} 
            taskId={taskId} 
            onTaskUpdate={onTaskUpdate}
          />
        ))}
      </div>
    </div>
  );
}
