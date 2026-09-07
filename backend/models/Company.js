const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    // Legal Name
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      minlength: 2
    },

    // Moroccan Legal Form (Forme Juridique)
    legalForm: {
      type: String,
      enum: ['SARL', 'SA', 'EIRL', 'SARUE', 'SCS', 'SNC', 'Cooperative', 'Association'],
      required: true,
      default: 'SARL',
      description: 'SARL: Société à Responsabilité Limitée, SA: Société Anonyme, EIRL: Entreprise Individuelle, etc'
    },

    // Moroccan Registration Number (CNSS)
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
      description: 'Numéro de Registre de Commerce et d\'Industrie (RCCI)'
    },

    // Tax Identification (IF - Identifiant Fiscal)
    taxId: {
      type: String,
      unique: true,
      sparse: true,
      description: 'Identifiant Fiscal Morocco'
    },

    // Business Sector
    industry: {
      type: String,
      required: true
    },

    description: String,

    // Contact Information
    email: {
      type: String,
      lowercase: true,
      sparse: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
    },

    // Moroccan Phone Format
    phone: {
      type: String,
      sparse: true,
      match: [/^(\+212|0)[1-9]\d{8}$/, 'Invalid Moroccan phone number'],
      description: 'Format: +212XXXXXXXXX or 0XXXXXXXXX'
    },

    // Address in Morocco
    address: {
      street: String,
      city: String,
      region: {
        type: String,
        enum: [
          'Dakhla-Oued Ed-Dahab',
          'Laâyoune-Sakia El Hamra',
          'Souss-Massa',
          'Béni Mellal-Khénifra',
          'Casablanca-Settat',
          'Fès-Meknès',
          'Rabat-Salé-Kénitra',
          'Marrakech-Safi',
          'Drâa-Tafilalet',
          'Tanger-Tétouan-Al Hoceïma',
          'Oriental'
        ]
      },
      zipCode: String
    },

    website: String,

    // Company Logo
    logo: {
      url: String,
      publicId: String
    },

    // Size Classification
    size: {
      type: String,
      enum: ['Startup', 'Small', 'Medium', 'Large', 'Enterprise'],
      default: 'Small'
    },

    employeeCount: {
      type: Number,
      min: 1,
      default: 1
    },

    // Fiscal Year (Exercice Comptable)
    fiscalYear: {
      startMonth: {
        type: Number,
        min: 1,
        max: 12,
        default: 1
      },
      startDay: {
        type: Number,
        min: 1,
        max: 31,
        default: 1
      }
    },

    // Currency (Devises Acceptées)
    currency: {
      type: String,
      enum: ['MAD', 'USD', 'EUR'],
      default: 'MAD'
    },

    // Branding Settings
    settings: {
      theme: {
        primaryColor: { type: String, default: '#3b82f6' },
        secondaryColor: { type: String, default: '#10b981' }
      },
      language: {
        type: String,
        enum: ['fr', 'ar', 'en'],
        default: 'fr'
      }
    },

    // Ownership
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Update timestamp on save
companySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for performance
companySchema.index({ owner: 1 });
companySchema.index({ registrationNumber: 1 });
companySchema.index({ taxId: 1 });

module.exports = mongoose.model('Company', companySchema);
