// i18n Configuration
export const translations = {
  en: {
    sidebar: {
      admin: 'Admin',
      settings: 'Settings',
      help: 'Help & Support',
      profile: 'Profile',
      preferences: 'Preferences',
      integrations: 'Integrations',
      companies: 'Companies',
      dark: 'Dark',
      light: 'Light',
      logout: 'Logout',
      closeSidebar: 'Close sidebar',
      openSidebar: 'Open sidebar',
      switchTheme: 'Switch to {theme} mode'
    },
    common: {
      welcome: 'Welcome',
      goodbye: 'Goodbye',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success'
    }
  },
  fr: {
    sidebar: {
      admin: 'Admin',
      settings: 'Paramètres',
      help: 'Aide & Support',
      profile: 'Profil',
      preferences: 'Préférences',
      integrations: 'Intégrations',
      companies: 'Entreprises',
      dark: 'Sombre',
      light: 'Clair',
      logout: 'Déconnexion',
      closeSidebar: 'Fermer la barre latérale',
      openSidebar: 'Ouvrir la barre latérale',
      switchTheme: 'Passer au mode {theme}'
    },
    common: {
      welcome: 'Bienvenue',
      goodbye: 'Au revoir',
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès'
    }
  },
  ar: {
    sidebar: {
      admin: 'المسؤول',
      settings: 'الإعدادات',
      help: 'المساعدة والدعم',
      profile: 'الملف الشخصي',
      preferences: 'التفضيلات',
      integrations: 'التكاملات',
      companies: 'الشركات',
      dark: 'مظلم',
      light: 'فاتح',
      logout: 'تسجيل الخروج',
      closeSidebar: 'إغلاق الشريط الجانبي',
      openSidebar: 'فتح الشريط الجانبي',
      switchTheme: 'التبديل إلى الوضع {theme}'
    },
    common: {
      welcome: 'أهلا بك',
      goodbye: 'وداعا',
      loading: 'جارٍ التحميل...',
      error: 'خطأ',
      success: 'نجح'
    }
  },
  es: {
    sidebar: {
      admin: 'Administración',
      settings: 'Configuración',
      help: 'Ayuda y soporte',
      profile: 'Perfil',
      preferences: 'Preferencias',
      integrations: 'Integraciones',
      companies: 'Empresas',
      dark: 'Oscuro',
      light: 'Claro',
      logout: 'Cerrar sesión',
      closeSidebar: 'Cerrar barra lateral',
      openSidebar: 'Abrir barra lateral',
      switchTheme: 'Cambiar a modo {theme}'
    },
    common: {
      welcome: 'Bienvenido',
      goodbye: 'Adiós',
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito'
    }
  },
  pt: {
    sidebar: {
      admin: 'Admin',
      settings: 'Configurações',
      help: 'Ajuda e Suporte',
      profile: 'Perfil',
      preferences: 'Preferências',
      integrations: 'Integrações',
      companies: 'Empresas',
      dark: 'Escuro',
      light: 'Claro',
      logout: 'Sair',
      closeSidebar: 'Fechar barra lateral',
      openSidebar: 'Abrir barra lateral',
      switchTheme: 'Mudar para modo {theme}'
    },
    common: {
      welcome: 'Bem-vindo',
      goodbye: 'Adeus',
      loading: 'Carregando...',
      error: 'Erro',
      success: 'Sucesso'
    }
  },
  de: {
    sidebar: {
      admin: 'Verwaltung',
      settings: 'Einstellungen',
      help: 'Hilfe und Support',
      profile: 'Profil',
      preferences: 'Voreinstellungen',
      integrations: 'Integrationen',
      companies: 'Unternehmen',
      dark: 'Dunkel',
      light: 'Hell',
      logout: 'Abmelden',
      closeSidebar: 'Seitenleiste schließen',
      openSidebar: 'Seitenleiste öffnen',
      switchTheme: 'Zu {theme} Modus wechseln'
    },
    common: {
      welcome: 'Willkommen',
      goodbye: 'Auf Wiedersehen',
      loading: 'Wird geladen...',
      error: 'Fehler',
      success: 'Erfolg'
    }
  }
};

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'es', 'pt', 'de'];

// Get user's preferred language from localStorage or browser
export const getDefaultLanguage = () => {
  // Check localStorage first
  const stored = localStorage.getItem('language');
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(browserLang)) {
    return browserLang;
  }

  // Default to English
  return 'en';
};