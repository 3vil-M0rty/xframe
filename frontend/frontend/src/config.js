// Application Configuration
// Edit these values to customize for clients

export const CONFIG = {
  // Maximum number of companies a user can create
  // Set to null for unlimited
  MAX_COMPANIES: 1,

  // API endpoint
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',

  // Feature flags
  FEATURES: {
    ALLOW_COMPANY_DELETION: true,
    ALLOW_COMPANY_EXPORT: false,
    ALLOW_MULTIPLE_CURRENCIES: true
  },

  // Moroccan defaults
  DEFAULT_CURRENCY: 'MAD',
  DEFAULT_LANGUAGE: 'fr',
  DEFAULT_LEGAL_FORM: 'SARL',

  // Theme
  THEME: {
    PRIMARY_COLOR: '#3b82f6',
    SECONDARY_COLOR: '#10b981'
  }
};

// Helper function to check if user can create more companies
export const canCreateMoreCompanies = (currentCount) => {
  if (CONFIG.MAX_COMPANIES === null) return true;
  return currentCount < CONFIG.MAX_COMPANIES;
};

// Get remaining companies user can create
export const getRemainingCompanies = (currentCount) => {
  if (CONFIG.MAX_COMPANIES === null) return 'Unlimited';
  return CONFIG.MAX_COMPANIES - currentCount;
};
