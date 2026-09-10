const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
    {
        // =========================================================
        // COMPANY / LOGIN
        // =========================================================

        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: [true, "Company is required"],
            index: true,
        },

        // Optional login account
        // Not every employee needs access to FRAME.

        // =========================================================
        // EMPLOYEE IDENTIFICATION
        // =========================================================

        employeeNumber: {
            type: String,
            required: [true, "Employee number is required"],
            trim: true,
            uppercase: true,
        },

        firstName: {
            type: String,
            required: [true, "First name is required"],
            trim: true,
            maxlength: 100,
        },

        lastName: {
            type: String,
            required: [true, "Last name is required"],
            trim: true,
            maxlength: 100,
        },

        photo: {
            url: {
                type: String,
                default: null,
            },
            publicId: {
                type: String,
                default: null,
            },
        },

        firstNameArabic: {
            type: String,
            trim: true,
            maxlength: 100,
        },

        lastNameArabic: {
            type: String,
            trim: true,
            maxlength: 100,
        },

        // =========================================================
        // PERSONAL INFORMATION
        // =========================================================

        gender: {
            type: String,
            enum: ["male", "female", "other"],
        },

        dateOfBirth: {
            type: Date,
        },

        placeOfBirth: {
            type: String,
            trim: true,
        },

        nationality: {
            type: String,
            trim: true,
            default: "Moroccan",
        },

        maritalStatus: {
            type: String,
            enum: [
                "single",
                "married",
                "divorced",
                "widowed",
                "other",
            ],
            default: "single",
        },

        numberOfDependents: {
            type: Number,
            min: 0,
            default: 0,
        },

        // =========================================================
        // IDENTITY DOCUMENTS
        // =========================================================

        cin: {
            type: String,
            trim: true,
            uppercase: true,
        },

        passportNumber: {
            type: String,
            trim: true,
            uppercase: true,
        },

        passportExpiryDate: {
            type: Date,
        },

        // Useful for foreign employees
        workPermitNumber: {
            type: String,
            trim: true,
        },

        workPermitExpiryDate: {
            type: Date,
        },

        // =========================================================
        // CONTACT
        // =========================================================

        personalEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },

        workEmail: {
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
        // ADDRESS
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

            region: {
                type: String,
                trim: true,
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
        },

        // =========================================================
        // EMERGENCY CONTACT
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
        // EMPLOYMENT
        // =========================================================

        hireDate: {
            type: Date,
            required: [true, "Hire date is required"],
        },

        terminationDate: {
            type: Date,
        },

        employmentStatus: {
            type: String,
            enum: [
                "active",
                "inactive",
                "on_leave",
                "suspended",
                "terminated",
            ],
            default: "active",
            index: true,
        },

        employmentType: {
            type: String,
            enum: [
                "permanent",
                "fixed_term",
                "temporary",
                "intern",
                "apprentice",
                "freelance",
                "part_time",
                "other",
            ],
            default: "permanent",
        },

        // =========================================================
        // JOB INFORMATION
        // =========================================================

        jobTitle: {
            type: String,
            trim: true,
        },

        department: {
            type: String,
            trim: true,
        },

        service: {
            type: String,
            trim: true,
        },

        position: {
            type: String,
            trim: true,
        },

        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },

        // =========================================================
        // WORK LOCATION
        // =========================================================

        workLocation: {
            type: String,
            trim: true,
        },

        // =========================================================
        // CNSS / TAX INFORMATION
        // =========================================================

        cnssNumber: {
            type: String,
            trim: true,
            uppercase: true,
        },

        cnssRegistrationDate: {
            type: Date,
        },

        taxIdentificationNumber: {
            type: String,
            trim: true,
        },

        // Professional / tax information
        taxStatus: {
            type: String,
            enum: [
                "taxable",
                "non_taxable",
                "exempt",
            ],
            default: "taxable",
        },

        // =========================================================
        // FAMILY / TAX DEPENDENTS
        // =========================================================

        familyStatus: {
            numberOfChildren: {
                type: Number,
                min: 0,
                default: 0,
            },

            spouseWorking: {
                type: Boolean,
                default: false,
            },
        },

        // =========================================================
        // BANKING
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
        },

        // =========================================================
        // PAYMENT SETTINGS
        // =========================================================

        paymentMethod: {
            type: String,
            enum: [
                "bank_transfer",
                "cash",
                "check",
            ],
            default: "bank_transfer",
        },

        // =========================================================
        // WORK SCHEDULE
        // =========================================================

        workSchedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WorkSchedule",
            default: null,
        },

        // =========================================================
        // PROFILE
        // =========================================================

        photo: {
            url: {
                type: String,
                trim: true,
            },

            publicId: {
                type: String,
                trim: true,
            },
        },

        notes: {
            type: String,
            trim: true,
            maxlength: 5000,
        },

        // =========================================================
        // SYSTEM
        // =========================================================

        isActive: {
            type: Boolean,
            default: true,
        },

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

// Employee number must be unique INSIDE a company
employeeSchema.index(
    { company: 1, employeeNumber: 1 },
    { unique: true }
);

// These should not necessarily be globally unique
// because the same CIN/CNSS should only be unique within
// the company's employee records.
employeeSchema.index(
    { company: 1, cin: 1 },
    {
        unique: true,
        sparse: true,
    }
);

employeeSchema.index(
    { company: 1, cnssNumber: 1 },
    {
        unique: true,
        sparse: true,
    }
);

employeeSchema.index({ company: 1, employmentStatus: 1 });
employeeSchema.index({ company: 1, department: 1 });
employeeSchema.index({ company: 1, hireDate: 1 });
employeeSchema.index({ company: 1, lastName: 1 });

module.exports = mongoose.model("Employee", employeeSchema);