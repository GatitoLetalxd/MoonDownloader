import React, { useState } from 'react';
import { X, Heart, QrCode, ExternalLink, Check, Copy } from 'lucide-react';
import qrImage from '../assets/qr_yape_plin.png';
import qrPaypalImage from '../assets/qr_paypal.png';
import { useLanguage } from '../context/LanguageContext';

export default function DonateModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const [showQr, setShowQr] = useState(false);
  const [showPaypalQr, setShowPaypalQr] = useState(false);
  const [copiedPaypal, setCopiedPaypal] = useState(false);

  if (!isOpen) return null;

  const handleCopyPaypal = () => {
    navigator.clipboard.writeText('rogeeromontufar@gmail.com');
    setCopiedPaypal(true);
    setTimeout(() => setCopiedPaypal(false), 2500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-card donate-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="donate-modal-header">
          <div className="donate-title-badge">
            <Heart size={18} className="heart-icon-pulse" />
            <span>{t('header.support')}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Intro */}
        <div className="donate-intro">
          <h2>{t('donate.title')}</h2>
          <p>{t('donate.desc')}</p>
        </div>

        {/* Donation Options Container */}
        <div className="donate-methods-grid">
          
          {/* Method 1: Yape & Plin */}
          <div className="donate-card yape-plin-card">
            <div className="donate-card-header">
              <div className="brand-badges">
                <span className="badge-yape">Yape</span>
                <span className="badge-plin">Plin</span>
              </div>
              <span className="country-tag">Perú</span>
            </div>

            <div className="donate-card-body">
              <div className="phone-number-display">
                <span className="phone-label">Número Yape / Plin</span>
                <span className="phone-val">983 126 035</span>
                <span className="phone-holder">Titular: Roger R. Montufar</span>
              </div>

              <button 
                type="button" 
                className={`btn-show-qr ${showQr ? 'active' : ''}`}
                onClick={() => setShowQr(!showQr)}
              >
                <QrCode size={18} />
                <span>{showQr ? 'Ocultar QR Yape/Plin' : 'Mostrar QR Yape/Plin'}</span>
              </button>

              {/* Collapsible QR Code Box */}
              {showQr && (
                <div className="qr-container">
                  <img src={qrImage} alt="Código QR Yape Plin 983126035" className="qr-image" />
                  <p className="qr-caption">{t('donate.scanYape')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Method 2: PayPal */}
          <div className="donate-card paypal-card">
            <div className="donate-card-header">
              <span className="badge-paypal">PayPal</span>
              <span className="country-tag">International</span>
            </div>

            <div className="donate-card-body">
              <div className="paypal-info-display">
                <span className="phone-label">{t('donate.paypalTitle')}</span>
                <div className="paypal-email-box">
                  <span className="email-val">rogeeromontufar@gmail.com</span>
                  <button 
                    type="button" 
                    className="btn-copy-email" 
                    onClick={handleCopyPaypal}
                    title="Copiar correo de PayPal"
                  >
                    {copiedPaypal ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <a 
                href="https://www.paypal.com/paypalme/Diana1412240" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-paypal-link"
              >
                <ExternalLink size={16} />
                <span>{t('donate.paypalBtn')}</span>
              </a>

              <button 
                type="button" 
                className={`btn-show-qr ${showPaypalQr ? 'active' : ''}`}
                style={{ background: 'rgba(0, 121, 193, 0.12)', borderColor: 'rgba(0, 121, 193, 0.3)', color: '#7bd3fc' }}
                onClick={() => setShowPaypalQr(!showPaypalQr)}
              >
                <QrCode size={18} />
                <span>{showPaypalQr ? 'Ocultar QR PayPal' : 'Mostrar QR PayPal'}</span>
              </button>

              {/* Collapsible PayPal QR Code Box */}
              {showPaypalQr && (
                <div className="qr-container">
                  <img src={qrPaypalImage} alt="Código QR PayPal" className="qr-image" />
                  <p className="qr-caption">Escanea con la cámara de tu celular o la app de PayPal</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="donate-modal-footer">
          <span>{t('seo.footerRights')}</span>
        </div>

      </div>
    </div>
  );
}
