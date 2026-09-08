const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
    {
        // =========================================================
        // 1. USER ACCOUNT
        // =========================================================
        // Optional.
        //
        // Not every employee needs an application account.
        //
        // If the employee has an account:
        // employee.user -> User
        //
        // If not:
        // employee.user = null
        // =========================================================

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        permissions: {
            allow: [
                {
                    type: String,
                    trim: true,
                },
            ],

            deny: [
                {
                    type: String,
                    trim: true,
                },
            ],
        },

        // =========================================================
        // 2. COMPANY
        // =========================================================
        // Important if your application is multi-company.
        // Every employee belongs to one company.
        // =========================================================

        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },

        // =========================================================
        // 3. INTERNAL EMPLOYEE IDENTIFICATION
        // =========================================================

        employeeNumber: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },

        // =========================================================
        // 4. PERSONAL INFORMATION
        // =========================================================

        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        firstNameArabic: {
            type: String,
            trim: true,
        },

        lastNameArabic: {
            type: String,
            trim: true,
        },

        gender: {
            type: String,
            enum: ["male", "female"],
        },

        dateOfBirth: {
            type: Date,
        },

        placeOfBirth: {
            type: String,
            trim: true,
        },

        countryOfBirth: {
            type: String,
            trim: true,
        },

        nationality: {
            type: String,
            required: true,
            trim: true,
        },

        nationalityType: {
            type: String,
            enum: ["moroccan", "foreign"],
            required: true,
        },

        maritalStatus: {
            type: String,
            enum: [
                "single",
                "married",
                "divorced",
                "widowed",
            ],
        },

        numberOfChildren: {
            type: Number,
            min: 0,
            default: 0,
        },

        // =========================================================
        // 5. IDENTITY DOCUMENTS
        // =========================================================

        // Moroccan CIN
        cin: {
            type: String,
            trim: true,
            uppercase: true,
        },

        cinIssueDate: {
            type: Date,
        },

        cinExpiryDate: {
            type: Date,
        },

        // Foreign employee passport
        passportNumber: {
            type: String,
            trim: true,
            uppercase: true,
        },

        passportIssueDate: {
            type: Date,
        },

        passportExpiryDate: {
            type: Date,
        },

        passportIssuingCountry: {
            type: String,
            trim: true,
        },

        // Foreign employee residence permit
        residencePermitNumber: {
            type: String,
            trim: true,
        },

        residencePermitIssueDate: {
            type: Date,
        },

        residencePermitExpiryDate: {
            type: Date,
        },

        // =========================================================
        // 6. CONTACT INFORMATION
        // =========================================================

        personalEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },

        phone: {
            type: String,
            trim: true,
        },

        secondaryPhone: {
            type: String,
            trim: true,
        },

        // =========================================================
        // 7. ADDRESS
        // =========================================================

        address: {
            street: {
                type: String,
                trim: true,
            },

            city: {
                type: String,
                trim: true,
            },

            postalCode: {
                type: String,
                trim: true,
            },

            region: {
                type: String,
                trim: true,
            },

            country: {
                type: String,
                trim: true,
                default: "Morocco",
            },
        },

        // =========================================================
        // 8. EMERGENCY CONTACT
        // =========================================================

        emergencyContact: {
            name: {
                type: String,
                trim: true,
            },

            relationship: {
                type: String,
                trim: true,
            },

            phone: {
                type: String,
                trim: true,
            },

            email: {
                type: String,
                trim: true,
                lowercase: true,
            },
        },

        // =========================================================
        // 9. EMPLOYMENT INFORMATION
        // =========================================================

        hireDate: {
            type: Date,
            required: true,
        },

        // Used when seniority starts from a date different
        // from the actual contract/hire date.
        seniorityDate: {
            type: Date,
        },

        terminationDate: {
            type: Date,
        },

        employmentStatus: {
            type: String,
            enum: [
                "active",
                "on_leave",
                "suspended",
                "terminated",
                "resigned",
                "retired",
            ],
            default: "active",
        },

        terminationReason: {
            type: String,
            trim: true,
        },

        // =========================================================
        // 10. ORGANIZATION
        // =========================================================
        //
        // Department
        //     ↓
        // Job Category
        //     ↓
        // Job Position
        //
        // Example:
        //
        // department: "production"
        // jobCategory: "aluminium"
        // jobPosition: "aluminium_fabricator"
        // =========================================================

        department: {
            type: String,
            enum: [
                "management",
                "administration",
                "human_resources",
                "finance",
                "commercial",
                "engineering",
                "production",
                "quality",
                "maintenance",
                "logistics",
                "warehouse",
                "installation",
                "construction",
                "it",
                "security",
                "other",
            ],
        },

        // This should remain flexible because different companies
        // can have different categories.
        //
        // Examples:
        // aluminium
        // vitrage
        // laquage
        // finance
        // accounting
        // sales
        // maintenance
        // etc.
        jobCategory: {
            type: String,
            trim: true,
        },

        // Actual position.
        //
        // This remains a String rather than an enum so the company
        // can create its own positions without modifying the backend.
        //
        // Examples:
        // Aluminium Fabricator
        // Accountant
        // Production Manager
        // CNC Operator
        // Welder
        // Driver
        // etc.
        jobPosition: {
            type: String,
            trim: true,
        },

        // =========================================================
        // 11. MANAGEMENT HIERARCHY
        // =========================================================

        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },

        // =========================================================
        // 12. WORK LOCATION
        // =========================================================

        workLocation: {
            type: String,
            trim: true,
        },

        // =========================================================
        // 13. CONTRACT
        // =========================================================

        contractType: {
            type: String,
            enum: [
                "cdi",
                "cdd",
                "interim",
                "apprenticeship",
                "internship",
                "part_time",
                "other",
            ],
            required: true,
        },

        contractNumber: {
            type: String,
            trim: true,
        },

        contractStartDate: {
            type: Date,
        },

        contractEndDate: {
            type: Date,
        },

        // =========================================================
        // 14. PROBATION PERIOD
        // =========================================================

        probationPeriodStart: {
            type: Date,
        },

        probationPeriodEnd: {
            type: Date,
        },

        // =========================================================
        // 15. WORKING TIME
        // =========================================================

        workingHoursPerWeek: {
            type: Number,
            min: 0,
        },

        workingDaysPerWeek: {
            type: Number,
            min: 0,
            max: 7,
        },

        // =========================================================
        // 16. CNSS
        // =========================================================

        cnss: {
            isRegistered: {
                type: Boolean,
                default: false,
            },

            number: {
                type: String,
                trim: true,
            },

            registrationDate: {
                type: Date,
            },

            status: {
                type: String,
                enum: [
                    "not_registered",
                    "pending",
                    "active",
                    "inactive",
                ],
                default: "not_registered",
            },
        },

        // =========================================================
        // 17. TAX / IR
        // =========================================================

        tax: {
            taxId: {
                type: String,
                trim: true,
            },

            taxResidence: {
                type: String,
                trim: true,
            },

            familyStatus: {
                type: String,
                enum: [
                    "single",
                    "married",
                    "divorced",
                    "widowed",
                ],
            },

            dependents: {
                type: Number,
                min: 0,
                default: 0,
            },
        },

        // =========================================================
        // 18. SALARY / PAYROLL
        // =========================================================

        salary: {
            baseSalary: {
                type: Number,
                min: 0,
            },

            salaryType: {
                type: String,
                enum: [
                    "monthly",
                    "daily",
                    "hourly",
                ],
                default: "monthly",
            },

            currency: {
                type: String,
                uppercase: true,
                default: "MAD",
            },

            paymentFrequency: {
                type: String,
                enum: [
                    "monthly",
                    "weekly",
                    "daily",
                ],
                default: "monthly",
            },
        },

        // =========================================================
        // 19. BANK INFORMATION
        // =========================================================

        bank: {
            bankName: {
                type: String,
                trim: true,
            },

            accountHolder: {
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
        },

        // =========================================================
        // 20. FOREIGN EMPLOYEE
        // =========================================================
        //
        // Used only when nationalityType === "foreign".
        // =========================================================

        foreignWorker: {
            workAuthorizationRequired: {
                type: Boolean,
                default: false,
            },

            workAuthorizationNumber: {
                type: String,
                trim: true,
            },

            workAuthorizationIssueDate: {
                type: Date,
            },

            workAuthorizationExpiryDate: {
                type: Date,
            },

            workContractVisaNumber: {
                type: String,
                trim: true,
            },

            workContractVisaDate: {
                type: Date,
            },

            homeCountry: {
                type: String,
                trim: true,
            },
        },

        // =========================================================
        // 21. EDUCATION / QUALIFICATIONS
        // =========================================================

        educationLevel: {
            type: String,
            trim: true,
        },

        diploma: {
            type: String,
            trim: true,
        },

        specialization: {
            type: String,
            trim: true,
        },

        yearsOfExperience: {
            type: Number,
            min: 0,
        },

        // =========================================================
        // 22. PROFESSIONAL CONTACT
        // =========================================================

        professionalEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },

        internalPhone: {
            type: String,
            trim: true,
        },

        // =========================================================
        // 23. LEAVE BALANCE
        // =========================================================

        leaveBalance: {
            annual: {
                type: Number,
                min: 0,
                default: 0,
            },

            sick: {
                type: Number,
                min: 0,
                default: 0,
            },

            other: {
                type: Number,
                min: 0,
                default: 0,
            },
        },

        // =========================================================
        // 24. EMPLOYEE DOCUMENTS
        // =========================================================

        documents: [
            {
                type: {
                    type: String,
                    enum: [
                        "cin",
                        "passport",
                        "residence_permit",
                        "work_authorization",
                        "employment_contract",
                        "diploma",
                        "certificate",
                        "medical_certificate",
                        "bank_document",
                        "other",
                    ],
                },

                name: {
                    type: String,
                    trim: true,
                },

                fileUrl: {
                    type: String,
                    trim: true,
                },

                issueDate: {
                    type: Date,
                },

                expiryDate: {
                    type: Date,
                },

                uploadedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],

        // =========================================================
        // 25. NOTES
        // =========================================================

        notes: {
            type: String,
            trim: true,
        },

        // =========================================================
        // 26. ACTIVE RECORD
        // =========================================================

        isActive: {
            type: Boolean,
            default: true,
        },
    },

    {
        timestamps: true,
    }
);

// =============================================================
// INDEXES
// =============================================================

// Employee number should be unique PER COMPANY
employeeSchema.index(
    { company: 1, employeeNumber: 1 },
    { unique: true }
);

// CIN can be searched quickly
employeeSchema.index({ cin: 1 });

// CNSS number
employeeSchema.index({ "cnss.number": 1 });

// User account
employeeSchema.index({ user: 1 });

// Company employees
employeeSchema.index({ company: 1 });

// Search employees by name
employeeSchema.index({
    lastName: 1,
    firstName: 1,
});

// Filter employees
employeeSchema.index({
    employmentStatus: 1,
});

employeeSchema.index({
    contractType: 1,
});

employeeSchema.index({
    department: 1,
});

employeeSchema.index({
    jobCategory: 1,
});

employeeSchema.index({
    jobPosition: 1,
});

// =============================================================
// EXPORT
// =============================================================

module.exports = mongoose.model("Employee", employeeSchema);