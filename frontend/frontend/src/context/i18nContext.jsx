import React, { createContext, useState, useEffect } from 'react';
import { translations, SUPPORTED_LANGUAGES, getDefaultLanguage } from '../config/i18n.config';

export const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState(getDefaultLanguage());

  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // Translate function with nested key support
  const t = (key, defaultValue = key) => {
    const keys = key.split('.');
    let value = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return typeof value === 'string' ? value : defaultValue;
  };

  // Translate with variable substitution
  const tVar = (key, variables = {}) => {
    let text = t(key);
    
    Object.entries(variables).forEach(([varName, varValue]) => {
      text = text.replace(new RegExp(`{${varName}}`, 'g'), varValue);
    });

    return text;
  };

  const changeLanguage = (lang) => {
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      setLanguage(lang);
    }
  };

  const value = {
    language,
    setLanguage: changeLanguage,
    t,
    tVar,
    supportedLanguages: SUPPORTED_LANGUAGES
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};
