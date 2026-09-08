// i18n Configuration
export const translations = {
  en: {
    sidebar: {
      admin: 'Admin',
      settings: 'Settings',
      help: 'Help & Support',
      profile: 'Profile',
      companies: 'Companies',
      organization: "Organization",
      company: "Company",
      employees: "Employees",
      users: "Users",
      departments: "Departments",
      jobPositions: "Job Positions",
      rolesPermissions: "Roles & Permissions",
      locations: "Locations",
      documents: "Documents",
      preferences: "Preferences",
      integrations: "Integrations",
      dark: 'Dark',
      light: 'Light',
      logout: 'Logout',
      closeSidebar: 'Close sidebar',
      openSidebar: 'Open sidebar',
      switchTheme: 'Switch to {theme} mode',
      dashboard: 'Dashboard',
    },
    common: {
      welcome: 'Welcome',
      goodbye: 'Goodbye',
      loading: 'Loading...',
      error: 'Error',
      fail: 'Fail',
      success: 'Success',
      update: 'Update',
      cancel: 'Cancel',
      confirm: 'Confirm',
      close: 'Close',
      edit: 'Edit',
      reset: 'Reset',
      create: "Create",
    },
    profile: {
      settings: 'Settings',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      password: 'Password',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      updateSureMessage: 'Are you sure you want to update your profile?',
      updateFailMessage: "We couldn't update your profile. Please try again.",
      updateSuccessMessage: "Your profile has been updated successfully.",
      bothPasswords: "Both current password and new password are required.",
      info: 'Information',
    },
    company: {
      title: "Company",
      subtitle: "Manage your company information",
      emptySubtitle: "No company set up yet",
      emptyTitle: "No company yet",
      emptyMessage: "Set up your company profile to get started.",
      create: "Create company",
      editTitle: "Edit company",

      name: "Company name",
      tradeName: "Trade name",
      legalForm: "Legal form",
      industry: "Industry",
      ice: "ICE",
      taxId: "Tax ID",
      registrationNumber: "Registration number",
      email: "Email",
      phone: "Phone",
      website: "Website",
      street: "Street",
      city: "City",
      postalCode: "Postal code",
      logo: "Company logo",
      employeeCount: "Employees",

      section: {
        identity: "Identity",
        legal: "Legal information",
        contact: "Contact",
      },

      createTitle: "Create company",
      createSureMessage: "Are you sure you want to create this company?",
      updateSureMessage: "Are you sure you want to save these changes?",

      createSuccessTitle: "Company created",
      createSuccessMessage: "The company was created successfully.",
      updateSuccessMessage: "The company was updated successfully.",

      createFailTitle: "Creation failed",
      saveFailMessage: "Something went wrong while saving the company.",

      loadFailTitle: "Loading failed",
      loadFailMessage: "Could not load company information.",
    },

    users: {
      title: "Users",
      subtitle: "Manage user accounts and access.",

      addUser: "Add User",
      newUser: "New User",
      createSubtitle: "Create a new user account.",

      information: "User Information",

      role: "Role",
      status: "Status",
      userId: "User ID",

      roles: {
        admin: "Administrator",
        owner: 'Owner',
        user: "User",
      },

      statuses: {
        active: "Active",
        inactive: "Inactive",
        suspended: "Suspended",
      },

      emptyTitle: "No Users",
      emptyMessage: "There are currently no users in your organization.",

      backToUsers: "Users",

      createTitle: "Create User",
      createSureMessage: "Are you sure you want to create this user?",

      createSuccessTitle: "User Created",
      createSuccessMessage: "The user has been created successfully.",

      createFailTitle: "Creation Failed",
      createFailMessage: "We couldn't create the user.",

      loadFailTitle: "Loading Failed",
      loadFailMessage: "We couldn't load the users. Please try again.",
      deleteUser: "Delete user",
      deleteTitle: "Delete user",
      deleteSureMessage:
        "Are you sure you want to delete this user? This action cannot be undone.",
      deleteSuccessTitle: "User deleted",
      deleteSuccessMessage:
        "The user was deleted successfully.",
      deleteFailTitle: "Deletion failed",
      deleteFailMessage:
        "Something went wrong while deleting the user.",
    },


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
    },
    company: {
      title: "Entreprise",
      subtitle: "Gérez les informations de votre entreprise",
      emptySubtitle: "Aucune entreprise configurée",
      emptyTitle: "Aucune entreprise",
      emptyMessage: "Configurez le profil de votre entreprise pour commencer.",
      create: "Créer l'entreprise",
      editTitle: "Modifier l'entreprise",

      name: "Nom de l'entreprise",
      tradeName: "Nom commercial",
      legalForm: "Forme juridique",
      industry: "Secteur d'activité",
      ice: "ICE",
      taxId: "Identifiant fiscal",
      registrationNumber: "Registre de commerce",
      email: "E-mail",
      phone: "Téléphone",
      website: "Site web",
      street: "Rue",
      city: "Ville",
      postalCode: "Code postal",
      logo: "Logo de l'entreprise",
      employeeCount: "Employés",

      section: {
        identity: "Identité",
        legal: "Informations légales",
        contact: "Contact",
      },

      createTitle: "Créer l'entreprise",
      createSureMessage: "Voulez-vous vraiment créer cette entreprise ?",
      updateSureMessage: "Voulez-vous vraiment enregistrer ces modifications ?",

      createSuccessTitle: "Entreprise créée",
      createSuccessMessage: "L'entreprise a été créée avec succès.",
      updateSuccessMessage: "L'entreprise a été mise à jour avec succès.",

      createFailTitle: "Échec de la création",
      saveFailMessage: "Une erreur est survenue lors de l'enregistrement.",

      loadFailTitle: "Échec du chargement",
      loadFailMessage: "Impossible de charger les informations de l'entreprise.",
    },
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