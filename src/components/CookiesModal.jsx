import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle, Trash2, Save, FileText, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function CookiesModal({ isOpen, onClose, onCookiesUpdated }) {
  const { t, lang } = useLanguage();
  const [cookieContent, setCookieContent] = useState('');
  const [status, setStatus] = useState({ exists: false, size: 0, updatedAt: null });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/cookies');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!cookieContent.trim()) {
      setError(lang === 'es' ? 'Por favor, pega el contenido del archivo cookies.txt' : 'Please paste the contents of cookies.txt');
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const res = await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cookieContent })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar.');

      setMsg(lang === 'es' ? '¡cookies.txt guardado correctamente!' : 'cookies.txt saved successfully!');
      setCookieContent('');
      fetchStatus();
      if (onCookiesUpdated) onCookiesUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(lang === 'es' ? '¿Deseas eliminar el archivo cookies.txt?' : 'Delete cookies.txt?')) return;
    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const res = await fetch('/api/cookies', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar.');

      setMsg(lang === 'es' ? 'cookies.txt eliminado.' : 'cookies.txt removed.');
      fetchStatus();
      if (onCookiesUpdated) onCookiesUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-card donate-modal" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="donate-modal-header">
          <div className="donate-title-badge">
            <ShieldAlert size={18} style={{ color: 'var(--color-primary)' }} />
            <span>{lang === 'es' ? 'Configuración de Cookies YouTube (Anti-Bot)' : 'YouTube Cookies Configuration'}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: status.exists ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 171, 0, 0.1)', borderRadius: '12px', border: status.exists ? '1px solid var(--color-success)' : '1px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {status.exists ? <CheckCircle size={20} style={{ color: 'var(--color-success)' }} /> : <ShieldAlert size={20} style={{ color: 'var(--color-warning)' }} />}
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--color-foreground)' }}>
                {status.exists ? (lang === 'es' ? 'cookies.txt Activo' : 'cookies.txt Active') : (lang === 'es' ? 'Sin cookies.txt' : 'No cookies.txt')}
              </strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-foreground-muted)' }}>
                {status.exists 
                  ? `${status.size} bytes | ${lang === 'es' ? 'Actualizado:' : 'Updated:'} ${new Date(status.updatedAt).toLocaleString()}` 
                  : (lang === 'es' ? 'YouTube puede requerir cookies en servidores VPS para evitar el bloqueo anti-bot.' : 'YouTube may require cookies on VPS servers to bypass bot protection.')}
              </div>
            </div>
          </div>

          {status.exists && (
            <button 
              onClick={handleDelete} 
              disabled={loading}
              style={{ background: 'rgba(255, 82, 82, 0.15)', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '0.4rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
            >
              <Trash2 size={14} />
              {lang === 'es' ? 'Eliminar' : 'Delete'}
            </button>
          )}
        </div>

        {/* Instructions */}
        <div style={{ fontSize: '0.88rem', color: 'var(--color-foreground-muted)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p>
            {lang === 'es'
              ? 'YouTube bloquea las solicitudes desde servidores VPS exigiendo inicio de sesión ("Sign in to confirm you’re not a bot"). Al guardar las cookies de tu navegador, el servidor podrá procesar todas las descargas sin restricciones.'
              : 'YouTube blocks requests from cloud VPS servers requiring sign-in. Saving browser cookies allows the server to process all downloads seamlessly.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '8px' }}>
            <FileText size={16} style={{ color: 'var(--color-primary)' }} />
            <span>
              {lang === 'es' ? 'Puedes usar la extensión gratuita de Chrome/Firefox ' : 'You can use the free extension '}
              <a href="https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontWeight: '600' }}>
                Get cookies.txt LOCALLY <ExternalLink size={12} style={{ display: 'inline' }} />
              </a>
              {lang === 'es' ? ' para exportar tus cookies de youtube.com en formato Netscape.' : ' to export youtube.com cookies in Netscape format.'}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {msg && <div style={{ color: 'var(--color-success)', background: 'rgba(0, 230, 118, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>{msg}</div>}
        {error && <div style={{ color: 'var(--color-error)', background: 'rgba(255, 82, 82, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>{error}</div>}

        {/* Textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-foreground)' }}>
            {lang === 'es' ? 'Pegar contenido de cookies.txt:' : 'Paste cookies.txt content:'}
          </label>
          <textarea
            rows={7}
            placeholder="# Netscape HTTP Cookie File&#10;.youtube.com TRUE / TRUE 0 VISITOR_INFO1_LIVE ..."
            value={cookieContent}
            onChange={(e) => setCookieContent(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              color: 'var(--color-foreground)',
              padding: '0.75rem',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>
            {lang === 'es' ? 'Cancelar' : 'Cancel'}
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Save size={16} />
            {loading ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar Cookies' : 'Save Cookies')}
          </button>
        </div>

      </div>
    </div>
  );
}
