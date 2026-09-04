import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition">
        <Globe size={20} />
        <span className="text-sm font-medium">{i18n.language.toUpperCase()}</span>
      </button>

      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition flex items-center gap-2 ${
              i18n.language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
            } ${lang.code === 'en' ? 'rounded-t-lg' : ''} ${
              lang.code === 'ar' ? 'rounded-b-lg' : ''
            }`}
          >
            <span>{lang.flag}</span>
            <span className="text-sm">{lang.name}</span>
            {i18n.language === lang.code && (
              <span className="ml-auto">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
