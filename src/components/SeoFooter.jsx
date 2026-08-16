import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ShieldCheck, Zap, Infinity as InfinityIcon, Scale } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import LegalModal from './LegalModal.jsx';

export default function SeoFooter() {
  const { t, lang } = useLanguage();
  const [openFaq, setOpenFaq] = useState(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState('terms');

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const openLegal = (tab) => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  };

  const questions = translationsList(lang);
  const isEn = lang === 'en';

  return (
    <footer style={{ marginTop: '4rem', borderTop: '1px solid var(--border-light)', paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        
        {/* Key Features Block */}
        <section className="seo-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--color-primary)', background: 'rgba(0, 242, 254, 0.1)', width: 'fit-content', padding: '0.6rem', borderRadius: '12px' }}>
              <InfinityIcon size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{t('seo.feat1Title')}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-foreground-muted)', lineHeight: '1.5' }}>{t('seo.feat1Desc')}</p>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--color-secondary)', background: 'rgba(79, 172, 254, 0.1)', width: 'fit-content', padding: '0.6rem', borderRadius: '12px' }}>
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{t('seo.feat2Title')}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-foreground-muted)', lineHeight: '1.5' }}>{t('seo.feat2Desc')}</p>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--color-success)', background: 'rgba(0, 230, 118, 0.1)', width: 'fit-content', padding: '0.6rem', borderRadius: '12px' }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{t('seo.feat3Title')}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-foreground-muted)', lineHeight: '1.5' }}>{t('seo.feat3Desc')}</p>
          </div>
        </section>

        {/* FAQ Accordion Section for SEO */}
        <section className="seo-faq-section glass-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <HelpCircle size={24} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '700' }}>{t('seo.faqTitle')}</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-foreground-muted)' }}>{t('seo.faqSub')}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {questions.map((faq, idx) => (
              <div 
                key={idx} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-foreground)',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.2s ease',
                      color: 'var(--color-primary)'
                    }} 
                  />
                </button>
                {openFaq === idx && (
                  <div style={{ padding: '0 1.25rem 1rem 1.25rem', fontSize: '0.88rem', color: 'var(--color-foreground-muted)', lineHeight: '1.6' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Legal & Trust Navigation Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <button
            onClick={() => openLegal('terms')}
            style={{ background: 'none', border: 'none', color: 'var(--color-foreground-muted)', cursor: 'pointer', textDecoration: 'underline', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-foreground-muted)'}
          >
            {isEn ? 'Terms of Service' : 'Términos de Servicio'}
          </button>

          <button
            onClick={() => openLegal('privacy')}
            style={{ background: 'none', border: 'none', color: 'var(--color-foreground-muted)', cursor: 'pointer', textDecoration: 'underline', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-foreground-muted)'}
          >
            {isEn ? 'Privacy Policy' : 'Política de Privacidad'}
          </button>

          <button
            onClick={() => openLegal('dmca')}
            style={{ background: 'none', border: 'none', color: 'var(--color-foreground-muted)', cursor: 'pointer', textDecoration: 'underline', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-foreground-muted)'}
          >
            {isEn ? 'DMCA & Copyright' : 'Aviso Legal DMCA'}
          </button>
        </div>

        {/* Footer Rights */}
        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-foreground-muted)' }}>
          <p>© {new Date().getFullYear()} {t('seo.footerRights')}</p>
        </div>

      </div>

      {/* Legal Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalTab}
      />
    </footer>
  );
}

function translationsList(lang) {
  if (lang === 'en') {
    return [
      {
        q: "Is downloading videos with MoonDownloader free?",
        a: "Yes, MoonDownloader is 100% free, requires no registration, and is completely free of annoying ads or link shorteners."
      },
      {
        q: "What formats and video qualities are supported?",
        a: "You can download MP4 videos from 360p up to 1080p Full HD and 4K (60fps), or extract high-fidelity MP3 audio at 320 kbps."
      },
      {
        q: "Can I use it on mobile phones and PC?",
        a: "Yes! It works smoothly on all mobile web browsers (Android/iOS) and desktop systems (Windows, Mac, Linux)."
      },
      {
        q: "Are downloaded files kept on a server?",
        a: "No. Downloads are temporarily processed for you and automatically deleted after a few minutes to protect your privacy."
      }
    ];
  }
  return [
    {
      q: "¿Es gratis descargar vídeos con MoonDownloader?",
      a: "Sí, MoonDownloader es 100% gratuito, sin necesidad de registro y totalmente libre de anuncios molestos o acortadores."
    },
    {
      q: "¿Qué formatos y calidades puedo descargar?",
      a: "Puedes descargar vídeo en formato MP4 desde 360p hasta 1080p Full HD y 4K (60fps), o bien extraer audio en formato MP3 de alta fidelidad a 320 kbps."
    },
    {
      q: "¿Puedo usarlo en dispositivos móviles y PC?",
      a: "Sí, funciona en cualquier navegador web en celulares (Android/iOS) y ordenadores (Windows, Mac, Linux)."
    },
    {
      q: "¿Se guardan los vídeos en algún servidor?",
      a: "No. Las descargas se procesan temporalmente para ti y se eliminan automáticamente tras unos minutos para preservar tu privacidad."
    }
  ];
}
