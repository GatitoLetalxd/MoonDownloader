import React, { useState } from 'react';
import { X, Shield, FileText, AlertTriangle, Scale } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LegalModal({ isOpen, onClose, initialTab = 'terms' }) {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  const isEn = lang === 'en';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-card donate-modal" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="donate-modal-header">
          <div className="donate-title-badge" style={{ background: 'rgba(0, 242, 254, 0.1)', borderColor: 'rgba(0, 242, 254, 0.3)', color: 'var(--color-primary)' }}>
            <Scale size={16} />
            <span>{isEn ? 'Legal & Privacy' : 'Legal y Privacidad'}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('terms')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: activeTab === 'terms' ? '1px solid var(--color-primary)' : '1px solid transparent',
              background: activeTab === 'terms' ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
              color: activeTab === 'terms' ? 'var(--color-primary)' : 'var(--color-foreground-muted)',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <FileText size={15} />
            <span>{isEn ? 'Terms of Service' : 'Términos de Servicio'}</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: activeTab === 'privacy' ? '1px solid var(--color-secondary)' : '1px solid transparent',
              background: activeTab === 'privacy' ? 'rgba(79, 172, 254, 0.12)' : 'transparent',
              color: activeTab === 'privacy' ? 'var(--color-secondary)' : 'var(--color-foreground-muted)',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Shield size={15} />
            <span>{isEn ? 'Privacy Policy' : 'Política de Privacidad'}</span>
          </button>

          <button
            onClick={() => setActiveTab('dmca')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: activeTab === 'dmca' ? '1px solid var(--color-warning)' : '1px solid transparent',
              background: activeTab === 'dmca' ? 'rgba(255, 171, 0, 0.12)' : 'transparent',
              color: activeTab === 'dmca' ? 'var(--color-warning)' : 'var(--color-foreground-muted)',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <AlertTriangle size={15} />
            <span>{isEn ? 'DMCA / Disclaimer' : 'Aviso DMCA'}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ fontSize: '0.88rem', color: 'var(--color-foreground)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {activeTab === 'terms' && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                {isEn ? 'Terms of Service' : 'Términos de Servicio'}
              </h3>
              <p style={{ color: 'var(--color-foreground-muted)', marginBottom: '0.5rem' }}>
                {isEn
                  ? 'By using MoonDownloader, you agree to comply with all applicable local, national, and international laws. MoonDownloader is designed exclusively for personal, non-commercial use to download and convert publicly accessible media.'
                  : 'Al utilizar MoonDownloader, aceptas cumplir con todas las leyes locales, nacionales e internacionales aplicables. MoonDownloader está diseñado exclusivamente para uso personal y no comercial de contenido de acceso público.'}
              </p>
              <p style={{ color: 'var(--color-foreground-muted)' }}>
                {isEn
                  ? 'Users are solely responsible for ensuring they have the legal right or permission from copyright owners before downloading or converting any content.'
                  : 'El usuario es el único responsable de contar con los derechos o autorización del titular del contenido antes de descargar o convertir cualquier archivo.'}
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                {isEn ? 'Privacy Policy' : 'Política de Privacidad'}
              </h3>
              <p style={{ color: 'var(--color-foreground-muted)', marginBottom: '0.5rem' }}>
                {isEn
                  ? 'MoonDownloader respects your privacy. We do not require account registration, do not collect personal identifiable information (PII), and do not track your downloads.'
                  : 'MoonDownloader respeta tu privacidad. No solicitamos registro de cuentas, no recolectamos datos personales identificables ni rastreamos tus descargas.'}
              </p>
              <p style={{ color: 'var(--color-foreground-muted)' }}>
                {isEn
                  ? 'All converted files are temporarily held on server memory/storage strictly for the duration of the download delivery and are automatically erased within 5 minutes.'
                  : 'Todos los archivos convertidos se almacenan de forma temporal exclusivamente durante la entrega de la descarga y se eliminan automáticamente tras 5 minutos.'}
              </p>
            </div>
          )}

          {activeTab === 'dmca' && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                {isEn ? 'DMCA & Copyright Disclaimer' : 'Aviso de Derechos de Autor (DMCA)'}
              </h3>
              <p style={{ color: 'var(--color-foreground-muted)', marginBottom: '0.5rem' }}>
                {isEn
                  ? 'MoonDownloader does not host, store, or index copyrighted videos on its servers. We merely provide a client-side conversion and download tool for content available publicly on third-party platforms.'
                  : 'MoonDownloader no aloja, almacena ni indexa vídeos con derechos de autor en sus servidores. Proporcionamos una herramienta de conversión y descarga de contenidos públicos alojados en plataformas de terceros.'}
              </p>
              <p style={{ color: 'var(--color-foreground-muted)' }}>
                {isEn
                  ? 'If you are a copyright owner and wish to submit a notice, please contact us with the relevant URL details.'
                  : 'Si eres titular de derechos de autor y deseas enviar una notificación, puedes ponerte en contacto con nosotros detallando la información pertinente.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.45rem 1.25rem' }}>
            {isEn ? 'Close' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  );
}
