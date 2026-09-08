const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    // =========================================================
    // BASIC COMPANY INFORMATION
    // =========================================================

    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      minlength: [2, "Company name must contain at least 2 characters"],
      maxlength: [200, "Company name cannot exceed 200 characters"],
    },

    tradeName: {
      type: String,
      trim: true,
      maxlength: [200, "Trade name cannot exceed 200 characters"],
    },

    shortName: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [50, "Short name cannot exceed 50 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // =========================================================
    // LEGAL INFORMATION - MOROCCO
    // =========================================================

    legalForm: {
      type: String,
      enum: [
        "SARL",
        "SARL_AU",
        "SA",
        "SAS",
        "SASU",
        "SNC",
        "SCS",
        "SCA",
        "SP",
        "COOPERATIVE",
        "ASSOCIATION",
        "OTHER",
      ],
      required: [true, "Legal form is required"],
      default: "SARL",
    },

    legalFormOther: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // Identifiant Commun de l'Entreprise
    ice: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^\d{15}$/, "ICE must contain exactly 15 digits"],
    },

    // Identifiant Fiscal
    taxId: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Registre de Commerce
    registrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    registrationCity: {
      type: String,
      trim: true,
    },

    registrationDate: {
      type: Date,
    },

    // CNSS employer registration
    cnssNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Professional tax / taxe professionnelle
    professionalTaxNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Tax office
    taxOffice: {
      type: String,
      trim: true,
    },

    // =========================================================
    // BUSINESS INFORMATION
    // =========================================================

    industry: {
      type: String,
      required: [true, "Industry is required"],
      trim: true,
    },

    businessActivity: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    activityCode: {
      type: String,
      trim: true,
    },

    website: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // =========================================================
    // CONTACT INFORMATION
    // =========================================================

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid email address",
      ],
    },

    phone: {
      type: String,
      trim: true,
      match: [
        /^(?:\+212|0)(?:[5-7]\d{8})$/,
        "Invalid Moroccan phone number",
      ],
    },

    secondaryPhone: {
      type: String,
      trim: true,
      match: [
        /^(?:\+212|0)(?:[5-7]\d{8})$/,
        "Invalid Moroccan phone number",
      ],
    },

    fax: {
      type: String,
      trim: true,
    },

    // =========================================================
    // ADDRESS
    // =========================================================

    address: {
      street: {
        type: String,
        trim: true,
      },

      additionalLine: {
        type: String,
        trim: true,
      },

      neighborhood: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      region: {
        type: String,
        enum: [
          "Dakhla-Oued Ed-Dahab",
          "Laâyoune-Sakia El Hamra",
          "Souss-Massa",
          "Guelmim-Oued Noun",
          "Drâa-Tafilalet",
          "Oriental",
          "Fès-Meknès",
          "Rabat-Salé-Kénitra",
          "Béni Mellal-Khénifra",
          "Casablanca-Settat",
          "Marrakech-Safi",
          "Tanger-Tétouan-Al Hoceïma",
        ],
      },

      postalCode: {
        type: String,
        trim: true,
      },

      country: {
        type: String,
        trim: true,
        default: "Morocco",
      },

      countryCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: "MA",
      },
    },

    // =========================================================
    // GEOLOCATION
    // =========================================================

    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },

      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
    },

    // =========================================================
    // COMPANY LOGO - CLOUDINARY
    // =========================================================

    logo: {
      url: {
        type: String,
        trim: true,
      },

      publicId: {
        type: String,
        trim: true,
      },

      format: {
        type: String,
        trim: true,
      },

      width: {
        type: Number,
        min: 0,
      },

      height: {
        type: Number,
        min: 0,
      },

      uploadedAt: {
        type: Date,
      },
    },

    // =========================================================
    // COMPANY SIZE
    // =========================================================

    size: {
      type: String,
      enum: [
        "micro",
        "small",
        "medium",
        "large",
        "enterprise",
      ],
      default: "small",
    },

    // Do NOT use this as the source of truth for employees.
    // It can be maintained as a cached/statistical value later.
    employeeCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    // =========================================================
    // FISCAL / ACCOUNTING SETTINGS
    // =========================================================

    fiscalYear: {
      startMonth: {
        type: Number,
        min: 1,
        max: 12,
        default: 1,
      },

      startDay: {
        type: Number,
        min: 1,
        max: 31,
        default: 1,
      },
    },

    currency: {
      type: String,
      enum: ["MAD", "EUR", "USD"],
      default: "MAD",
    },

    // =========================================================
    // COMPANY BANKING INFORMATION
    // =========================================================

    bank: {
      bankName: {
        type: String,
        trim: true,
      },

      accountName: {
        type: String,
        trim: true,
      },

      rib: {
        type: String,
        trim: true,
      },

      iban: {
        type: String,
        trim: true,
      },

      swift: {
        type: String,
        trim: true,
        uppercase: true,
      },
    },

    // =========================================================
    // BRANDING
    // =========================================================

    branding: {
      primaryColor: {
        type: String,
        trim: true,
        default: "#3b82f6",
      },

      secondaryColor: {
        type: String,
        trim: true,
        default: "#10b981",
      },

      accentColor: {
        type: String,
        trim: true,
      },

      darkMode: {
        type: Boolean,
        default: true,
      },
    },

    // =========================================================
    // LANGUAGE / REGIONAL SETTINGS
    // =========================================================

    localization: {
      language: {
        type: String,
        enum: ["fr", "ar", "en"],
        default: "fr",
      },

      timezone: {
        type: String,
        default: "Africa/Casablanca",
      },

      dateFormat: {
        type: String,
        default: "DD/MM/YYYY",
      },

      timeFormat: {
        type: String,
        enum: ["12h", "24h"],
        default: "24h",
      },
    },

    // =========================================================
    // COMPANY OWNER
    // =========================================================

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Company owner is required"],
    },

    // =========================================================
    // COMPANY STATUS
    // =========================================================

    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "suspended",
        "inactive",
        "archived",
      ],
      default: "active",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // =========================================================
    // AUDIT
    // =========================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// =============================================================
// INDEXES
// =============================================================

companySchema.index({ owner: 1 });
companySchema.index({ name: 1 });
companySchema.index({ ice: 1 }, { unique: true, sparse: true });
companySchema.index({ taxId: 1 }, { unique: true, sparse: true });
companySchema.index(
  { registrationNumber: 1 },
  { unique: true, sparse: true }
);
companySchema.index({ cnssNumber: 1 }, { unique: true, sparse: true });
companySchema.index({ status: 1 });
companySchema.index({ "address.city": 1 });
companySchema.index({ industry: 1 });

// =============================================================
// EXPORT
// =============================================================

module.exports = mongoose.model("Company", companySchema);