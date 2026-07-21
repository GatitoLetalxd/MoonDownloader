import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // Detect browser language or load from localStorage
  const getInitialLang = () => {
    const saved = localStorage.getItem('moondownloader_lang');
    if (saved && (saved === 'es' || saved === 'en')) {
      return saved;
    }
    const browserLang = navigator.language || navigator.userLanguage || 'es';
    return browserLang.toLowerCase().startsWith('es') ? 'es' : 'en';
  };

  const [lang, setLangState] = useState(getInitialLang);

  const setLang = (newLang) => {
    if (newLang === 'es' || newLang === 'en') {
      setLangState(newLang);
      localStorage.setItem('moondownloader_lang', newLang);
    }
  };

  // Sync DOM attributes and Meta tags when language changes
  useEffect(() => {
    document.documentElement.lang = lang;
    const currentMeta = translations[lang]?.meta;
    if (currentMeta) {
      document.title = currentMeta.title;

      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', currentMeta.description);
      }
      
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', currentMeta.title);
      }

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        ogDesc.setAttribute('content', currentMeta.description);
      }
    }
  }, [lang]);

  // Helper function to resolve nested keys like "hero.h1Title"
  const t = (keyPath) => {
    const keys = keyPath.split('.');
    let current = translations[lang];

    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key];
      } else {
        // Fallback to Spanish if key missing
        let fallback = translations['es'];
        for (const k of keys) {
          if (fallback && fallback[k] !== undefined) fallback = fallback[k];
          else return keyPath;
        }
        return fallback;
      }
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
