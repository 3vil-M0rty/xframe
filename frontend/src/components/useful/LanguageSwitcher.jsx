import { useState, useRef, useEffect, useContext } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { I18nContext } from '../../context/i18nContext';

const LANGUAGE_META = {
  en: { code: 'EN', name: 'English' },
  fr: { code: 'FR', name: 'Français' },
  ar: { code: 'AR', name: 'العربية' },
  es: { code: 'ES', name: 'Español' },
  pt: { code: 'PT', name: 'Português' },
  de: { code: 'DE', name: 'Deutsch' },
};

export default function LanguageSwitcher() {
  const { language, setLanguage, supportedLanguages } = useContext(I18nContext);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(supportedLanguages.indexOf(language));
  const rootRef = useRef(null);

  // Keep the keyboard-highlighted row in sync if the active language
  // changes from outside this component (e.g. another switcher on the page)
  useEffect(() => {
    setHighlight(supportedLanguages.indexOf(language));
  }, [language, supportedLanguages]);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const select = (lang) => {
    setLanguage(lang); // this is changeLanguage() from I18nProvider
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, supportedLanguages.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(supportedLanguages[highlight]);
    }
  };

  const meta = LANGUAGE_META[language];

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          background: open ? '#2f2f2f' : '#1c1c1c',
          border: '1px solid #333333',
          borderRadius: '6px',
          color: '#e6e6e6',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.2,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        }}
      >
        <Globe size={14} color="#999999" strokeWidth={1.75} />
        <span>{meta.name}</span>
        <ChevronDown
          size={14}
          color="#808080"
          strokeWidth={2}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            minWidth: '180px',
            margin: 0,
            padding: '4px',
            listStyle: 'none',
            background: '#1c1c1c',
            border: '1px solid #333333',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 50,
          }}
        >
          {supportedLanguages.map((lang, i) => {
            const isActive = lang === language;
            const isHighlighted = i === highlight;
            return (
              <li
                key={lang}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(lang)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '7px 8px',
                  borderRadius: '5px',
                  fontSize: '13px',
                  color: isActive ? '#ffffff' : '#cccccc',
                  background: isHighlighted ? '#2f2f2f' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      color: '#666666',
                      background: '#242424',
                      border: '1px solid #333333',
                      borderRadius: '4px',
                      padding: '2px 5px',
                      minWidth: '26px',
                      textAlign: 'center',
                    }}
                  >
                    {LANGUAGE_META[lang].code}
                  </span>
                  <span>{LANGUAGE_META[lang].name}</span>
                </span>
                {isActive && <Check size={14} color="#10b981" strokeWidth={2.5} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}