// ======================================================
// i18n Configuration
// ======================================================

export const translations = {
  // ======================================================
  // ENGLISH
  // ======================================================

  en: {
    // ====================================================
    // SIDEBAR
    // ====================================================

    sidebar: {
      admin: "Admin",
      settings: "Settings",
      help: "Help & Support",
      profile: "Profile",
      hr : "Human Resources",
      companies: "Companies",
      organization: "Organization",
      company: "Company",
      employees: "Employees",
      salaries: "Salaries",
      absences: "Absences",
      advances: "Advances",
      users: "Users",
      departments: "Departments",
      jobPositions: "Job Positions",
      rolesPermissions: "Roles & Permissions",
      locations: "Locations",
      documents: "Documents",
      preferences: "Preferences",
      integrations: "Integrations",

      dark: "Dark",
      light: "Light",

      logout: "Logout",

      closeSidebar: "Close sidebar",
      openSidebar: "Open sidebar",

      switchTheme: "Switch to {theme} mode",

      dashboard: "Dashboard",
    },

    // ====================================================
    // COMMON
    // ====================================================

    common: {
      welcome: "Welcome",
      goodbye: "Goodbye",

      loading: "Loading...",

      error: "Error",
      fail: "Fail",
      success: "Success",

      update: "Update",
      cancel: "Cancel",
      delete: "Delete",
      confirm: "Confirm",
      close: "Close",
      edit: "Edit",
      reset: "Reset",
      create: "Create",
      noResults: "No results found",
    },

    // ====================================================
    // PROFILE
    // ====================================================

    profile: {
      settings: "Settings",

      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      password: "Password",

      currentPassword: "Current Password",
      newPassword: "New Password",

      updateSureMessage:
        "Are you sure you want to update your profile?",

      updateFailMessage:
        "We couldn't update your profile. Please try again.",

      updateSuccessMessage:
        "Your profile has been updated successfully.",

      bothPasswords:
        "Both current password and new password are required.",

      info: "Information",
    },

    // ====================================================
    // COMPANY
    // ====================================================

    company: {
      title: "Company",

      subtitle:
        "Manage your company information",

      emptySubtitle:
        "No company set up yet",

      emptyTitle:
        "No company yet",

      emptyMessage:
        "Set up your company profile to get started.",

      create:
        "Create company",

      editTitle:
        "Edit company",

      name:
        "Company name",

      tradeName:
        "Trade name",

      legalForm:
        "Legal form",

      industry:
        "Industry",

      ice:
        "ICE",

      taxId:
        "Tax ID",

      registrationNumber:
        "Registration number",

      email:
        "Email",

      phone:
        "Phone",

      website:
        "Website",

      street:
        "Street",

      city:
        "City",

      postalCode:
        "Postal code",

      logo:
        "Company logo",

      employeeCount:
        "Employees",

      // ==================================================
      // SECTIONS
      // ==================================================

      section: {
        identity:
          "Identity",

        legal:
          "Legal information",

        contact:
          "Contact",
      },

      // ==================================================
      // CREATE
      // ==================================================

      createTitle:
        "Create company",

      createSureMessage:
        "Are you sure you want to create this company?",

      createSuccessTitle:
        "Company created",

      createSuccessMessage:
        "The company was created successfully.",

      createFailTitle:
        "Creation failed",

      // ==================================================
      // UPDATE
      // ==================================================

      updateSureMessage:
        "Are you sure you want to save these changes?",

      updateSuccessMessage:
        "The company was updated successfully.",

      // ==================================================
      // GENERAL SAVE / LOAD ERRORS
      // ==================================================

      saveFailMessage:
        "Something went wrong while saving the company.",

      loadFailTitle:
        "Loading failed",

      loadFailMessage:
        "Could not load company information.",

      // ==================================================
      // DELETE
      // ==================================================

      deleteCompany:
        "Delete company",

      deleteTitle:
        "Delete company",

      deleteSureMessage:
        "Are you sure you want to delete this company? This action cannot be undone.",

      deleteSuccessTitle:
        "Company deleted",

      deleteSuccessMessage:
        "The company was deleted successfully.",

      deleteFailTitle:
        "Deletion failed",

      deleteFailMessage:
        "Something went wrong while deleting the company.",

      // ==================================================
      // BACKEND ERROR MESSAGES
      // ==================================================

      errors: {
        deleteAdminOnly:
          "Only administrators or the company owner can delete this company.",

        notFound:
          "Company not found.",

        deleteNotAuthorized:
          "You are not authorized to delete this company.",

        updateNotAuthorized:
          "You are not authorized to update this company.",

        viewNotAuthorized:
          "You are not authorized to view this company.",

        duplicateCompany:
          "A company with this ICE, tax ID, registration number, or CNSS number already exists.",

        createFailed:
          "Error creating company.",

        updateFailed:
          "Error updating company.",

        deleteFailed:
          "Error deleting company.",

        logoNotFound:
          "Company logo not found.",

        logoRequired:
          "Please select a logo.",

        logoUploadFailed:
          "Error uploading company logo.",

        logoDeleteFailed:
          "Error deleting company logo.",
      },
    },

    // ====================================================
    // USERS
    // ====================================================

    users: {
      editUser: "Edit User",
      editSubtitle: "Update this user's account information.",

      updateTitle: "Update User",
      updateSureMessage: "Are you sure you want to save these changes?",

      updateSuccessTitle: "User Updated",
      updateSuccessMessage: "The user has been updated successfully.",

      updateFailTitle: "Update Failed",
      updateFailMessage: "We couldn't update the user. Please try again.",
      department: "Department",
      departments: {
        management: "Management",
        hr: "Human Resources",
        finance: "Finance",
        accounting: "Accounting",
        sales: "Sales",
        purchasing: "Purchasing",
        marketing: "Marketing",
        production: "Production",
        production_planning: "Production Planning",
        quality_control: "Quality Control",
        maintenance: "Maintenance",
        warehouse: "Warehouse",
        logistics: "Logistics",
        procurement: "Procurement",
        engineering: "Engineering",
        design: "Design",
        research_development: "Research & Development",
        it: "IT",
        customer_service: "Customer Service",
        administration: "Administration",
        health_safety_environment: "Health, Safety & Environment",
        security: "Security",
      },
      title:
        "Users",

      subtitle:
        "Manage user accounts and access.",

      addUser:
        "Add User",

      newUser:
        "New User",

      createSubtitle:
        "Create a new user account.",

      information:
        "User Information",

      role:
        "Role",

      status:
        "Status",

      userId:
        "User ID",

      // ==================================================
      // ROLES
      // ==================================================

      roles: {
        admin:
          "Administrator",

        owner:
          "Owner",

        user:
          "User",
      },

      // ==================================================
      // STATUSES
      // ==================================================

      statuses: {
        active:
          "Active",

        inactive:
          "Inactive",

        suspended:
          "Suspended",
      },

      // ==================================================
      // EMPTY
      // ==================================================

      emptyTitle:
        "No Users",

      emptyMessage:
        "There are currently no users in your organization.",

      emptySearchTitle:
        "No matches",

      emptySearchMessage:
        "No users match your search.",

      backToUsers:
        "Users",

      // ==================================================
      // CREATE
      // ==================================================

      createTitle:
        "Create User",

      createSureMessage:
        "Are you sure you want to create this user?",

      createSuccessTitle:
        "User Created",

      createSuccessMessage:
        "The user has been created successfully.",

      createFailTitle:
        "Creation Failed",

      createFailMessage:
        "We couldn't create the user.",

      // ==================================================
      // LOAD
      // ==================================================

      loadFailTitle:
        "Loading Failed",

      loadFailMessage:
        "We couldn't load the users. Please try again.",

      // ==================================================
      // DELETE
      // ==================================================

      deleteUser:
        "Delete user",

      deleteTitle:
        "Delete user",

      deleteSureMessage:
        "Are you sure you want to delete this user? This action cannot be undone.",

      deleteSuccessTitle:
        "User deleted",

      deleteSuccessMessage:
        "The user was deleted successfully.",

      deleteFailTitle:
        "Deletion failed",

      deleteFailMessage:
        "Something went wrong while deleting the user.",

      // ==================================================
      // BACKEND ERRORS
      // ==================================================

      errors: {
        deleteAdminOnly:
          "Only administrators can delete users.",

        notFound:
          "User not found.",

        updateNotAuthorized:
          "You are not authorized to update this user.",

        passwordNotAuthorized:
          "You are not authorized to change this password.",

        requiredCreateFields:
          "Please provide first name, last name, email, and password.",

        requiredUpdateFields:
          "Please provide first name, last name, and email.",

        requiredPasswordFields:
          "Please provide current and new password.",

        emailExists:
          "A user with this email already exists.",

        currentPasswordIncorrect:
          "Current password is incorrect.",
      },
      toolbar: {
        searchPlaceholder: "Search users...",
      },
    },

    employees: {
      title: "Employees",
      subtitle: "Manage your company's employees and HR information.",
      addEmployee: "Add Employee",
      backToEmployees: "Back to Employees",
      editEmployee: "Edit Employee",
      newEmployee: "New Employee",
      employeeInformation: "Employee Information",
      loadFailTitle: "Couldn't load employees",
      loadFailMessage: "Something went wrong while loading employees. Please try again.",
      loadCompaniesFailMessage: "Something went wrong while loading companies. Please try again.",

      createTitle: "Add employee",
      createSureMessage: "Are you sure you want to create this employee?",
      createSuccessTitle: "Employee created",
      createSuccessMessage: "The employee has been created successfully.",
      createFailTitle: "Couldn't create employee",
      createFailMessage: "Something went wrong while creating the employee.",

      updateTitle: "Update employee",
      updateSureMessage: "Are you sure you want to save these changes?",
      updateSuccessTitle: "Employee updated",
      updateSuccessMessage: "The employee has been updated successfully.",
      updateFailTitle: "Couldn't update employee",
      updateFailMessage: "Something went wrong while updating the employee.",

      deleteTitle: "Delete employee",
      deleteSureMessage: "Are you sure you want to delete {name}? This cannot be undone.",
      deleteSuccessTitle: "Employee deleted",
      deleteSuccessMessage: "The employee has been deleted.",
      deleteFailTitle: "Couldn't delete employee",
      deleteFailMessage: "Something went wrong while deleting the employee.",

      selectCompanyRequired: "Please select a company.",
      invalidPhotoType: "Please select an image file.",

      toolbar: {
        company: "Company",
        selectCompany: "Select company",
        loadingCompanies: "Loading companies...",
        searchPlaceholder: "Search employees...",
      },

      companyInfo: {
        employeeCount_one: "{count} employee",
        employeeCount_other: "{count} employees",
      },

      emptyNoCompany: {
        title: "No companies found",
        message: "Create a company first before adding employees.",
      },

      emptyNoEmployees: {
        title: "No employees found",
        messageSearch: "No employees match your search.",
        messageDefault: "This company does not have any employees yet.",
        cta: "Add Employee",
      },

      loading: "Loading employees...",

      photo: {
        label: "Employee Photo",
        choose: "Choose photo",
        change: "Change photo",
        remove: "Remove",
      },

      company: {
        label: "Company",
        selectPlaceholder: "Select company",
        unnamed: "Unnamed company",
      },

      sections: {
        personalInformation: "Personal Information",
        contactInformation: "Contact Information",
        employment: "Employment",
        identification: "Identification",
        company: "Company",
        notes: "Notes",
      },

      fields: {
        employeeNumber: "Employee Number",
        employeeNumberPlaceholder: "EMP-001",

        firstName: "First Name",
        firstNamePlaceholder: "First name",

        lastName: "Last Name",
        lastNamePlaceholder: "Last name",

        firstNameArabic: "First Name (Arabic)",
        firstNameArabicPlaceholder: "الاسم الأول",

        lastNameArabic: "Last Name (Arabic)",
        lastNameArabicPlaceholder: "اسم العائلة",

        gender: "Gender",
        genderPlaceholder: "Select gender",

        dateOfBirth: "Date of Birth",

        placeOfBirth: "Place of Birth",
        placeOfBirthPlaceholder: "City",

        nationality: "Nationality",
        nationalityPlaceholder: "Moroccan",

        maritalStatus: "Marital Status",
        maritalStatusPlaceholder: "Select status",

        numberOfDependents: "Dependents",

        cin: "CIN",
        cinPlaceholder: "AB123456",

        passportNumber: "Passport Number",
        passportNumberPlaceholder: "Passport number",

        passportExpiryDate: "Passport Expiry",

        workPermitNumber: "Work Permit Number",
        workPermitNumberPlaceholder: "Permit number",

        workPermitExpiryDate: "Work Permit Expiry",

        personalEmail: "Personal Email",
        personalEmailPlaceholder: "personal@email.com",

        workEmail: "Work Email",
        workEmailPlaceholder: "employee@company.com",

        phone: "Phone",
        phonePlaceholder: "+212...",

        secondaryPhone: "Secondary Phone",
        secondaryPhonePlaceholder: "+212...",

        street: "Street",
        streetPlaceholder: "Street address",

        city: "City",
        cityPlaceholder: "City",

        region: "Region",
        regionPlaceholder: "Region",

        postalCode: "Postal Code",
        postalCodePlaceholder: "40000",

        country: "Country",
        countryPlaceholder: "Morocco",

        emergencyName: "Emergency Contact",
        emergencyNamePlaceholder: "Full name",

        emergencyRelationship: "Relationship",
        emergencyRelationshipPlaceholder: "Spouse, parent...",

        emergencyPhone: "Emergency Phone",
        emergencyPhonePlaceholder: "+212...",

        emergencyEmail: "Emergency Email",
        emergencyEmailPlaceholder: "email@example.com",

        hireDate: "Hire Date",
        terminationDate: "Termination Date",

        employmentStatus: "Employment Status",
        employmentStatusPlaceholder: "Select status",

        employmentType: "Employment Type",
        employmentTypePlaceholder: "Select type",

        jobTitle: "Job Title",
        jobTitlePlaceholder: "Production Manager",

        department: "Department",
        departmentPlaceholder: "Production",

        service: "Service",
        servicePlaceholder: "Assembly",

        position: "Position",
        positionPlaceholder: "Operator",

        workLocation: "Work Location",
        workLocationPlaceholder: "Factory",

        cnssNumber: "CNSS Number",
        cnssNumberPlaceholder: "CNSS number",

        cnssRegistrationDate: "CNSS Registration Date",

        taxIdentificationNumber: "Tax Identification Number",
        taxIdentificationNumberPlaceholder: "Tax ID",

        taxStatus: "Tax Status",
        taxStatusPlaceholder: "Tax status",

        numberOfChildren: "Number of Children",

        spouseWorking: "Spouse Working",
        spouseWorkingCheckboxLabel: "Spouse is currently working",

        bankName: "Bank Name",
        bankNamePlaceholder: "Bank",

        accountName: "Account Name",
        accountNamePlaceholder: "Account holder",

        rib: "RIB",
        ribPlaceholder: "RIB",

        iban: "IBAN",
        ibanPlaceholder: "IBAN",

        paymentMethod: "Payment Method",
        paymentMethodPlaceholder: "Select method",

        notes: "Notes",
        notesPlaceholder: "Additional notes...",

        isActive: "Active",
        isActiveCheckboxLabel: "Employee is active",
      },

      genders: {
        male: "Male",
        female: "Female",
        other: "Other",
      },

      maritalStatuses: {
        single: "Single",
        married: "Married",
        divorced: "Divorced",
        widowed: "Widowed",
        other: "Other",

      },

      taxStatus: {
        taxable: "Taxable",
        nonTaxable: "Non-Taxable",
        exempt: "Exempt",
      },

      statuses: {
        active: "Active",
        inactive: "Inactive",
        on_leave: "On Leave",
        suspended: "Suspended",
        terminated: "Terminated",
        unknown: "Unknown",
      },

      employmentTypes: {
        permanent: "Permanent",
        fixed_term: "Fixed Term",
        temporary: "Temporary",
        intern: "Intern",
        apprentice: "Apprentice",
        freelance: "Freelance",
        part_time: "Part Time",
        other: "Other",
      },

      paymentMethods: {
        bank_transfer: "Bank Transfer",
        cash: "Cash",
        check: "Check",
      },

      card: {
        view: "View",
        edit: "Edit",
      },

      detail: {
        employeeLabel: "Employee",
        firstName: "First Name",
        lastName: "Last Name",
        gender: "Gender",
        dateOfBirth: "Date of Birth",
        nationality: "Nationality",
        maritalStatus: "Marital Status",
        phone: "Phone",
        email: "Email",
        address: "Address",
        jobTitle: "Job Title",
        department: "Department",
        employmentType: "Employment Type",
        hireDate: "Hire Date",
        workLocation: "Work Location",
        service: "Service",
        cin: "CIN",
        passport: "Passport",
        cnssNumber: "CNSS Number",
        taxId: "Tax ID",
        empty: "—",
      },

      buttons: {
        save: "Saving...",
        createEmployee: "Create Employee",
        updateEmployee: "Update Employee",
        cancel: "Cancel",
      },

      breadcrumbs: {
        hr: "HR",
        employees: "Employees",
        addEmployee: "Add Employee",
        editEmployee: "Edit Employee",
      },

      errors: {
        companyRequired: "Please select a company.",
        invalidPhoto: "Please select an image file.",
        fetchCompaniesFailed: "Failed to fetch companies",
        fetchEmployeesFailed: "Failed to fetch employees",
        createFailed: "Failed to create employee",
        updateFailed: "Failed to update employee",
        deleteFailed: "Failed to delete employee",
        notFound: "Employee not found",
        duplicateEmployeeNumber: "An employee with this number already exists",
        requiredFields: "Please fill in all required fields",
      },
    },
    salaries: {
      title: "Salaries",
      subtitle: "Manage employee compensation and salary history.",
      addSalary: "Add salary",
      giveRaise: "Give a raise",

      createTitle: "New salary record",
      createSureMessage: "Are you sure you want to save this salary record? Any current salary for this employee will be closed as of this effective date.",
      createSuccessTitle: "Salary record created",
      createSuccessMessage: "The salary record was created successfully.",

      deleteTitle: "Delete salary record",
      deleteSureMessage: "Are you sure you want to delete this salary record? This cannot be undone.",

      emptyTitle: "No salaries yet",
      emptyMessage: "This company has no salary records yet.",

      fields: {
        employee: "Employee",
        employeeSearchPlaceholder: "Search by name, number, CIN, CNSS...",
        baseSalary: "Base salary",
        effectiveDate: "Effective date",
        notes: "Notes",
        notesPlaceholder: "Reason for this change, additional context...",
      },

      table: {
        base: "Base",
        gross: "Gross",
        net: "Net",
        endDate: "End date",
        status: "Status",
        ongoing: "Ongoing",
      },

      actions: {
        history: "View history",
      },

      history: {
        titleFor: "Salary history — {name}",
        empty: "No salary history for this employee.",
        current: "Current",
        past: "Past",
      },

      breadcrumbs: {
        hr: "HR",
        salaries: "Salaries",
      },

      buttons: {
        create: "Save salary",
      },

      errors: {
        fetchFailed: "Failed to load salaries",
        actionFailed: "Something went wrong. Please try again.",
      },
    },
    absences: {
      title: "Absences",
      subtitle: "Review and manage leave and absence requests.",
      addAbsence: "New absence request",

      createTitle: "New absence request",
      createSureMessage: "Are you sure you want to submit this absence request?",
      createSuccessTitle: "Request submitted",
      createSuccessMessage: "The absence request was submitted successfully.",

      acceptTitle: "Accept absence",
      acceptSureMessage: "Are you sure you want to accept this absence request?",

      rejectTitle: "Reject absence",
      rejectSureMessage: "Are you sure you want to reject this absence request?",

      deleteTitle: "Delete absence",
      deleteSureMessage: "Are you sure you want to delete this absence record? This cannot be undone.",

      emptyTitle: "No absences",
      emptyMessage: "No absence requests match your filters.",

      unjustified: "Unjustified",

      fields: {
        employee: "Employee",
        employeeSearchPlaceholder: "Search by name, number, CIN, CNSS...",
        type: "Type",
        startDate: "Start date",
        endDate: "End date",
        halfDay: "Half day",
        justified: "Justified",
        reason: "Reason",
        reasonPlaceholder: "Reason or additional context...",
        status: "Status",
      },

      types: {
        paid_leave: "Paid leave",
        unpaid_leave: "Unpaid leave",
        sick_leave: "Sick leave",
        absence: "Absence",
        other: "Other",
      },

      status: {
        pending: "Pending",
        accepted: "Accepted",
        rejected: "Rejected",
      },

      filters: {
        allStatuses: "All statuses",
        allTypes: "All types",
      },

      table: {
        period: "Period",
        days: "Days",
      },

      actions: {
        accept: "Accept",
        reject: "Reject",
      },

      breadcrumbs: {
        hr: "HR",
        absences: "Absences",
      },

      buttons: {
        create: "Submit request",
      },

      errors: {
        fetchFailed: "Failed to load absences",
        actionFailed: "Something went wrong. Please try again.",
      },
    },
    advances: {
      title: "Advances",
      subtitle: "Review and manage salary advance requests.",
      addAdvance: "New advance request",

      createTitle: "New advance request",
      createSureMessage: "Are you sure you want to submit this advance request?",
      createSuccessTitle: "Request submitted",
      createSuccessMessage: "The advance request was submitted successfully.",

      acceptTitle: "Accept advance",
      acceptSureMessage: "Are you sure you want to accept this advance request?",

      rejectTitle: "Reject advance",
      rejectSureMessage: "Are you sure you want to reject this advance request?",

      markRepaidTitle: "Mark as repaid",
      markRepaidSureMessage: "Are you sure you want to mark this advance as fully repaid?",

      deleteTitle: "Delete advance",
      deleteSureMessage: "Are you sure you want to delete this advance record? This cannot be undone.",

      emptyTitle: "No advances",
      emptyMessage: "No advance requests match your filters.",

      fields: {
        employee: "Employee",
        employeeSearchPlaceholder: "Search by name, number, CIN, CNSS...",
        amount: "Amount",
        requestDate: "Request date",
        reason: "Reason",
        reasonPlaceholder: "Reason or additional context...",
        status: "Status",
      },

      status: {
        pending: "Pending",
        accepted: "Accepted",
        rejected: "Rejected",
      },

      filters: {
        allStatuses: "All statuses",
      },

      table: {
        remaining: "Remaining",
        fullyRepaid: "Fully repaid",
      },

      actions: {
        accept: "Accept",
        reject: "Reject",
        markRepaid: "Mark as repaid",
      },

      breadcrumbs: {
        hr: "HR",
        advances: "Advances",
      },

      buttons: {
        create: "Submit request",
      },

      errors: {
        fetchFailed: "Failed to load advances",
        actionFailed: "Something went wrong. Please try again.",
      },
    },
  },

  // ======================================================
  // FRENCH
  // ======================================================

  fr: {
    sidebar: {
      admin: "Admin",
      settings: "Paramètres",
      help: "Aide & Support",
      profile: "Profil",
      hr: "Ressources humaines",

      companies: "Entreprises",
      organization: "Organisation",
      company: "Entreprise",
      employees: "Employés",
      salaries: "Salaires",
      absences: "Absences",
      advances: "Avances",
      users: "Utilisateurs",
      departments: "Départements",
      jobPositions: "Postes",
      rolesPermissions: "Rôles & Permissions",
      locations: "Emplacements",
      documents: "Documents",
      preferences: "Préférences",
      integrations: "Intégrations",

      dark: "Sombre",
      light: "Clair",

      logout: "Déconnexion",

      closeSidebar:
        "Fermer la barre latérale",

      openSidebar:
        "Ouvrir la barre latérale",

      switchTheme:
        "Passer au mode {theme}",

      dashboard:
        "Tableau de bord",
    },

    common: {
      welcome: "Bienvenue",
      goodbye: "Au revoir",

      loading: "Chargement...",

      error: "Erreur",
      fail: "Échec",
      success: "Succès",

      update: "Modifier",
      cancel: "Annuler",
      delete: "Supprimer",
      confirm: "Confirmer",
      close: "Fermer",
      edit: "Modifier",
      reset: "Réinitialiser",
      create: "Créer",
      noResults: "Aucun résultat trouvé",
    },

    profile: {
      settings: "Paramètres",

      firstName: "Prénom",
      lastName: "Nom",
      email: "E-mail",
      password: "Mot de passe",

      currentPassword:
        "Mot de passe actuel",

      newPassword:
        "Nouveau mot de passe",

      updateSureMessage:
        "Voulez-vous vraiment modifier votre profil ?",

      updateFailMessage:
        "Impossible de modifier votre profil. Veuillez réessayer.",

      updateSuccessMessage:
        "Votre profil a été modifié avec succès.",

      bothPasswords:
        "Le mot de passe actuel et le nouveau mot de passe sont requis.",

      info:
        "Informations",
    },

    company: {
      title:
        "Entreprise",

      subtitle:
        "Gérez les informations de votre entreprise",

      emptySubtitle:
        "Aucune entreprise configurée",

      emptyTitle:
        "Aucune entreprise",

      emptyMessage:
        "Configurez le profil de votre entreprise pour commencer.",

      create:
        "Créer l'entreprise",

      editTitle:
        "Modifier l'entreprise",

      name:
        "Nom de l'entreprise",

      tradeName:
        "Nom commercial",

      legalForm:
        "Forme juridique",

      industry:
        "Secteur d'activité",

      ice:
        "ICE",

      taxId:
        "Identifiant fiscal",

      registrationNumber:
        "Registre de commerce",

      email:
        "E-mail",

      phone:
        "Téléphone",

      website:
        "Site web",

      street:
        "Rue",

      city:
        "Ville",

      postalCode:
        "Code postal",

      logo:
        "Logo de l'entreprise",

      employeeCount:
        "Employés",

      section: {
        identity:
          "Identité",

        legal:
          "Informations légales",

        contact:
          "Contact",
      },

      createTitle:
        "Créer l'entreprise",

      createSureMessage:
        "Voulez-vous vraiment créer cette entreprise ?",

      createSuccessTitle:
        "Entreprise créée",

      createSuccessMessage:
        "L'entreprise a été créée avec succès.",

      createFailTitle:
        "Échec de la création",

      updateSureMessage:
        "Voulez-vous vraiment enregistrer ces modifications ?",

      updateSuccessMessage:
        "L'entreprise a été mise à jour avec succès.",

      saveFailMessage:
        "Une erreur est survenue lors de l'enregistrement de l'entreprise.",

      loadFailTitle:
        "Échec du chargement",

      loadFailMessage:
        "Impossible de charger les informations de l'entreprise.",

      deleteCompany:
        "Supprimer l'entreprise",

      deleteTitle:
        "Supprimer l'entreprise",

      deleteSureMessage:
        "Voulez-vous vraiment supprimer cette entreprise ? Cette action est irréversible.",

      deleteSuccessTitle:
        "Entreprise supprimée",

      deleteSuccessMessage:
        "L'entreprise a été supprimée avec succès.",

      deleteFailTitle:
        "Échec de la suppression",

      deleteFailMessage:
        "Une erreur est survenue lors de la suppression de l'entreprise.",

      errors: {
        deleteAdminOnly:
          "Seuls les administrateurs ou le propriétaire de l'entreprise peuvent supprimer cette entreprise.",

        notFound:
          "Entreprise introuvable.",

        deleteNotAuthorized:
          "Vous n'êtes pas autorisé à supprimer cette entreprise.",

        updateNotAuthorized:
          "Vous n'êtes pas autorisé à modifier cette entreprise.",

        viewNotAuthorized:
          "Vous n'êtes pas autorisé à consulter cette entreprise.",

        duplicateCompany:
          "Une entreprise avec cet ICE, identifiant fiscal, numéro d'immatriculation ou numéro CNSS existe déjà.",

        createFailed:
          "Erreur lors de la création de l'entreprise.",

        updateFailed:
          "Erreur lors de la modification de l'entreprise.",

        deleteFailed:
          "Erreur lors de la suppression de l'entreprise.",

        logoNotFound:
          "Logo de l'entreprise introuvable.",

        logoRequired:
          "Veuillez sélectionner un logo.",

        logoUploadFailed:
          "Erreur lors du téléchargement du logo.",

        logoDeleteFailed:
          "Erreur lors de la suppression du logo.",
      },
    },

    users: {
      title:
        "Utilisateurs",

      subtitle:
        "Gérez les comptes utilisateurs et leurs accès.",

      addUser:
        "Ajouter un utilisateur",

      newUser:
        "Nouvel utilisateur",

      createSubtitle:
        "Créer un nouveau compte utilisateur.",

      information:
        "Informations utilisateur",

      role:
        "Rôle",

      status:
        "Statut",

      userId:
        "ID utilisateur",

      roles: {
        admin:
          "Administrateur",

        owner:
          "Propriétaire",

        user:
          "Utilisateur",
      },

      statuses: {
        active:
          "Actif",

        inactive:
          "Inactif",

        suspended:
          "Suspendu",
      },

      emptyTitle:
        "Aucun utilisateur",

      emptyMessage:
        "Il n'y a actuellement aucun utilisateur dans votre organisation.",

      backToUsers:
        "Utilisateurs",

      createTitle:
        "Créer un utilisateur",

      createSureMessage:
        "Voulez-vous vraiment créer cet utilisateur ?",

      createSuccessTitle:
        "Utilisateur créé",

      createSuccessMessage:
        "L'utilisateur a été créé avec succès.",

      createFailTitle:
        "Échec de la création",

      createFailMessage:
        "Impossible de créer l'utilisateur.",

      loadFailTitle:
        "Échec du chargement",

      loadFailMessage:
        "Impossible de charger les utilisateurs. Veuillez réessayer.",

      deleteUser:
        "Supprimer l'utilisateur",

      deleteTitle:
        "Supprimer l'utilisateur",

      deleteSureMessage:
        "Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.",

      deleteSuccessTitle:
        "Utilisateur supprimé",

      deleteSuccessMessage:
        "L'utilisateur a été supprimé avec succès.",

      deleteFailTitle:
        "Échec de la suppression",

      deleteFailMessage:
        "Une erreur est survenue lors de la suppression de l'utilisateur.",

      errors: {
        deleteAdminOnly:
          "Seuls les administrateurs peuvent supprimer des utilisateurs.",

        notFound:
          "Utilisateur introuvable.",

        updateNotAuthorized:
          "Vous n'êtes pas autorisé à modifier cet utilisateur.",

        passwordNotAuthorized:
          "Vous n'êtes pas autorisé à modifier ce mot de passe.",

        requiredCreateFields:
          "Veuillez fournir le prénom, le nom, l'e-mail et le mot de passe.",

        requiredUpdateFields:
          "Veuillez fournir le prénom, le nom et l'e-mail.",

        requiredPasswordFields:
          "Veuillez fournir le mot de passe actuel et le nouveau mot de passe.",

        emailExists:
          "Un utilisateur avec cet e-mail existe déjà.",

        currentPasswordIncorrect:
          "Le mot de passe actuel est incorrect.",
      },

      editUser: "Modifier l'utilisateur",
      editSubtitle: "Mettez à jour les informations du compte de cet utilisateur.",

      updateTitle: "Modifier l'utilisateur",
      updateSureMessage: "Voulez-vous vraiment enregistrer ces modifications ?",

      updateSuccessTitle: "Utilisateur mis à jour",
      updateSuccessMessage: "L'utilisateur a été mis à jour avec succès.",

      updateFailTitle: "Échec de la mise à jour",
      updateFailMessage: "Impossible de mettre à jour l'utilisateur. Veuillez réessayer.",

      department: "Département",
      departments: {
          management: "Direction",
          hr: "Ressources humaines",
          finance: "Finance",
          accounting: "Comptabilité",
          sales: "Ventes",
          purchasing: "Achats",
          marketing: "Marketing",
          production: "Production",
          production_planning: "Planification de la production",
          quality_control: "Contrôle qualité",
          maintenance: "Maintenance",
          warehouse: "Entrepôt",
          logistics: "Logistique",
          procurement: "Approvisionnement",
          engineering: "Ingénierie",
          design: "Conception",
          research_development: "Recherche & Développement",
          it: "Informatique",
          customer_service: "Service client",
          administration: "Administration",
          health_safety_environment: "Hygiène, sécurité & environnement",
          security: "Sécurité",
      },

      emptySearchTitle: "Aucun résultat",
      emptySearchMessage: "Aucun utilisateur ne correspond à votre recherche.",

      toolbar: {
        searchPlaceholder: "Rechercher des utilisateurs...",
      },
    },
    employees: {
      title: "Employés",
      subtitle: "Gérez les employés de votre entreprise et leurs informations RH.",
      addEmployee: "Ajouter un employé",
      backToEmployees: "Retour aux employés",
      editEmployee: "Modifier l'employé",
      newEmployee: "Nouvel employé",
      employeeInformation: "Informations de l'employé",
      loadFailTitle: "Impossible de charger les employés",
      loadFailMessage: "Une erreur est survenue lors du chargement des employés. Veuillez réessayer.",
      loadCompaniesFailMessage: "Une erreur est survenue lors du chargement des entreprises. Veuillez réessayer.",

      createTitle: "Ajouter un employé",
      createSureMessage: "Voulez-vous vraiment créer cet employé ?",
      createSuccessTitle: "Employé créé",
      createSuccessMessage: "L'employé a été créé avec succès.",
      createFailTitle: "Impossible de créer l'employé",
      createFailMessage: "Une erreur est survenue lors de la création de l'employé.",

      updateTitle: "Modifier l'employé",
      updateSureMessage: "Voulez-vous vraiment enregistrer ces modifications ?",
      updateSuccessTitle: "Employé mis à jour",
      updateSuccessMessage: "L'employé a été mis à jour avec succès.",
      updateFailTitle: "Impossible de mettre à jour l'employé",
      updateFailMessage: "Une erreur est survenue lors de la mise à jour de l'employé.",

      deleteTitle: "Supprimer l'employé",
      deleteSureMessage: "Voulez-vous vraiment supprimer {name} ? Cette action est irréversible.",
      deleteSuccessTitle: "Employé supprimé",
      deleteSuccessMessage: "L'employé a été supprimé.",
      deleteFailTitle: "Impossible de supprimer l'employé",
      deleteFailMessage: "Une erreur est survenue lors de la suppression de l'employé.",

      selectCompanyRequired: "Veuillez sélectionner une entreprise.",
      invalidPhotoType: "Veuillez sélectionner un fichier image.",

      toolbar: {
        company: "Entreprise",
        selectCompany: "Sélectionner une entreprise",
        loadingCompanies: "Chargement des entreprises...",
        searchPlaceholder: "Rechercher des employés...",
      },

      companyInfo: {
        employeeCount_one: "{count} employé",
        employeeCount_other: "{count} employés",
      },

      emptyNoCompany: {
        title: "Aucune entreprise trouvée",
        message: "Créez d'abord une entreprise avant d'ajouter des employés.",
      },

      emptyNoEmployees: {
        title: "Aucun employé trouvé",
        messageSearch: "Aucun employé ne correspond à votre recherche.",
        messageDefault: "Cette entreprise n'a pas encore d'employés.",
        cta: "Ajouter un employé",
      },

      loading: "Chargement des employés...",

      photo: {
        label: "Photo de l'employé",
        choose: "Choisir une photo",
        change: "Changer la photo",
        remove: "Supprimer",
      },

      company: {
        label: "Entreprise",
        selectPlaceholder: "Sélectionner une entreprise",
        unnamed: "Entreprise sans nom",
      },

      sections: {
        personalInformation: "Informations personnelles",
        contactInformation: "Coordonnées",
        employment: "Emploi",
        identification: "Identification",
        company: "Entreprise",
        notes: "Notes",
      },

      fields: {
        employeeNumber: "Matricule",
        employeeNumberPlaceholder: "EMP-001",

        firstName: "Prénom",
        firstNamePlaceholder: "Prénom",

        lastName: "Nom",
        lastNamePlaceholder: "Nom",

        firstNameArabic: "Prénom (arabe)",
        firstNameArabicPlaceholder: "الاسم الأول",

        lastNameArabic: "Nom (arabe)",
        lastNameArabicPlaceholder: "اسم العائلة",

        gender: "Genre",
        genderPlaceholder: "Sélectionner le genre",

        dateOfBirth: "Date de naissance",

        placeOfBirth: "Lieu de naissance",
        placeOfBirthPlaceholder: "Ville",

        nationality: "Nationalité",
        nationalityPlaceholder: "Marocaine",

        maritalStatus: "Situation familiale",
        maritalStatusPlaceholder: "Sélectionner un statut",

        numberOfDependents: "Personnes à charge",

        cin: "CIN",
        cinPlaceholder: "AB123456",

        passportNumber: "Numéro de passeport",
        passportNumberPlaceholder: "Numéro de passeport",

        passportExpiryDate: "Expiration du passeport",

        workPermitNumber: "Numéro de permis de travail",
        workPermitNumberPlaceholder: "Numéro de permis",

        workPermitExpiryDate: "Expiration du permis de travail",

        personalEmail: "E-mail personnel",
        personalEmailPlaceholder: "personnel@email.com",

        workEmail: "E-mail professionnel",
        workEmailPlaceholder: "employe@entreprise.com",

        phone: "Téléphone",
        phonePlaceholder: "+212...",

        secondaryPhone: "Téléphone secondaire",
        secondaryPhonePlaceholder: "+212...",

        street: "Rue",
        streetPlaceholder: "Adresse",

        city: "Ville",
        cityPlaceholder: "Ville",

        region: "Région",
        regionPlaceholder: "Région",

        postalCode: "Code postal",
        postalCodePlaceholder: "40000",

        country: "Pays",
        countryPlaceholder: "Maroc",

        emergencyName: "Contact d'urgence",
        emergencyNamePlaceholder: "Nom complet",

        emergencyRelationship: "Lien de parenté",
        emergencyRelationshipPlaceholder: "Conjoint, parent...",

        emergencyPhone: "Téléphone d'urgence",
        emergencyPhonePlaceholder: "+212...",

        emergencyEmail: "E-mail d'urgence",
        emergencyEmailPlaceholder: "email@exemple.com",

        hireDate: "Date d'embauche",
        terminationDate: "Date de fin de contrat",

        employmentStatus: "Statut d'emploi",
        employmentStatusPlaceholder: "Sélectionner un statut",

        employmentType: "Type de contrat",
        employmentTypePlaceholder: "Sélectionner un type",

        jobTitle: "Intitulé du poste",
        jobTitlePlaceholder: "Responsable de production",

        department: "Département",
        departmentPlaceholder: "Production",

        service: "Service",
        servicePlaceholder: "Assemblage",

        position: "Poste",
        positionPlaceholder: "Opérateur",

        workLocation: "Lieu de travail",
        workLocationPlaceholder: "Usine",

        cnssNumber: "Numéro CNSS",
        cnssNumberPlaceholder: "Numéro CNSS",

        cnssRegistrationDate: "Date d'immatriculation CNSS",

        taxIdentificationNumber: "Identifiant fiscal",
        taxIdentificationNumberPlaceholder: "Identifiant fiscal",

        taxStatus: "Statut fiscal",
        taxStatusPlaceholder: "Statut fiscal",

        numberOfChildren: "Nombre d'enfants",

        spouseWorking: "Conjoint actif",
        spouseWorkingCheckboxLabel: "Le conjoint travaille actuellement",

        bankName: "Nom de la banque",
        bankNamePlaceholder: "Banque",

        accountName: "Titulaire du compte",
        accountNamePlaceholder: "Titulaire du compte",

        rib: "RIB",
        ribPlaceholder: "RIB",

        iban: "IBAN",
        ibanPlaceholder: "IBAN",

        paymentMethod: "Mode de paiement",
        paymentMethodPlaceholder: "Sélectionner un mode",

        notes: "Notes",
        notesPlaceholder: "Notes complémentaires...",

        isActive: "Actif",
        isActiveCheckboxLabel: "L'employé est actif",
      },

      genders: {
        male: "Homme",
        female: "Femme",
        other: "Autre",
      },

      maritalStatuses: {
        single: "Célibataire",
        married: "Marié(e)",
        divorced: "Divorcé(e)",
        widowed: "Veuf/Veuve",
        other: "Autre",
      },

      taxStatus: {
        taxable: "Imposable",
        nonTaxable: "Non imposable",
        exempt: "Exonéré",
      },

      statuses: {
        active: "Actif",
        inactive: "Inactif",
        on_leave: "En congé",
        suspended: "Suspendu",
        terminated: "Fin de contrat",
        unknown: "Inconnu",
      },

      employmentTypes: {
        permanent: "CDI",
        fixed_term: "CDD",
        temporary: "Temporaire",
        intern: "Stagiaire",
        apprentice: "Apprenti",
        freelance: "Freelance",
        part_time: "Temps partiel",
        other: "Autre",
      },

      paymentMethods: {
        bank_transfer: "Virement bancaire",
        cash: "Espèces",
        check: "Chèque",
      },

      card: {
        view: "Voir",
        edit: "Modifier",
      },

      detail: {
        employeeLabel: "Employé",
        firstName: "Prénom",
        lastName: "Nom",
        gender: "Genre",
        dateOfBirth: "Date de naissance",
        nationality: "Nationalité",
        maritalStatus: "Situation familiale",
        phone: "Téléphone",
        email: "E-mail",
        address: "Adresse",
        jobTitle: "Intitulé du poste",
        department: "Département",
        employmentType: "Type de contrat",
        hireDate: "Date d'embauche",
        workLocation: "Lieu de travail",
        service: "Service",
        cin: "CIN",
        passport: "Passeport",
        cnssNumber: "Numéro CNSS",
        taxId: "Identifiant fiscal",
        empty: "—",
      },

      buttons: {
        save: "Enregistrement...",
        createEmployee: "Créer l'employé",
        updateEmployee: "Mettre à jour l'employé",
        cancel: "Annuler",
      },

      breadcrumbs: {
        hr: "RH",
        employees: "Employés",
        addEmployee: "Ajouter un employé",
        editEmployee: "Modifier l'employé",
      },

      errors: {
        companyRequired: "Veuillez sélectionner une entreprise.",
        invalidPhoto: "Veuillez sélectionner un fichier image.",
        fetchCompaniesFailed: "Échec du chargement des entreprises",
        fetchEmployeesFailed: "Échec du chargement des employés",
        createFailed: "Échec de la création de l'employé",
        updateFailed: "Échec de la mise à jour de l'employé",
        deleteFailed: "Échec de la suppression de l'employé",
        notFound: "Employé introuvable",
        duplicateEmployeeNumber: "Un employé avec ce matricule existe déjà",
        requiredFields: "Veuillez renseigner tous les champs obligatoires",
      },
    },
    salaries: {
      title: "Salaires",
      subtitle: "Gérez la rémunération et l'historique salarial des employés.",
      addSalary: "Ajouter un salaire",
      giveRaise: "Donner une augmentation",

      createTitle: "Nouvel enregistrement salarial",
      createSureMessage: "Voulez-vous vraiment enregistrer ce salaire ? Le salaire actuel de cet employé sera clôturé à cette date d'effet.",
      createSuccessTitle: "Salaire enregistré",
      createSuccessMessage: "L'enregistrement salarial a été créé avec succès.",

      deleteTitle: "Supprimer l'enregistrement",
      deleteSureMessage: "Voulez-vous vraiment supprimer cet enregistrement salarial ? Cette action est irréversible.",

      emptyTitle: "Aucun salaire",
      emptyMessage: "Cette entreprise n'a pas encore d'enregistrement salarial.",

      fields: {
        employee: "Employé",
        employeeSearchPlaceholder: "Rechercher par nom, matricule, CIN, CNSS...",
        baseSalary: "Salaire de base",
        effectiveDate: "Date d'effet",
        notes: "Notes",
        notesPlaceholder: "Motif de ce changement, contexte supplémentaire...",
      },

      table: {
        base: "Base",
        gross: "Brut",
        net: "Net",
        endDate: "Date de fin",
        status: "Statut",
        ongoing: "En cours",
      },

      actions: {
        history: "Voir l'historique",
      },

      history: {
        titleFor: "Historique salarial — {name}",
        empty: "Aucun historique salarial pour cet employé.",
        current: "Actuel",
        past: "Passé",
      },

      breadcrumbs: {
        hr: "RH",
        salaries: "Salaires",
      },

      buttons: {
        create: "Enregistrer le salaire",
      },

      errors: {
        fetchFailed: "Échec du chargement des salaires",
        actionFailed: "Une erreur est survenue. Veuillez réessayer.",
      },
    },
    absences: {
      title: "Absences",
      subtitle: "Consultez et gérez les demandes de congé et d'absence.",
      addAbsence: "Nouvelle demande d'absence",

      createTitle: "Nouvelle demande d'absence",
      createSureMessage: "Voulez-vous vraiment soumettre cette demande d'absence ?",
      createSuccessTitle: "Demande soumise",
      createSuccessMessage: "La demande d'absence a été soumise avec succès.",

      acceptTitle: "Accepter l'absence",
      acceptSureMessage: "Voulez-vous vraiment accepter cette demande d'absence ?",

      rejectTitle: "Refuser l'absence",
      rejectSureMessage: "Voulez-vous vraiment refuser cette demande d'absence ?",

      deleteTitle: "Supprimer l'absence",
      deleteSureMessage: "Voulez-vous vraiment supprimer cet enregistrement d'absence ? Cette action est irréversible.",

      emptyTitle: "Aucune absence",
      emptyMessage: "Aucune demande d'absence ne correspond à vos filtres.",

      unjustified: "Non justifiée",

      fields: {
        employee: "Employé",
        employeeSearchPlaceholder: "Rechercher par nom, matricule, CIN, CNSS...",
        type: "Type",
        startDate: "Date de début",
        endDate: "Date de fin",
        halfDay: "Demi-journée",
        justified: "Justifiée",
        reason: "Motif",
        reasonPlaceholder: "Motif ou contexte supplémentaire...",
        status: "Statut",
      },

      types: {
        paid_leave: "Congé payé",
        unpaid_leave: "Congé sans solde",
        sick_leave: "Congé maladie",
        absence: "Absence",
        other: "Autre",
      },

      status: {
        pending: "En attente",
        accepted: "Acceptée",
        rejected: "Refusée",
      },

      filters: {
        allStatuses: "Tous les statuts",
        allTypes: "Tous les types",
      },

      table: {
        period: "Période",
        days: "Jours",
      },

      actions: {
        accept: "Accepter",
        reject: "Refuser",
      },

      breadcrumbs: {
        hr: "RH",
        absences: "Absences",
      },

      buttons: {
        create: "Soumettre la demande",
      },

      errors: {
        fetchFailed: "Échec du chargement des absences",
        actionFailed: "Une erreur est survenue. Veuillez réessayer.",
      },
    },
    advances: {
      title: "Avances",
      subtitle: "Consultez et gérez les demandes d'avance sur salaire.",
      addAdvance: "Nouvelle demande d'avance",

      createTitle: "Nouvelle demande d'avance",
      createSureMessage: "Voulez-vous vraiment soumettre cette demande d'avance ?",
      createSuccessTitle: "Demande soumise",
      createSuccessMessage: "La demande d'avance a été soumise avec succès.",

      acceptTitle: "Accepter l'avance",
      acceptSureMessage: "Voulez-vous vraiment accepter cette demande d'avance ?",

      rejectTitle: "Refuser l'avance",
      rejectSureMessage: "Voulez-vous vraiment refuser cette demande d'avance ?",

      markRepaidTitle: "Marquer comme remboursée",
      markRepaidSureMessage: "Voulez-vous vraiment marquer cette avance comme entièrement remboursée ?",

      deleteTitle: "Supprimer l'avance",
      deleteSureMessage: "Voulez-vous vraiment supprimer cet enregistrement d'avance ? Cette action est irréversible.",

      emptyTitle: "Aucune avance",
      emptyMessage: "Aucune demande d'avance ne correspond à vos filtres.",

      fields: {
        employee: "Employé",
        employeeSearchPlaceholder: "Rechercher par nom, matricule, CIN, CNSS...",
        amount: "Montant",
        requestDate: "Date de la demande",
        reason: "Motif",
        reasonPlaceholder: "Motif ou contexte supplémentaire...",
        status: "Statut",
      },

      status: {
        pending: "En attente",
        accepted: "Acceptée",
        rejected: "Refusée",
      },

      filters: {
        allStatuses: "Tous les statuts",
      },

      table: {
        remaining: "Restant",
        fullyRepaid: "Entièrement remboursée",
      },

      actions: {
        accept: "Accepter",
        reject: "Refuser",
        markRepaid: "Marquer comme remboursée",
      },

      breadcrumbs: {
        hr: "RH",
        advances: "Avances",
      },

      buttons: {
        create: "Soumettre la demande",
      },

      errors: {
        fetchFailed: "Échec du chargement des avances",
        actionFailed: "Une erreur est survenue. Veuillez réessayer.",
      },
    },
  },

  // ======================================================
  // ARABIC
  // ======================================================

  ar: {
    sidebar: {
      admin: "المسؤول",
      settings: "الإعدادات",
      help: "المساعدة والدعم",
      profile: "الملف الشخصي",
      hr: "الموارد البشرية",

      companies: "الشركات",
      organization: "المؤسسة",
      company: "الشركة",
      employees: "الموظفون",
      salaries: "الرواتب",
      absences: "الغيابات",
      advances: "السلف",
      users: "المستخدمون",
      departments: "الأقسام",
      jobPositions: "المناصب",
      rolesPermissions: "الأدوار والصلاحيات",
      locations: "المواقع",
      documents: "الوثائق",
      preferences: "التفضيلات",
      integrations: "التكاملات",

      dark: "داكن",
      light: "فاتح",

      logout: "تسجيل الخروج",

      closeSidebar:
        "إغلاق الشريط الجانبي",

      openSidebar:
        "فتح الشريط الجانبي",

      switchTheme:
        "التبديل إلى الوضع {theme}",

      dashboard:
        "لوحة التحكم",
    },

    common: {
      welcome: "أهلاً بك",
      goodbye: "وداعاً",

      loading: "جارٍ التحميل...",

      error: "خطأ",
      fail: "فشل",
      success: "نجاح",

      update: "تحديث",
      cancel: "إلغاء",
      delete: "حذف",
      confirm: "تأكيد",
      close: "إغلاق",
      edit: "تعديل",
      reset: "إعادة تعيين",
      create: "إنشاء",
      noResults: "لم يتم العثور على نتائج",
    },

    profile: {
      settings: "الإعدادات",

      firstName: "الاسم الأول",
      lastName: "اسم العائلة",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",

      currentPassword:
        "كلمة المرور الحالية",

      newPassword:
        "كلمة المرور الجديدة",

      updateSureMessage:
        "هل أنت متأكد من أنك تريد تحديث ملفك الشخصي؟",

      updateFailMessage:
        "تعذر تحديث ملفك الشخصي. يرجى المحاولة مرة أخرى.",

      updateSuccessMessage:
        "تم تحديث ملفك الشخصي بنجاح.",

      bothPasswords:
        "كلمة المرور الحالية والجديدة مطلوبتان.",

      info:
        "المعلومات",
    },

    company: {
      title: "الشركة",

      subtitle:
        "إدارة معلومات الشركة",

      emptySubtitle:
        "لم يتم إعداد أي شركة بعد",

      emptyTitle:
        "لا توجد شركة",

      emptyMessage:
        "قم بإعداد ملف الشركة للبدء.",

      create:
        "إنشاء شركة",

      editTitle:
        "تعديل الشركة",

      name:
        "اسم الشركة",

      tradeName:
        "الاسم التجاري",

      legalForm:
        "الشكل القانوني",

      industry:
        "قطاع النشاط",

      ice:
        "ICE",

      taxId:
        "المعرف الضريبي",

      registrationNumber:
        "رقم السجل التجاري",

      email:
        "البريد الإلكتروني",

      phone:
        "الهاتف",

      website:
        "الموقع الإلكتروني",

      street:
        "الشارع",

      city:
        "المدينة",

      postalCode:
        "الرمز البريدي",

      logo:
        "شعار الشركة",

      employeeCount:
        "الموظفون",

      section: {
        identity:
          "الهوية",

        legal:
          "المعلومات القانونية",

        contact:
          "معلومات الاتصال",
      },

      createTitle:
        "إنشاء الشركة",

      createSureMessage:
        "هل أنت متأكد من أنك تريد إنشاء هذه الشركة؟",

      createSuccessTitle:
        "تم إنشاء الشركة",

      createSuccessMessage:
        "تم إنشاء الشركة بنجاح.",

      createFailTitle:
        "فشل الإنشاء",

      updateSureMessage:
        "هل أنت متأكد من أنك تريد حفظ هذه التغييرات؟",

      updateSuccessMessage:
        "تم تحديث الشركة بنجاح.",

      saveFailMessage:
        "حدث خطأ أثناء حفظ الشركة.",

      loadFailTitle:
        "فشل التحميل",

      loadFailMessage:
        "تعذر تحميل معلومات الشركة.",

      deleteCompany:
        "حذف الشركة",

      deleteTitle:
        "حذف الشركة",

      deleteSureMessage:
        "هل أنت متأكد من أنك تريد حذف هذه الشركة؟ لا يمكن التراجع عن هذا الإجراء.",

      deleteSuccessTitle:
        "تم حذف الشركة",

      deleteSuccessMessage:
        "تم حذف الشركة بنجاح.",

      deleteFailTitle:
        "فشل الحذف",

      deleteFailMessage:
        "حدث خطأ أثناء حذف الشركة.",

      errors: {
        deleteAdminOnly:
          "فقط المسؤولون أو مالك الشركة يمكنهم حذف هذه الشركة.",

        notFound:
          "الشركة غير موجودة.",

        deleteNotAuthorized:
          "ليس لديك صلاحية حذف هذه الشركة.",

        updateNotAuthorized:
          "ليس لديك صلاحية تعديل هذه الشركة.",

        viewNotAuthorized:
          "ليس لديك صلاحية عرض هذه الشركة.",

        duplicateCompany:
          "توجد شركة بنفس ICE أو المعرف الضريبي أو رقم التسجيل أو رقم CNSS.",

        createFailed:
          "حدث خطأ أثناء إنشاء الشركة.",

        updateFailed:
          "حدث خطأ أثناء تحديث الشركة.",

        deleteFailed:
          "حدث خطأ أثناء حذف الشركة.",

        logoNotFound:
          "شعار الشركة غير موجود.",

        logoRequired:
          "يرجى اختيار شعار.",

        logoUploadFailed:
          "حدث خطأ أثناء رفع شعار الشركة.",

        logoDeleteFailed:
          "حدث خطأ أثناء حذف شعار الشركة.",
      },
    },

    users: {
      title: "المستخدمون",

      subtitle:
        "إدارة حسابات المستخدمين والصلاحيات.",

      addUser:
        "إضافة مستخدم",

      newUser:
        "مستخدم جديد",

      createSubtitle:
        "إنشاء حساب مستخدم جديد.",

      information:
        "معلومات المستخدم",

      role:
        "الدور",

      status:
        "الحالة",

      userId:
        "معرف المستخدم",

      roles: {
        admin:
          "مسؤول",

        owner:
          "مالك",

        user:
          "مستخدم",
      },

      statuses: {
        active:
          "نشط",

        inactive:
          "غير نشط",

        suspended:
          "موقوف",
      },

      emptyTitle:
        "لا يوجد مستخدمون",

      emptyMessage:
        "لا يوجد حالياً أي مستخدمين في مؤسستك.",

      backToUsers:
        "المستخدمون",

      createTitle:
        "إنشاء مستخدم",

      createSureMessage:
        "هل أنت متأكد من أنك تريد إنشاء هذا المستخدم؟",

      createSuccessTitle:
        "تم إنشاء المستخدم",

      createSuccessMessage:
        "تم إنشاء المستخدم بنجاح.",

      createFailTitle:
        "فشل الإنشاء",

      createFailMessage:
        "تعذر إنشاء المستخدم.",

      loadFailTitle:
        "فشل التحميل",

      loadFailMessage:
        "تعذر تحميل المستخدمين. يرجى المحاولة مرة أخرى.",

      deleteUser:
        "حذف المستخدم",

      deleteTitle:
        "حذف المستخدم",

      deleteSureMessage:
        "هل أنت متأكد من أنك تريد حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.",

      deleteSuccessTitle:
        "تم حذف المستخدم",

      deleteSuccessMessage:
        "تم حذف المستخدم بنجاح.",

      deleteFailTitle:
        "فشل الحذف",

      deleteFailMessage:
        "حدث خطأ أثناء حذف المستخدم.",

      errors: {
        deleteAdminOnly:
          "فقط المسؤولون يمكنهم حذف المستخدمين.",

        notFound:
          "المستخدم غير موجود.",

        updateNotAuthorized:
          "ليس لديك صلاحية تعديل هذا المستخدم.",

        passwordNotAuthorized:
          "ليس لديك صلاحية تغيير كلمة المرور.",

        requiredCreateFields:
          "يرجى إدخال الاسم الأول واسم العائلة والبريد الإلكتروني وكلمة المرور.",

        requiredUpdateFields:
          "يرجى إدخال الاسم الأول واسم العائلة والبريد الإلكتروني.",

        requiredPasswordFields:
          "يرجى إدخال كلمة المرور الحالية والجديدة.",

        emailExists:
          "يوجد مستخدم بهذا البريد الإلكتروني بالفعل.",

        currentPasswordIncorrect:
          "كلمة المرور الحالية غير صحيحة.",
      },

      editUser: "تعديل المستخدم",
      editSubtitle: "تحديث معلومات حساب هذا المستخدم.",

      updateTitle: "تعديل المستخدم",
      updateSureMessage: "هل أنت متأكد من أنك تريد حفظ هذه التغييرات؟",

      updateSuccessTitle: "تم تحديث المستخدم",
      updateSuccessMessage: "تم تحديث المستخدم بنجاح.",

      updateFailTitle: "فشل التحديث",
      updateFailMessage: "تعذر تحديث المستخدم. يرجى المحاولة مرة أخرى.",

      department: "القسم",
      departments: {
          management: "الإدارة",
          hr: "الموارد البشرية",
          finance: "المالية",
          accounting: "المحاسبة",
          sales: "المبيعات",
          purchasing: "المشتريات",
          marketing: "التسويق",
          production: "الإنتاج",
          production_planning: "تخطيط الإنتاج",
          quality_control: "مراقبة الجودة",
          maintenance: "الصيانة",
          warehouse: "المستودع",
          logistics: "اللوجستيك",
          procurement: "التوريد",
          engineering: "الهندسة",
          design: "التصميم",
          research_development: "البحث والتطوير",
          it: "تقنية المعلومات",
          customer_service: "خدمة العملاء",
          administration: "الإدارة العامة",
          health_safety_environment: "الصحة والسلامة والبيئة",
          security: "الأمن",
      },

      emptySearchTitle: "لا توجد نتائج",
      emptySearchMessage: "لا يوجد مستخدمون مطابقون لبحثك.",

      toolbar: {
        searchPlaceholder: "البحث عن المستخدمين...",
      },
    },
    employees: {
      title: "الموظفون",
      subtitle: "إدارة موظفي شركتك ومعلوماتهم الإدارية.",
      addEmployee: "إضافة موظف",
      backToEmployees: "العودة إلى الموظفين",
      editEmployee: "تعديل الموظف",
      newEmployee: "موظف جديد",
      employeeInformation: "معلومات الموظف",
      loadFailTitle: "تعذر تحميل الموظفين",
      loadFailMessage: "حدث خطأ أثناء تحميل الموظفين. يرجى المحاولة مرة أخرى.",
      loadCompaniesFailMessage: "حدث خطأ أثناء تحميل الشركات. يرجى المحاولة مرة أخرى.",

      createTitle: "إضافة موظف",
      createSureMessage: "هل أنت متأكد من أنك تريد إنشاء هذا الموظف؟",
      createSuccessTitle: "تم إنشاء الموظف",
      createSuccessMessage: "تم إنشاء الموظف بنجاح.",
      createFailTitle: "تعذر إنشاء الموظف",
      createFailMessage: "حدث خطأ أثناء إنشاء الموظف.",

      updateTitle: "تعديل الموظف",
      updateSureMessage: "هل أنت متأكد من أنك تريد حفظ هذه التغييرات؟",
      updateSuccessTitle: "تم تحديث الموظف",
      updateSuccessMessage: "تم تحديث الموظف بنجاح.",
      updateFailTitle: "تعذر تحديث الموظف",
      updateFailMessage: "حدث خطأ أثناء تحديث الموظف.",

      deleteTitle: "حذف الموظف",
      deleteSureMessage: "هل أنت متأكد من أنك تريد حذف {name}؟ لا يمكن التراجع عن هذا الإجراء.",
      deleteSuccessTitle: "تم حذف الموظف",
      deleteSuccessMessage: "تم حذف الموظف.",
      deleteFailTitle: "تعذر حذف الموظف",
      deleteFailMessage: "حدث خطأ أثناء حذف الموظف.",

      selectCompanyRequired: "يرجى اختيار شركة.",
      invalidPhotoType: "يرجى اختيار ملف صورة.",

      toolbar: {
        company: "الشركة",
        selectCompany: "اختر الشركة",
        loadingCompanies: "جارٍ تحميل الشركات...",
        searchPlaceholder: "البحث عن موظفين...",
      },

      companyInfo: {
        employeeCount_one: "{count} موظف",
        employeeCount_other: "{count} موظفين",
      },

      emptyNoCompany: {
        title: "لم يتم العثور على شركات",
        message: "قم بإنشاء شركة أولاً قبل إضافة الموظفين.",
      },

      emptyNoEmployees: {
        title: "لم يتم العثور على موظفين",
        messageSearch: "لا يوجد موظفون مطابقون لبحثك.",
        messageDefault: "لا يوجد لدى هذه الشركة أي موظفين بعد.",
        cta: "إضافة موظف",
      },

      loading: "جارٍ تحميل الموظفين...",

      photo: {
        label: "صورة الموظف",
        choose: "اختيار صورة",
        change: "تغيير الصورة",
        remove: "إزالة",
      },

      company: {
        label: "الشركة",
        selectPlaceholder: "اختر الشركة",
        unnamed: "شركة بدون اسم",
      },

      sections: {
        personalInformation: "المعلومات الشخصية",
        contactInformation: "معلومات الاتصال",
        employment: "الوظيفة",
        identification: "الهوية",
        company: "الشركة",
        notes: "ملاحظات",
      },

      fields: {
        employeeNumber: "الرقم الوظيفي",
        employeeNumberPlaceholder: "EMP-001",

        firstName: "الاسم الأول",
        firstNamePlaceholder: "الاسم الأول",

        lastName: "اسم العائلة",
        lastNamePlaceholder: "اسم العائلة",

        firstNameArabic: "الاسم الأول (بالعربية)",
        firstNameArabicPlaceholder: "الاسم الأول",

        lastNameArabic: "اسم العائلة (بالعربية)",
        lastNameArabicPlaceholder: "اسم العائلة",

        gender: "الجنس",
        genderPlaceholder: "اختر الجنس",

        dateOfBirth: "تاريخ الميلاد",

        placeOfBirth: "مكان الميلاد",
        placeOfBirthPlaceholder: "المدينة",

        nationality: "الجنسية",
        nationalityPlaceholder: "مغربية",

        maritalStatus: "الحالة الاجتماعية",
        maritalStatusPlaceholder: "اختر الحالة",

        numberOfDependents: "عدد المعالين",

        cin: "البطاقة الوطنية",
        cinPlaceholder: "AB123456",

        passportNumber: "رقم جواز السفر",
        passportNumberPlaceholder: "رقم جواز السفر",

        passportExpiryDate: "تاريخ انتهاء جواز السفر",

        workPermitNumber: "رقم رخصة العمل",
        workPermitNumberPlaceholder: "رقم الرخصة",

        workPermitExpiryDate: "تاريخ انتهاء رخصة العمل",

        personalEmail: "البريد الإلكتروني الشخصي",
        personalEmailPlaceholder: "personal@email.com",

        workEmail: "البريد الإلكتروني المهني",
        workEmailPlaceholder: "employee@company.com",

        phone: "الهاتف",
        phonePlaceholder: "+212...",

        secondaryPhone: "هاتف إضافي",
        secondaryPhonePlaceholder: "+212...",

        street: "الشارع",
        streetPlaceholder: "العنوان",

        city: "المدينة",
        cityPlaceholder: "المدينة",

        region: "الجهة",
        regionPlaceholder: "الجهة",

        postalCode: "الرمز البريدي",
        postalCodePlaceholder: "40000",

        country: "البلد",
        countryPlaceholder: "المغرب",

        emergencyName: "جهة اتصال الطوارئ",
        emergencyNamePlaceholder: "الاسم الكامل",

        emergencyRelationship: "صلة القرابة",
        emergencyRelationshipPlaceholder: "زوج/زوجة، والد...",

        emergencyPhone: "هاتف الطوارئ",
        emergencyPhonePlaceholder: "+212...",

        emergencyEmail: "بريد إلكتروني للطوارئ",
        emergencyEmailPlaceholder: "email@example.com",

        hireDate: "تاريخ التوظيف",
        terminationDate: "تاريخ إنهاء العقد",

        employmentStatus: "حالة التوظيف",
        employmentStatusPlaceholder: "اختر الحالة",

        employmentType: "نوع العقد",
        employmentTypePlaceholder: "اختر النوع",

        jobTitle: "المسمى الوظيفي",
        jobTitlePlaceholder: "مسؤول الإنتاج",

        department: "القسم",
        departmentPlaceholder: "الإنتاج",

        service: "المصلحة",
        servicePlaceholder: "التجميع",

        position: "المنصب",
        positionPlaceholder: "عامل",

        workLocation: "مكان العمل",
        workLocationPlaceholder: "المصنع",

        cnssNumber: "رقم الضمان الاجتماعي",
        cnssNumberPlaceholder: "رقم الضمان الاجتماعي",

        cnssRegistrationDate: "تاريخ التسجيل في الضمان الاجتماعي",

        taxIdentificationNumber: "المعرف الضريبي",
        taxIdentificationNumberPlaceholder: "المعرف الضريبي",

        taxStatus: "الوضع الضريبي",
        taxStatusPlaceholder: "الوضع الضريبي",

        numberOfChildren: "عدد الأبناء",

        spouseWorking: "الزوج/الزوجة يعمل",
        spouseWorkingCheckboxLabel: "الزوج/الزوجة يعمل حالياً",

        bankName: "اسم البنك",
        bankNamePlaceholder: "البنك",

        accountName: "اسم صاحب الحساب",
        accountNamePlaceholder: "اسم صاحب الحساب",

        rib: "RIB",
        ribPlaceholder: "RIB",

        iban: "IBAN",
        ibanPlaceholder: "IBAN",

        paymentMethod: "طريقة الدفع",
        paymentMethodPlaceholder: "اختر طريقة",

        notes: "ملاحظات",
        notesPlaceholder: "ملاحظات إضافية...",

        isActive: "نشط",
        isActiveCheckboxLabel: "الموظف نشط",
      },

      genders: {
        male: "ذكر",
        female: "أنثى",
        other: "آخر",
      },

      maritalStatuses: {
        single: "أعزب",
        married: "متزوج(ة)",
        divorced: "مطلق(ة)",
        widowed: "أرمل(ة)",
        other: "آخر",
      },

      taxStatus: {
        taxable: "خاضع للضريبة",
        nonTaxable: "غير خاضع للضريبة",
        exempt: "معفى",
      },

      statuses: {
        active: "نشط",
        inactive: "غير نشط",
        on_leave: "في إجازة",
        suspended: "موقوف",
        terminated: "منتهي العقد",
        unknown: "غير معروف",
      },

      employmentTypes: {
        permanent: "عقد غير محدد المدة",
        fixed_term: "عقد محدد المدة",
        temporary: "مؤقت",
        intern: "متدرب",
        apprentice: "متمرن",
        freelance: "حر",
        part_time: "دوام جزئي",
        other: "آخر",
      },

      paymentMethods: {
        bank_transfer: "تحويل بنكي",
        cash: "نقداً",
        check: "شيك",
      },

      card: {
        view: "عرض",
        edit: "تعديل",
      },

      detail: {
        employeeLabel: "موظف",
        firstName: "الاسم الأول",
        lastName: "اسم العائلة",
        gender: "الجنس",
        dateOfBirth: "تاريخ الميلاد",
        nationality: "الجنسية",
        maritalStatus: "الحالة الاجتماعية",
        phone: "الهاتف",
        email: "البريد الإلكتروني",
        address: "العنوان",
        jobTitle: "المسمى الوظيفي",
        department: "القسم",
        employmentType: "نوع العقد",
        hireDate: "تاريخ التوظيف",
        workLocation: "مكان العمل",
        service: "المصلحة",
        cin: "البطاقة الوطنية",
        passport: "جواز السفر",
        cnssNumber: "رقم الضمان الاجتماعي",
        taxId: "المعرف الضريبي",
        empty: "—",
      },

      buttons: {
        save: "جارٍ الحفظ...",
        createEmployee: "إنشاء الموظف",
        updateEmployee: "تحديث الموظف",
        cancel: "إلغاء",
      },

      breadcrumbs: {
        hr: "الموارد البشرية",
        employees: "الموظفون",
        addEmployee: "إضافة موظف",
        editEmployee: "تعديل الموظف",
      },

      errors: {
        companyRequired: "يرجى اختيار شركة.",
        invalidPhoto: "يرجى اختيار ملف صورة.",
        fetchCompaniesFailed: "فشل تحميل الشركات",
        fetchEmployeesFailed: "فشل تحميل الموظفين",
        createFailed: "فشل إنشاء الموظف",
        updateFailed: "فشل تحديث الموظف",
        deleteFailed: "فشل حذف الموظف",
        notFound: "الموظف غير موجود",
        duplicateEmployeeNumber: "يوجد موظف بهذا الرقم الوظيفي بالفعل",
        requiredFields: "يرجى ملء جميع الحقول المطلوبة",
      },
    },
    salaries: {
      title: "الرواتب",
      subtitle: "إدارة أجور الموظفين وتاريخ رواتبهم.",
      addSalary: "إضافة راتب",
      giveRaise: "منح زيادة",

      createTitle: "سجل راتب جديد",
      createSureMessage: "هل أنت متأكد من أنك تريد حفظ هذا الراتب؟ سيتم إغلاق الراتب الحالي لهذا الموظف اعتباراً من تاريخ السريان هذا.",
      createSuccessTitle: "تم تسجيل الراتب",
      createSuccessMessage: "تم إنشاء سجل الراتب بنجاح.",

      deleteTitle: "حذف سجل الراتب",
      deleteSureMessage: "هل أنت متأكد من أنك تريد حذف سجل الراتب هذا؟ لا يمكن التراجع عن هذا الإجراء.",

      emptyTitle: "لا توجد رواتب",
      emptyMessage: "لا يوجد لدى هذه الشركة أي سجلات رواتب بعد.",

      fields: {
        employee: "الموظف",
        employeeSearchPlaceholder: "ابحث بالاسم أو الرقم الوظيفي أو البطاقة الوطنية أو رقم الضمان الاجتماعي...",
        baseSalary: "الراتب الأساسي",
        effectiveDate: "تاريخ السريان",
        notes: "ملاحظات",
        notesPlaceholder: "سبب هذا التغيير أو أي سياق إضافي...",
      },

      table: {
        base: "الأساسي",
        gross: "الإجمالي",
        net: "الصافي",
        endDate: "تاريخ الانتهاء",
        status: "الحالة",
        ongoing: "جارٍ",
      },

      actions: {
        history: "عرض السجل",
      },

      history: {
        titleFor: "سجل الرواتب — {name}",
        empty: "لا يوجد سجل رواتب لهذا الموظف.",
        current: "الحالي",
        past: "سابق",
      },

      breadcrumbs: {
        hr: "الموارد البشرية",
        salaries: "الرواتب",
      },

      buttons: {
        create: "حفظ الراتب",
      },

      errors: {
        fetchFailed: "فشل تحميل الرواتب",
        actionFailed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      },
    },
    absences: {
      title: "الغيابات",
      subtitle: "مراجعة وإدارة طلبات الإجازة والغياب.",
      addAbsence: "طلب غياب جديد",

      createTitle: "طلب غياب جديد",
      createSureMessage: "هل أنت متأكد من أنك تريد إرسال طلب الغياب هذا؟",
      createSuccessTitle: "تم إرسال الطلب",
      createSuccessMessage: "تم إرسال طلب الغياب بنجاح.",

      acceptTitle: "قبول الغياب",
      acceptSureMessage: "هل أنت متأكد من أنك تريد قبول طلب الغياب هذا؟",

      rejectTitle: "رفض الغياب",
      rejectSureMessage: "هل أنت متأكد من أنك تريد رفض طلب الغياب هذا؟",

      deleteTitle: "حذف الغياب",
      deleteSureMessage: "هل أنت متأكد من أنك تريد حذف سجل الغياب هذا؟ لا يمكن التراجع عن هذا الإجراء.",

      emptyTitle: "لا توجد غيابات",
      emptyMessage: "لا توجد طلبات غياب مطابقة لعوامل التصفية الخاصة بك.",

      unjustified: "غير مبرر",

      fields: {
        employee: "الموظف",
        employeeSearchPlaceholder: "ابحث بالاسم أو الرقم الوظيفي أو البطاقة الوطنية أو رقم الضمان الاجتماعي...",
        type: "النوع",
        startDate: "تاريخ البدء",
        endDate: "تاريخ الانتهاء",
        halfDay: "نصف يوم",
        justified: "مبرر",
        reason: "السبب",
        reasonPlaceholder: "السبب أو أي سياق إضافي...",
        status: "الحالة",
      },

      types: {
        paid_leave: "إجازة مدفوعة",
        unpaid_leave: "إجازة بدون أجر",
        sick_leave: "إجازة مرضية",
        absence: "غياب",
        other: "آخر",
      },

      status: {
        pending: "قيد الانتظار",
        accepted: "مقبول",
        rejected: "مرفوض",
      },

      filters: {
        allStatuses: "جميع الحالات",
        allTypes: "جميع الأنواع",
      },

      table: {
        period: "الفترة",
        days: "الأيام",
      },

      actions: {
        accept: "قبول",
        reject: "رفض",
      },

      breadcrumbs: {
        hr: "الموارد البشرية",
        absences: "الغيابات",
      },

      buttons: {
        create: "إرسال الطلب",
      },

      errors: {
        fetchFailed: "فشل تحميل الغيابات",
        actionFailed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      },
    },
    advances: {
      title: "السلف",
      subtitle: "مراجعة وإدارة طلبات السلف على الراتب.",
      addAdvance: "طلب سلفة جديد",

      createTitle: "طلب سلفة جديد",
      createSureMessage: "هل أنت متأكد من أنك تريد إرسال طلب السلفة هذا؟",
      createSuccessTitle: "تم إرسال الطلب",
      createSuccessMessage: "تم إرسال طلب السلفة بنجاح.",

      acceptTitle: "قبول السلفة",
      acceptSureMessage: "هل أنت متأكد من أنك تريد قبول طلب السلفة هذا؟",

      rejectTitle: "رفض السلفة",
      rejectSureMessage: "هل أنت متأكد من أنك تريد رفض طلب السلفة هذا؟",

      markRepaidTitle: "تحديد كمسددة",
      markRepaidSureMessage: "هل أنت متأكد من أنك تريد تحديد هذه السلفة كمسددة بالكامل؟",

      deleteTitle: "حذف السلفة",
      deleteSureMessage: "هل أنت متأكد من أنك تريد حذف سجل السلفة هذا؟ لا يمكن التراجع عن هذا الإجراء.",

      emptyTitle: "لا توجد سلف",
      emptyMessage: "لا توجد طلبات سلف مطابقة لعوامل التصفية الخاصة بك.",

      fields: {
        employee: "الموظف",
        employeeSearchPlaceholder: "ابحث بالاسم أو الرقم الوظيفي أو البطاقة الوطنية أو رقم الضمان الاجتماعي...",
        amount: "المبلغ",
        requestDate: "تاريخ الطلب",
        reason: "السبب",
        reasonPlaceholder: "السبب أو أي سياق إضافي...",
        status: "الحالة",
      },

      status: {
        pending: "قيد الانتظار",
        accepted: "مقبولة",
        rejected: "مرفوضة",
      },

      filters: {
        allStatuses: "جميع الحالات",
      },

      table: {
        remaining: "المتبقي",
        fullyRepaid: "مسددة بالكامل",
      },

      actions: {
        accept: "قبول",
        reject: "رفض",
        markRepaid: "تحديد كمسددة",
      },

      breadcrumbs: {
        hr: "الموارد البشرية",
        advances: "السلف",
      },

      buttons: {
        create: "إرسال الطلب",
      },

      errors: {
        fetchFailed: "فشل تحميل السلف",
        actionFailed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      },
    },
  },

  // ======================================================
  // SPANISH
  // ======================================================

  es: {
    sidebar: {
      admin: "Administración",
      settings: "Configuración",
      help: "Ayuda y soporte",
      profile: "Perfil",
      hr: "Recursos Humanos",

      companies: "Empresas",
      organization: "Organización",
      company: "Empresa",
      employees: "Empleados",
      salaries: "Salarios",
      absences: "Ausencias",
      advances: "Anticipos",
      users: "Usuarios",
      departments: "Departamentos",
      jobPositions: "Puestos",
      rolesPermissions: "Roles y permisos",
      locations: "Ubicaciones",
      documents: "Documentos",
      preferences: "Preferencias",
      integrations: "Integraciones",

      dark: "Oscuro",
      light: "Claro",

      logout: "Cerrar sesión",

      closeSidebar:
        "Cerrar barra lateral",

      openSidebar:
        "Abrir barra lateral",

      switchTheme:
        "Cambiar al modo {theme}",

      dashboard:
        "Panel",
    },

    common: {
      welcome: "Bienvenido",
      goodbye: "Adiós",
      loading: "Cargando...",
      error: "Error",
      fail: "Fallido",
      success: "Éxito",
      update: "Actualizar",
      cancel: "Cancelar",
      delete: "Eliminar",
      confirm: "Confirmar",
      close: "Cerrar",
      edit: "Editar",
      reset: "Restablecer",
      create: "Crear",
      noResults: "No se encontraron resultados",
    },

    profile: {
      settings: "Configuración",

      firstName: "Nombre",
      lastName: "Apellidos",
      email: "Correo electrónico",
      password: "Contraseña",

      currentPassword: "Contraseña actual",
      newPassword: "Nueva contraseña",

      updateSureMessage:
        "¿Seguro que quieres actualizar tu perfil?",

      updateFailMessage:
        "No se pudo actualizar tu perfil. Inténtalo de nuevo.",

      updateSuccessMessage:
        "Tu perfil se ha actualizado correctamente.",

      bothPasswords:
        "Se requieren la contraseña actual y la nueva contraseña.",

      info: "Información",
    },

    company: {
      title: "Empresa",
      subtitle:
        "Gestiona la información de tu empresa",

      emptySubtitle:
        "No hay ninguna empresa configurada",

      emptyTitle:
        "No hay empresa",

      emptyMessage:
        "Configura el perfil de tu empresa para comenzar.",

      create:
        "Crear empresa",

      editTitle:
        "Editar empresa",

      name:
        "Nombre de la empresa",

      tradeName:
        "Nombre comercial",

      legalForm:
        "Forma jurídica",

      industry:
        "Sector",

      ice:
        "ICE",

      taxId:
        "Identificación fiscal",

      registrationNumber:
        "Número de registro",

      email:
        "Correo electrónico",

      phone:
        "Teléfono",

      website:
        "Sitio web",

      street:
        "Calle",

      city:
        "Ciudad",

      postalCode:
        "Código postal",

      logo:
        "Logo de la empresa",

      employeeCount:
        "Empleados",

      section: {
        identity:
          "Identidad",

        legal:
          "Información legal",

        contact:
          "Contacto",
      },

      createTitle:
        "Crear empresa",

      createSureMessage:
        "¿Estás seguro de que quieres crear esta empresa?",

      createSuccessTitle:
        "Empresa creada",

      createSuccessMessage:
        "La empresa se ha creado correctamente.",

      createFailTitle:
        "Error de creación",

      updateSureMessage:
        "¿Estás seguro de que quieres guardar estos cambios?",

      updateSuccessMessage:
        "La empresa se ha actualizado correctamente.",

      saveFailMessage:
        "Ha ocurrido un error al guardar la empresa.",

      loadFailTitle:
        "Error de carga",

      loadFailMessage:
        "No se pudo cargar la información de la empresa.",

      deleteCompany:
        "Eliminar empresa",

      deleteTitle:
        "Eliminar empresa",

      deleteSureMessage:
        "¿Estás seguro de que quieres eliminar esta empresa? Esta acción no se puede deshacer.",

      deleteSuccessTitle:
        "Empresa eliminada",

      deleteSuccessMessage:
        "La empresa se ha eliminado correctamente.",

      deleteFailTitle:
        "Error de eliminación",

      deleteFailMessage:
        "Ha ocurrido un error al eliminar la empresa.",

      errors: {
        deleteAdminOnly:
          "Solo los administradores o el propietario de la empresa pueden eliminarla.",

        notFound:
          "Empresa no encontrada.",

        deleteNotAuthorized:
          "No tienes autorización para eliminar esta empresa.",

        updateNotAuthorized:
          "No tienes autorización para actualizar esta empresa.",

        viewNotAuthorized:
          "No tienes autorización para ver esta empresa.",

        duplicateCompany:
          "Ya existe una empresa con este ICE, identificación fiscal, número de registro o número CNSS.",

        createFailed:
          "Error al crear la empresa.",

        updateFailed:
          "Error al actualizar la empresa.",

        deleteFailed:
          "Error al eliminar la empresa.",

        logoNotFound:
          "Logo de la empresa no encontrado.",

        logoRequired:
          "Selecciona un logo.",

        logoUploadFailed:
          "Error al subir el logo.",

        logoDeleteFailed:
          "Error al eliminar el logo.",
      },
    },

    users: {
      title: "Usuarios",
      subtitle:
        "Gestiona las cuentas y los accesos de los usuarios.",

      addUser:
        "Añadir usuario",

      newUser:
        "Nuevo usuario",

      createSubtitle:
        "Crear una nueva cuenta de usuario.",

      information:
        "Información del usuario",

      role: "Rol",
      status: "Estado",
      userId: "ID de usuario",

      roles: {
        admin: "Administrador",
        owner: "Propietario",
        user: "Usuario",
      },

      statuses: {
        active: "Activo",
        inactive: "Inactivo",
        suspended: "Suspendido",
      },

      emptyTitle:
        "No hay usuarios",

      emptyMessage:
        "Actualmente no hay usuarios en tu organización.",

      backToUsers:
        "Usuarios",

      createTitle:
        "Crear usuario",

      createSureMessage:
        "¿Estás seguro de que quieres crear este usuario?",

      createSuccessTitle:
        "Usuario creado",

      createSuccessMessage:
        "El usuario se ha creado correctamente.",

      createFailTitle:
        "Error de creación",

      createFailMessage:
        "No se pudo crear el usuario.",

      loadFailTitle:
        "Error de carga",

      loadFailMessage:
        "No se pudieron cargar los usuarios. Inténtalo de nuevo.",

      deleteUser:
        "Eliminar usuario",

      deleteTitle:
        "Eliminar usuario",

      deleteSureMessage:
        "¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.",

      deleteSuccessTitle:
        "Usuario eliminado",

      deleteSuccessMessage:
        "El usuario se ha eliminado correctamente.",

      deleteFailTitle:
        "Error de eliminación",

      deleteFailMessage:
        "Ha ocurrido un error al eliminar el usuario.",

      errors: {
        deleteAdminOnly:
          "Solo los administradores pueden eliminar usuarios.",

        notFound:
          "Usuario no encontrado.",

        updateNotAuthorized:
          "No tienes autorización para actualizar este usuario.",

        passwordNotAuthorized:
          "No tienes autorización para cambiar esta contraseña.",

        requiredCreateFields:
          "Proporciona nombre, apellido, correo electrónico y contraseña.",

        requiredUpdateFields:
          "Proporciona nombre, apellido y correo electrónico.",

        requiredPasswordFields:
          "Proporciona la contraseña actual y la nueva contraseña.",

        emailExists:
          "Ya existe un usuario con este correo electrónico.",

        currentPasswordIncorrect:
          "La contraseña actual es incorrecta.",
      },

      editUser: "Editar usuario",
      editSubtitle: "Actualiza la información de la cuenta de este usuario.",

      updateTitle: "Editar usuario",
      updateSureMessage: "¿Seguro que quieres guardar estos cambios?",

      updateSuccessTitle: "Usuario actualizado",
      updateSuccessMessage: "El usuario se ha actualizado correctamente.",

      updateFailTitle: "Error al actualizar",
      updateFailMessage: "No se pudo actualizar el usuario. Inténtalo de nuevo.",

      department: "Departamento",
      departments: {
          management: "Dirección",
          hr: "Recursos Humanos",
          finance: "Finanzas",
          accounting: "Contabilidad",
          sales: "Ventas",
          purchasing: "Compras",
          marketing: "Marketing",
          production: "Producción",
          production_planning: "Planificación de la producción",
          quality_control: "Control de calidad",
          maintenance: "Mantenimiento",
          warehouse: "Almacén",
          logistics: "Logística",
          procurement: "Aprovisionamiento",
          engineering: "Ingeniería",
          design: "Diseño",
          research_development: "Investigación y Desarrollo",
          it: "Informática",
          customer_service: "Atención al cliente",
          administration: "Administración",
          health_safety_environment: "Salud, seguridad y medio ambiente",
          security: "Seguridad",
      },

      emptySearchTitle: "Sin resultados",
      emptySearchMessage: "Ningún usuario coincide con tu búsqueda.",

      toolbar: {
        searchPlaceholder: "Buscar usuarios...",
      },
    },
    employees: {
      title: "Empleados",
      subtitle: "Gestiona los empleados de tu empresa y su información de RR. HH.",
      addEmployee: "Añadir empleado",
      backToEmployees: "Volver a empleados",
      editEmployee: "Editar empleado",
      newEmployee: "Nuevo empleado",
      employeeInformation: "Información del empleado",
      loadFailTitle: "No se pudieron cargar los empleados",
      loadFailMessage: "Ocurrió un error al cargar los empleados. Inténtalo de nuevo.",
      loadCompaniesFailMessage: "Ocurrió un error al cargar las empresas. Inténtalo de nuevo.",

      createTitle: "Añadir empleado",
      createSureMessage: "¿Seguro que quieres crear este empleado?",
      createSuccessTitle: "Empleado creado",
      createSuccessMessage: "El empleado se ha creado correctamente.",
      createFailTitle: "No se pudo crear el empleado",
      createFailMessage: "Ocurrió un error al crear el empleado.",

      updateTitle: "Editar empleado",
      updateSureMessage: "¿Seguro que quieres guardar estos cambios?",
      updateSuccessTitle: "Empleado actualizado",
      updateSuccessMessage: "El empleado se ha actualizado correctamente.",
      updateFailTitle: "No se pudo actualizar el empleado",
      updateFailMessage: "Ocurrió un error al actualizar el empleado.",

      deleteTitle: "Eliminar empleado",
      deleteSureMessage: "¿Seguro que quieres eliminar a {name}? Esta acción no se puede deshacer.",
      deleteSuccessTitle: "Empleado eliminado",
      deleteSuccessMessage: "El empleado ha sido eliminado.",
      deleteFailTitle: "No se pudo eliminar el empleado",
      deleteFailMessage: "Ocurrió un error al eliminar el empleado.",

      selectCompanyRequired: "Selecciona una empresa.",
      invalidPhotoType: "Selecciona un archivo de imagen.",

      toolbar: {
        company: "Empresa",
        selectCompany: "Seleccionar empresa",
        loadingCompanies: "Cargando empresas...",
        searchPlaceholder: "Buscar empleados...",
      },

      companyInfo: {
        employeeCount_one: "{count} empleado",
        employeeCount_other: "{count} empleados",
      },

      emptyNoCompany: {
        title: "No se encontraron empresas",
        message: "Crea una empresa antes de añadir empleados.",
      },

      emptyNoEmployees: {
        title: "No se encontraron empleados",
        messageSearch: "Ningún empleado coincide con tu búsqueda.",
        messageDefault: "Esta empresa todavía no tiene empleados.",
        cta: "Añadir empleado",
      },

      loading: "Cargando empleados...",

      photo: {
        label: "Foto del empleado",
        choose: "Elegir foto",
        change: "Cambiar foto",
        remove: "Eliminar",
      },

      company: {
        label: "Empresa",
        selectPlaceholder: "Seleccionar empresa",
        unnamed: "Empresa sin nombre",
      },

      sections: {
        personalInformation: "Información personal",
        contactInformation: "Información de contacto",
        employment: "Empleo",
        identification: "Identificación",
        company: "Empresa",
        notes: "Notas",
      },

      fields: {
        employeeNumber: "Número de empleado",
        employeeNumberPlaceholder: "EMP-001",

        firstName: "Nombre",
        firstNamePlaceholder: "Nombre",

        lastName: "Apellidos",
        lastNamePlaceholder: "Apellidos",

        firstNameArabic: "Nombre (árabe)",
        firstNameArabicPlaceholder: "الاسم الأول",

        lastNameArabic: "Apellidos (árabe)",
        lastNameArabicPlaceholder: "اسم العائلة",

        gender: "Género",
        genderPlaceholder: "Seleccionar género",

        dateOfBirth: "Fecha de nacimiento",

        placeOfBirth: "Lugar de nacimiento",
        placeOfBirthPlaceholder: "Ciudad",

        nationality: "Nacionalidad",
        nationalityPlaceholder: "Marroquí",

        maritalStatus: "Estado civil",
        maritalStatusPlaceholder: "Seleccionar estado",

        numberOfDependents: "Personas a cargo",

        cin: "CIN",
        cinPlaceholder: "AB123456",

        passportNumber: "Número de pasaporte",
        passportNumberPlaceholder: "Número de pasaporte",

        passportExpiryDate: "Caducidad del pasaporte",

        workPermitNumber: "Número de permiso de trabajo",
        workPermitNumberPlaceholder: "Número de permiso",

        workPermitExpiryDate: "Caducidad del permiso de trabajo",

        personalEmail: "Correo personal",
        personalEmailPlaceholder: "personal@email.com",

        workEmail: "Correo laboral",
        workEmailPlaceholder: "empleado@empresa.com",

        phone: "Teléfono",
        phonePlaceholder: "+212...",

        secondaryPhone: "Teléfono secundario",
        secondaryPhonePlaceholder: "+212...",

        street: "Calle",
        streetPlaceholder: "Dirección",

        city: "Ciudad",
        cityPlaceholder: "Ciudad",

        region: "Región",
        regionPlaceholder: "Región",

        postalCode: "Código postal",
        postalCodePlaceholder: "40000",

        country: "País",
        countryPlaceholder: "Marruecos",

        emergencyName: "Contacto de emergencia",
        emergencyNamePlaceholder: "Nombre completo",

        emergencyRelationship: "Parentesco",
        emergencyRelationshipPlaceholder: "Cónyuge, padre/madre...",

        emergencyPhone: "Teléfono de emergencia",
        emergencyPhonePlaceholder: "+212...",

        emergencyEmail: "Correo de emergencia",
        emergencyEmailPlaceholder: "email@ejemplo.com",

        hireDate: "Fecha de contratación",
        terminationDate: "Fecha de finalización",

        employmentStatus: "Estado laboral",
        employmentStatusPlaceholder: "Seleccionar estado",

        employmentType: "Tipo de contrato",
        employmentTypePlaceholder: "Seleccionar tipo",

        jobTitle: "Puesto",
        jobTitlePlaceholder: "Jefe de producción",

        department: "Departamento",
        departmentPlaceholder: "Producción",

        service: "Servicio",
        servicePlaceholder: "Ensamblaje",

        position: "Cargo",
        positionPlaceholder: "Operario",

        workLocation: "Lugar de trabajo",
        workLocationPlaceholder: "Fábrica",

        cnssNumber: "Número de la CNSS",
        cnssNumberPlaceholder: "Número de la CNSS",

        cnssRegistrationDate: "Fecha de registro en la CNSS",

        taxIdentificationNumber: "Número de identificación fiscal",
        taxIdentificationNumberPlaceholder: "NIF",

        taxStatus: "Situación fiscal",
        taxStatusPlaceholder: "Situación fiscal",

        numberOfChildren: "Número de hijos",

        spouseWorking: "Cónyuge trabaja",
        spouseWorkingCheckboxLabel: "El cónyuge trabaja actualmente",

        bankName: "Nombre del banco",
        bankNamePlaceholder: "Banco",

        accountName: "Titular de la cuenta",
        accountNamePlaceholder: "Titular de la cuenta",

        rib: "RIB",
        ribPlaceholder: "RIB",

        iban: "IBAN",
        ibanPlaceholder: "IBAN",

        paymentMethod: "Método de pago",
        paymentMethodPlaceholder: "Seleccionar método",

        notes: "Notas",
        notesPlaceholder: "Notas adicionales...",

        isActive: "Activo",
        isActiveCheckboxLabel: "El empleado está activo",
      },

      genders: {
        male: "Masculino",
        female: "Femenino",
        other: "Otro",
      },

      maritalStatuses: {
        single: "Soltero/a",
        married: "Casado/a",
        divorced: "Divorciado/a",
        widowed: "Viudo/a",
        other: "Otro",
      },

      taxStatus: {
        taxable: "Sujeto a impuestos",
        nonTaxable: "No sujeto a impuestos",
        exempt: "Exento",
      },

      statuses: {
        active: "Activo",
        inactive: "Inactivo",
        on_leave: "De baja",
        suspended: "Suspendido",
        terminated: "Contrato finalizado",
        unknown: "Desconocido",
      },

      employmentTypes: {
        permanent: "Indefinido",
        fixed_term: "Temporal",
        temporary: "Eventual",
        intern: "Becario",
        apprentice: "Aprendiz",
        freelance: "Autónomo",
        part_time: "Media jornada",
        other: "Otro",
      },

      paymentMethods: {
        bank_transfer: "Transferencia bancaria",
        cash: "Efectivo",
        check: "Cheque",
      },

      card: {
        view: "Ver",
        edit: "Editar",
      },

      detail: {
        employeeLabel: "Empleado",
        firstName: "Nombre",
        lastName: "Apellidos",
        gender: "Género",
        dateOfBirth: "Fecha de nacimiento",
        nationality: "Nacionalidad",
        maritalStatus: "Estado civil",
        phone: "Teléfono",
        email: "Correo electrónico",
        address: "Dirección",
        jobTitle: "Puesto",
        department: "Departamento",
        employmentType: "Tipo de contrato",
        hireDate: "Fecha de contratación",
        workLocation: "Lugar de trabajo",
        service: "Servicio",
        cin: "CIN",
        passport: "Pasaporte",
        cnssNumber: "Número de la CNSS",
        taxId: "NIF",
        empty: "—",
      },

      buttons: {
        save: "Guardando...",
        createEmployee: "Crear empleado",
        updateEmployee: "Actualizar empleado",
        cancel: "Cancelar",
      },

      breadcrumbs: {
        hr: "RR. HH.",
        employees: "Empleados",
        addEmployee: "Añadir empleado",
        editEmployee: "Editar empleado",
      },

      errors: {
        companyRequired: "Selecciona una empresa.",
        invalidPhoto: "Selecciona un archivo de imagen.",
        fetchCompaniesFailed: "Error al obtener las empresas",
        fetchEmployeesFailed: "Error al obtener los empleados",
        createFailed: "Error al crear el empleado",
        updateFailed: "Error al actualizar el empleado",
        deleteFailed: "Error al eliminar el empleado",
        notFound: "Empleado no encontrado",
        duplicateEmployeeNumber: "Ya existe un empleado con este número",
        requiredFields: "Completa todos los campos obligatorios",
      },
    },
    salaries: {
      title: "Salarios",
      subtitle: "Gestiona la retribución y el historial salarial de los empleados.",
      addSalary: "Añadir salario",
      giveRaise: "Dar un aumento",

      createTitle: "Nuevo registro salarial",
      createSureMessage: "¿Seguro que quieres guardar este salario? El salario actual de este empleado se cerrará a partir de esta fecha de vigencia.",
      createSuccessTitle: "Salario registrado",
      createSuccessMessage: "El registro salarial se ha creado correctamente.",

      deleteTitle: "Eliminar registro salarial",
      deleteSureMessage: "¿Seguro que quieres eliminar este registro salarial? Esta acción no se puede deshacer.",

      emptyTitle: "Sin salarios",
      emptyMessage: "Esta empresa todavía no tiene registros salariales.",

      fields: {
        employee: "Empleado",
        employeeSearchPlaceholder: "Buscar por nombre, número, CIN, CNSS...",
        baseSalary: "Salario base",
        effectiveDate: "Fecha de vigencia",
        notes: "Notas",
        notesPlaceholder: "Motivo de este cambio, contexto adicional...",
      },

      table: {
        base: "Base",
        gross: "Bruto",
        net: "Neto",
        endDate: "Fecha de fin",
        status: "Estado",
        ongoing: "En curso",
      },

      actions: {
        history: "Ver historial",
      },

      history: {
        titleFor: "Historial salarial — {name}",
        empty: "No hay historial salarial para este empleado.",
        current: "Actual",
        past: "Anterior",
      },

      breadcrumbs: {
        hr: "RR. HH.",
        salaries: "Salarios",
      },

      buttons: {
        create: "Guardar salario",
      },

      errors: {
        fetchFailed: "Error al cargar los salarios",
        actionFailed: "Algo salió mal. Inténtalo de nuevo.",
      },
    },
    absences: {
      title: "Ausencias",
      subtitle: "Revisa y gestiona las solicitudes de permiso y ausencia.",
      addAbsence: "Nueva solicitud de ausencia",

      createTitle: "Nueva solicitud de ausencia",
      createSureMessage: "¿Seguro que quieres enviar esta solicitud de ausencia?",
      createSuccessTitle: "Solicitud enviada",
      createSuccessMessage: "La solicitud de ausencia se ha enviado correctamente.",

      acceptTitle: "Aceptar ausencia",
      acceptSureMessage: "¿Seguro que quieres aceptar esta solicitud de ausencia?",

      rejectTitle: "Rechazar ausencia",
      rejectSureMessage: "¿Seguro que quieres rechazar esta solicitud de ausencia?",

      deleteTitle: "Eliminar ausencia",
      deleteSureMessage: "¿Seguro que quieres eliminar este registro de ausencia? Esta acción no se puede deshacer.",

      emptyTitle: "Sin ausencias",
      emptyMessage: "Ninguna solicitud de ausencia coincide con tus filtros.",

      unjustified: "No justificada",

      fields: {
        employee: "Empleado",
        employeeSearchPlaceholder: "Buscar por nombre, número, CIN, CNSS...",
        type: "Tipo",
        startDate: "Fecha de inicio",
        endDate: "Fecha de fin",
        halfDay: "Medio día",
        justified: "Justificada",
        reason: "Motivo",
        reasonPlaceholder: "Motivo o contexto adicional...",
        status: "Estado",
      },

      types: {
        paid_leave: "Permiso retribuido",
        unpaid_leave: "Permiso no retribuido",
        sick_leave: "Baja por enfermedad",
        absence: "Ausencia",
        other: "Otro",
      },

      status: {
        pending: "Pendiente",
        accepted: "Aceptada",
        rejected: "Rechazada",
      },

      filters: {
        allStatuses: "Todos los estados",
        allTypes: "Todos los tipos",
      },

      table: {
        period: "Periodo",
        days: "Días",
      },

      actions: {
        accept: "Aceptar",
        reject: "Rechazar",
      },

      breadcrumbs: {
        hr: "RR. HH.",
        absences: "Ausencias",
      },

      buttons: {
        create: "Enviar solicitud",
      },

      errors: {
        fetchFailed: "Error al cargar las ausencias",
        actionFailed: "Algo salió mal. Inténtalo de nuevo.",
      },
    },
    advances: {
      title: "Anticipos",
      subtitle: "Revisa y gestiona las solicitudes de anticipo salarial.",
      addAdvance: "Nueva solicitud de anticipo",

      createTitle: "Nueva solicitud de anticipo",
      createSureMessage: "¿Seguro que quieres enviar esta solicitud de anticipo?",
      createSuccessTitle: "Solicitud enviada",
      createSuccessMessage: "La solicitud de anticipo se ha enviado correctamente.",

      acceptTitle: "Aceptar anticipo",
      acceptSureMessage: "¿Seguro que quieres aceptar esta solicitud de anticipo?",

      rejectTitle: "Rechazar anticipo",
      rejectSureMessage: "¿Seguro que quieres rechazar esta solicitud de anticipo?",

      markRepaidTitle: "Marcar como reembolsado",
      markRepaidSureMessage: "¿Seguro que quieres marcar este anticipo como totalmente reembolsado?",

      deleteTitle: "Eliminar anticipo",
      deleteSureMessage: "¿Seguro que quieres eliminar este registro de anticipo? Esta acción no se puede deshacer.",

      emptyTitle: "Sin anticipos",
      emptyMessage: "Ninguna solicitud de anticipo coincide con tus filtros.",

      fields: {
        employee: "Empleado",
        employeeSearchPlaceholder: "Buscar por nombre, número, CIN, CNSS...",
        amount: "Importe",
        requestDate: "Fecha de solicitud",
        reason: "Motivo",
        reasonPlaceholder: "Motivo o contexto adicional...",
        status: "Estado",
      },

      status: {
        pending: "Pendiente",
        accepted: "Aceptado",
        rejected: "Rechazado",
      },

      filters: {
        allStatuses: "Todos los estados",
      },

      table: {
        remaining: "Restante",
        fullyRepaid: "Totalmente reembolsado",
      },

      actions: {
        accept: "Aceptar",
        reject: "Rechazar",
        markRepaid: "Marcar como reembolsado",
      },

      breadcrumbs: {
        hr: "RR. HH.",
        advances: "Anticipos",
      },

      buttons: {
        create: "Enviar solicitud",
      },

      errors: {
        fetchFailed: "Error al cargar los anticipos",
        actionFailed: "Algo salió mal. Inténtalo de nuevo.",
      },
    },
  },

  // ======================================================
  // PORTUGUESE
  // ======================================================

  pt: {
    sidebar: {
      admin: "Admin",
      settings: "Configurações",
      help: "Ajuda e Suporte",
      profile: "Perfil",
      hr: "Recursos Humanos",

      companies: "Empresas",
      organization: "Organização",
      company: "Empresa",
      employees: "Funcionários",
      salaries: "Salários",
      absences: "Ausências",
      advances: "Adiantamentos",
      users: "Utilizadores",
      departments: "Departamentos",
      jobPositions: "Cargos",
      rolesPermissions: "Funções e Permissões",
      locations: "Localizações",
      documents: "Documentos",
      preferences: "Preferências",
      integrations: "Integrações",

      dark: "Escuro",
      light: "Claro",

      logout: "Sair",

      closeSidebar:
        "Fechar barra lateral",

      openSidebar:
        "Abrir barra lateral",

      switchTheme:
        "Mudar para o modo {theme}",

      dashboard:
        "Painel",
    },

    common: {
      welcome: "Bem-vindo",
      goodbye: "Adeus",
      loading: "Carregando...",
      error: "Erro",
      fail: "Falha",
      success: "Sucesso",
      update: "Atualizar",
      cancel: "Cancelar",
      delete: "Eliminar",
      confirm: "Confirmar",
      close: "Fechar",
      edit: "Editar",
      reset: "Redefinir",
      create: "Criar",
      noResults: "Nenhum resultado encontrado",
    },

    profile: {
      settings: "Definições",

      firstName: "Nome",
      lastName: "Apelido",
      email: "E-mail",
      password: "Palavra-passe",

      currentPassword: "Palavra-passe atual",
      newPassword: "Nova palavra-passe",

      updateSureMessage:
        "Tem a certeza de que deseja atualizar o seu perfil?",

      updateFailMessage:
        "Não foi possível atualizar o seu perfil. Tente novamente.",

      updateSuccessMessage:
        "O seu perfil foi atualizado com sucesso.",

      bothPasswords:
        "É necessário indicar a palavra-passe atual e a nova.",

      info: "Informação",
    },

    company: {
      title: "Empresa",

      subtitle:
        "Gerencie as informações da sua empresa",

      emptySubtitle:
        "Nenhuma empresa configurada",

      emptyTitle:
        "Nenhuma empresa",

      emptyMessage:
        "Configure o perfil da sua empresa para começar.",

      create:
        "Criar empresa",

      editTitle:
        "Editar empresa",

      name:
        "Nome da empresa",

      tradeName:
        "Nome comercial",

      legalForm:
        "Forma jurídica",

      industry:
        "Setor",

      ice:
        "ICE",

      taxId:
        "Identificação fiscal",

      registrationNumber:
        "Número de registro",

      email:
        "E-mail",

      phone:
        "Telefone",

      website:
        "Site",

      street:
        "Rua",

      city:
        "Cidade",

      postalCode:
        "Código postal",

      logo:
        "Logotipo da empresa",

      employeeCount:
        "Funcionários",

      section: {
        identity:
          "Identidade",

        legal:
          "Informações legais",

        contact:
          "Contacto",
      },

      createTitle:
        "Criar empresa",

      createSureMessage:
        "Tem a certeza de que deseja criar esta empresa?",

      createSuccessTitle:
        "Empresa criada",

      createSuccessMessage:
        "A empresa foi criada com sucesso.",

      createFailTitle:
        "Falha na criação",

      updateSureMessage:
        "Tem a certeza de que deseja guardar estas alterações?",

      updateSuccessMessage:
        "A empresa foi atualizada com sucesso.",

      saveFailMessage:
        "Ocorreu um erro ao guardar a empresa.",

      loadFailTitle:
        "Falha ao carregar",

      loadFailMessage:
        "Não foi possível carregar as informações da empresa.",

      deleteCompany:
        "Eliminar empresa",

      deleteTitle:
        "Eliminar empresa",

      deleteSureMessage:
        "Tem a certeza de que deseja eliminar esta empresa? Esta ação não pode ser desfeita.",

      deleteSuccessTitle:
        "Empresa eliminada",

      deleteSuccessMessage:
        "A empresa foi eliminada com sucesso.",

      deleteFailTitle:
        "Falha na eliminação",

      deleteFailMessage:
        "Ocorreu um erro ao eliminar a empresa.",

      errors: {
        deleteAdminOnly:
          "Apenas administradores ou o proprietário da empresa podem eliminá-la.",

        notFound:
          "Empresa não encontrada.",

        deleteNotAuthorized:
          "Não tem autorização para eliminar esta empresa.",

        updateNotAuthorized:
          "Não tem autorização para atualizar esta empresa.",

        viewNotAuthorized:
          "Não tem autorização para visualizar esta empresa.",

        duplicateCompany:
          "Já existe uma empresa com este ICE, identificação fiscal, número de registro ou número CNSS.",

        createFailed:
          "Erro ao criar a empresa.",

        updateFailed:
          "Erro ao atualizar a empresa.",

        deleteFailed:
          "Erro ao eliminar a empresa.",

        logoNotFound:
          "Logotipo da empresa não encontrado.",

        logoRequired:
          "Selecione um logotipo.",

        logoUploadFailed:
          "Erro ao carregar o logotipo.",

        logoDeleteFailed:
          "Erro ao eliminar o logotipo.",
      },
    },

    users: {
      title: "Utilizadores",
      subtitle:
        "Gerencie as contas e os acessos dos utilizadores.",

      addUser:
        "Adicionar utilizador",

      newUser:
        "Novo utilizador",

      createSubtitle:
        "Criar uma nova conta de utilizador.",

      information:
        "Informações do utilizador",

      role: "Função",
      status: "Estado",
      userId: "ID do utilizador",

      roles: {
        admin: "Administrador",
        owner: "Proprietário",
        user: "Utilizador",
      },

      statuses: {
        active: "Ativo",
        inactive: "Inativo",
        suspended: "Suspenso",
      },

      emptyTitle:
        "Nenhum utilizador",

      emptyMessage:
        "Atualmente não existem utilizadores na sua organização.",

      backToUsers:
        "Utilizadores",

      createTitle:
        "Criar utilizador",

      createSureMessage:
        "Tem a certeza de que deseja criar este utilizador?",

      createSuccessTitle:
        "Utilizador criado",

      createSuccessMessage:
        "O utilizador foi criado com sucesso.",

      createFailTitle:
        "Falha na criação",

      createFailMessage:
        "Não foi possível criar o utilizador.",

      loadFailTitle:
        "Falha ao carregar",

      loadFailMessage:
        "Não foi possível carregar os utilizadores. Tente novamente.",

      deleteUser:
        "Eliminar utilizador",

      deleteTitle:
        "Eliminar utilizador",

      deleteSureMessage:
        "Tem a certeza de que deseja eliminar este utilizador? Esta ação não pode ser desfeita.",

      deleteSuccessTitle:
        "Utilizador eliminado",

      deleteSuccessMessage:
        "O utilizador foi eliminado com sucesso.",

      deleteFailTitle:
        "Falha na eliminação",

      deleteFailMessage:
        "Ocorreu um erro ao eliminar o utilizador.",

      errors: {
        deleteAdminOnly:
          "Apenas administradores podem eliminar utilizadores.",

        notFound:
          "Utilizador não encontrado.",

        updateNotAuthorized:
          "Não tem autorização para atualizar este utilizador.",

        passwordNotAuthorized:
          "Não tem autorização para alterar esta palavra-passe.",

        requiredCreateFields:
          "Forneça o nome, apelido, e-mail e palavra-passe.",

        requiredUpdateFields:
          "Forneça o nome, apelido e e-mail.",

        requiredPasswordFields:
          "Forneça a palavra-passe atual e a nova palavra-passe.",

        emailExists:
          "Já existe um utilizador com este e-mail.",

        currentPasswordIncorrect:
          "A palavra-passe atual está incorreta.",
      },

      editUser: "Editar utilizador",
      editSubtitle: "Atualize as informações da conta deste utilizador.",

      updateTitle: "Editar utilizador",
      updateSureMessage: "Tem a certeza de que deseja guardar estas alterações?",

      updateSuccessTitle: "Utilizador atualizado",
      updateSuccessMessage: "O utilizador foi atualizado com sucesso.",

      updateFailTitle: "Falha ao atualizar",
      updateFailMessage: "Não foi possível atualizar o utilizador. Tente novamente.",

      department: "Departamento",
      departments: {
          management: "Direção",
          hr: "Recursos Humanos",
          finance: "Finanças",
          accounting: "Contabilidade",
          sales: "Vendas",
          purchasing: "Compras",
          marketing: "Marketing",
          production: "Produção",
          production_planning: "Planeamento da produção",
          quality_control: "Controlo de qualidade",
          maintenance: "Manutenção",
          warehouse: "Armazém",
          logistics: "Logística",
          procurement: "Aprovisionamento",
          engineering: "Engenharia",
          design: "Design",
          research_development: "Investigação e Desenvolvimento",
          it: "Informática",
          customer_service: "Apoio ao cliente",
          administration: "Administração",
          health_safety_environment: "Saúde, segurança e ambiente",
          security: "Segurança",
      },

      emptySearchTitle: "Sem resultados",
      emptySearchMessage: "Nenhum utilizador corresponde à sua pesquisa.",

      toolbar: {
        searchPlaceholder: "Pesquisar utilizadores...",
      },
    },
    employees: {
      title: "Funcionários",
      subtitle: "Gerencie os funcionários da sua empresa e as informações de RH.",
      addEmployee: "Adicionar funcionário",
      backToEmployees: "Voltar aos funcionários",
      editEmployee: "Editar funcionário",
      newEmployee: "Novo funcionário",
      employeeInformation: "Informações do funcionário",
      loadFailTitle: "Não foi possível carregar os funcionários",
      loadFailMessage: "Ocorreu um erro ao carregar os funcionários. Tente novamente.",
      loadCompaniesFailMessage: "Ocorreu um erro ao carregar as empresas. Tente novamente.",

      createTitle: "Adicionar funcionário",
      createSureMessage: "Tem certeza de que deseja criar este funcionário?",
      createSuccessTitle: "Funcionário criado",
      createSuccessMessage: "O funcionário foi criado com sucesso.",
      createFailTitle: "Não foi possível criar o funcionário",
      createFailMessage: "Ocorreu um erro ao criar o funcionário.",

      updateTitle: "Editar funcionário",
      updateSureMessage: "Tem certeza de que deseja salvar essas alterações?",
      updateSuccessTitle: "Funcionário atualizado",
      updateSuccessMessage: "O funcionário foi atualizado com sucesso.",
      updateFailTitle: "Não foi possível atualizar o funcionário",
      updateFailMessage: "Ocorreu um erro ao atualizar o funcionário.",

      deleteTitle: "Excluir funcionário",
      deleteSureMessage: "Tem certeza de que deseja excluir {name}? Esta ação não pode ser desfeita.",
      deleteSuccessTitle: "Funcionário excluído",
      deleteSuccessMessage: "O funcionário foi excluído.",
      deleteFailTitle: "Não foi possível excluir o funcionário",
      deleteFailMessage: "Ocorreu um erro ao excluir o funcionário.",

      selectCompanyRequired: "Selecione uma empresa.",
      invalidPhotoType: "Selecione um arquivo de imagem.",

      toolbar: {
        company: "Empresa",
        selectCompany: "Selecionar empresa",
        loadingCompanies: "Carregando empresas...",
        searchPlaceholder: "Pesquisar funcionários...",
      },

      companyInfo: {
        employeeCount_one: "{count} funcionário",
        employeeCount_other: "{count} funcionários",
      },

      emptyNoCompany: {
        title: "Nenhuma empresa encontrada",
        message: "Crie uma empresa antes de adicionar funcionários.",
      },

      emptyNoEmployees: {
        title: "Nenhum funcionário encontrado",
        messageSearch: "Nenhum funcionário corresponde à sua pesquisa.",
        messageDefault: "Esta empresa ainda não tem funcionários.",
        cta: "Adicionar funcionário",
      },

      loading: "Carregando funcionários...",

      photo: {
        label: "Foto do funcionário",
        choose: "Escolher foto",
        change: "Alterar foto",
        remove: "Remover",
      },

      company: {
        label: "Empresa",
        selectPlaceholder: "Selecionar empresa",
        unnamed: "Empresa sem nome",
      },

      sections: {
        personalInformation: "Informações pessoais",
        contactInformation: "Informações de contato",
        employment: "Emprego",
        identification: "Identificação",
        company: "Empresa",
        notes: "Notas",
      },

      fields: {
        employeeNumber: "Número do funcionário",
        employeeNumberPlaceholder: "EMP-001",

        firstName: "Nome",
        firstNamePlaceholder: "Nome",

        lastName: "Sobrenome",
        lastNamePlaceholder: "Sobrenome",

        firstNameArabic: "Nome (árabe)",
        firstNameArabicPlaceholder: "الاسم الأول",

        lastNameArabic: "Sobrenome (árabe)",
        lastNameArabicPlaceholder: "اسم العائلة",

        gender: "Gênero",
        genderPlaceholder: "Selecionar gênero",

        dateOfBirth: "Data de nascimento",

        placeOfBirth: "Local de nascimento",
        placeOfBirthPlaceholder: "Cidade",

        nationality: "Nacionalidade",
        nationalityPlaceholder: "Marroquina",

        maritalStatus: "Estado civil",
        maritalStatusPlaceholder: "Selecionar estado",

        numberOfDependents: "Dependentes",

        cin: "CIN",
        cinPlaceholder: "AB123456",

        passportNumber: "Número do passaporte",
        passportNumberPlaceholder: "Número do passaporte",

        passportExpiryDate: "Validade do passaporte",

        workPermitNumber: "Número da autorização de trabalho",
        workPermitNumberPlaceholder: "Número da autorização",

        workPermitExpiryDate: "Validade da autorização de trabalho",

        personalEmail: "E-mail pessoal",
        personalEmailPlaceholder: "pessoal@email.com",

        workEmail: "E-mail profissional",
        workEmailPlaceholder: "funcionario@empresa.com",

        phone: "Telefone",
        phonePlaceholder: "+212...",

        secondaryPhone: "Telefone secundário",
        secondaryPhonePlaceholder: "+212...",

        street: "Rua",
        streetPlaceholder: "Endereço",

        city: "Cidade",
        cityPlaceholder: "Cidade",

        region: "Região",
        regionPlaceholder: "Região",

        postalCode: "Código postal",
        postalCodePlaceholder: "40000",

        country: "País",
        countryPlaceholder: "Marrocos",

        emergencyName: "Contato de emergência",
        emergencyNamePlaceholder: "Nome completo",

        emergencyRelationship: "Parentesco",
        emergencyRelationshipPlaceholder: "Cônjuge, pai/mãe...",

        emergencyPhone: "Telefone de emergência",
        emergencyPhonePlaceholder: "+212...",

        emergencyEmail: "E-mail de emergência",
        emergencyEmailPlaceholder: "email@exemplo.com",

        hireDate: "Data de contratação",
        terminationDate: "Data de desligamento",

        employmentStatus: "Situação de emprego",
        employmentStatusPlaceholder: "Selecionar situação",

        employmentType: "Tipo de contrato",
        employmentTypePlaceholder: "Selecionar tipo",

        jobTitle: "Cargo",
        jobTitlePlaceholder: "Gerente de produção",

        department: "Departamento",
        departmentPlaceholder: "Produção",

        service: "Setor",
        servicePlaceholder: "Montagem",

        position: "Posição",
        positionPlaceholder: "Operador",

        workLocation: "Local de trabalho",
        workLocationPlaceholder: "Fábrica",

        cnssNumber: "Número da CNSS",
        cnssNumberPlaceholder: "Número da CNSS",

        cnssRegistrationDate: "Data de registro na CNSS",

        taxIdentificationNumber: "Número de identificação fiscal",
        taxIdentificationNumberPlaceholder: "NIF",

        taxStatus: "Situação fiscal",
        taxStatusPlaceholder: "Situação fiscal",

        numberOfChildren: "Número de filhos",

        spouseWorking: "Cônjuge trabalha",
        spouseWorkingCheckboxLabel: "O cônjuge trabalha atualmente",

        bankName: "Nome do banco",
        bankNamePlaceholder: "Banco",

        accountName: "Titular da conta",
        accountNamePlaceholder: "Titular da conta",

        rib: "RIB",
        ribPlaceholder: "RIB",

        iban: "IBAN",
        ibanPlaceholder: "IBAN",

        paymentMethod: "Forma de pagamento",
        paymentMethodPlaceholder: "Selecionar forma",

        notes: "Notas",
        notesPlaceholder: "Notas adicionais...",

        isActive: "Ativo",
        isActiveCheckboxLabel: "O funcionário está ativo",
      },

      genders: {
        male: "Masculino",
        female: "Feminino",
        other: "Outro",
      },

      maritalStatuses: {
        single: "Solteiro(a)",
        married: "Casado(a)",
        divorced: "Divorciado(a)",
        widowed: "Viúvo(a)",
        other: "Outro",
      },

      taxStatus: {
        taxable: "Tributável",
        nonTaxable: "Não tributável",
        exempt: "Isento",
      },

      statuses: {
        active: "Ativo",
        inactive: "Inativo",
        on_leave: "De licença",
        suspended: "Suspenso",
        terminated: "Contrato encerrado",
        unknown: "Desconhecido",
      },

      employmentTypes: {
        permanent: "Efetivo",
        fixed_term: "Prazo determinado",
        temporary: "Temporário",
        intern: "Estagiário",
        apprentice: "Aprendiz",
        freelance: "Freelancer",
        part_time: "Meio período",
        other: "Outro",
      },

      paymentMethods: {
        bank_transfer: "Transferência bancária",
        cash: "Dinheiro",
        check: "Cheque",
      },

      card: {
        view: "Ver",
        edit: "Editar",
      },

      detail: {
        employeeLabel: "Funcionário",
        firstName: "Nome",
        lastName: "Sobrenome",
        gender: "Gênero",
        dateOfBirth: "Data de nascimento",
        nationality: "Nacionalidade",
        maritalStatus: "Estado civil",
        phone: "Telefone",
        email: "E-mail",
        address: "Endereço",
        jobTitle: "Cargo",
        department: "Departamento",
        employmentType: "Tipo de contrato",
        hireDate: "Data de contratação",
        workLocation: "Local de trabalho",
        service: "Setor",
        cin: "CIN",
        passport: "Passaporte",
        cnssNumber: "Número da CNSS",
        taxId: "NIF",
        empty: "—",
      },

      buttons: {
        save: "Salvando...",
        createEmployee: "Criar funcionário",
        updateEmployee: "Atualizar funcionário",
        cancel: "Cancelar",
      },

      breadcrumbs: {
        hr: "RH",
        employees: "Funcionários",
        addEmployee: "Adicionar funcionário",
        editEmployee: "Editar funcionário",
      },

      errors: {
        companyRequired: "Selecione uma empresa.",
        invalidPhoto: "Selecione um arquivo de imagem.",
        fetchCompaniesFailed: "Falha ao buscar as empresas",
        fetchEmployeesFailed: "Falha ao buscar os funcionários",
        createFailed: "Falha ao criar o funcionário",
        updateFailed: "Falha ao atualizar o funcionário",
        deleteFailed: "Falha ao excluir o funcionário",
        notFound: "Funcionário não encontrado",
        duplicateEmployeeNumber: "Já existe um funcionário com este número",
        requiredFields: "Preencha todos os campos obrigatórios",
      },
    },
    salaries: {
      title: "Salários",
      subtitle: "Faça a gestão da remuneração e do histórico salarial dos funcionários.",
      addSalary: "Adicionar salário",
      giveRaise: "Atribuir aumento",

      createTitle: "Novo registo salarial",
      createSureMessage: "Tem a certeza de que deseja guardar este salário? O salário atual deste funcionário será encerrado a partir desta data de vigência.",
      createSuccessTitle: "Salário registado",
      createSuccessMessage: "O registo salarial foi criado com sucesso.",

      deleteTitle: "Eliminar registo salarial",
      deleteSureMessage: "Tem a certeza de que deseja eliminar este registo salarial? Esta ação não pode ser desfeita.",

      emptyTitle: "Sem salários",
      emptyMessage: "Esta empresa ainda não tem registos salariais.",

      fields: {
        employee: "Funcionário",
        employeeSearchPlaceholder: "Pesquisar por nome, número, CIN, CNSS...",
        baseSalary: "Salário base",
        effectiveDate: "Data de vigência",
        notes: "Notas",
        notesPlaceholder: "Motivo desta alteração, contexto adicional...",
      },

      table: {
        base: "Base",
        gross: "Bruto",
        net: "Líquido",
        endDate: "Data de fim",
        status: "Estado",
        ongoing: "Em curso",
      },

      actions: {
        history: "Ver histórico",
      },

      history: {
        titleFor: "Histórico salarial — {name}",
        empty: "Sem histórico salarial para este funcionário.",
        current: "Atual",
        past: "Anterior",
      },

      breadcrumbs: {
        hr: "RH",
        salaries: "Salários",
      },

      buttons: {
        create: "Guardar salário",
      },

      errors: {
        fetchFailed: "Falha ao carregar os salários",
        actionFailed: "Ocorreu um erro. Tente novamente.",
      },
    },
    absences: {
      title: "Ausências",
      subtitle: "Reveja e faça a gestão dos pedidos de férias e ausência.",
      addAbsence: "Novo pedido de ausência",

      createTitle: "Novo pedido de ausência",
      createSureMessage: "Tem a certeza de que deseja submeter este pedido de ausência?",
      createSuccessTitle: "Pedido submetido",
      createSuccessMessage: "O pedido de ausência foi submetido com sucesso.",

      acceptTitle: "Aceitar ausência",
      acceptSureMessage: "Tem a certeza de que deseja aceitar este pedido de ausência?",

      rejectTitle: "Rejeitar ausência",
      rejectSureMessage: "Tem a certeza de que deseja rejeitar este pedido de ausência?",

      deleteTitle: "Eliminar ausência",
      deleteSureMessage: "Tem a certeza de que deseja eliminar este registo de ausência? Esta ação não pode ser desfeita.",

      emptyTitle: "Sem ausências",
      emptyMessage: "Nenhum pedido de ausência corresponde aos seus filtros.",

      unjustified: "Não justificada",

      fields: {
        employee: "Funcionário",
        employeeSearchPlaceholder: "Pesquisar por nome, número, CIN, CNSS...",
        type: "Tipo",
        startDate: "Data de início",
        endDate: "Data de fim",
        halfDay: "Meio dia",
        justified: "Justificada",
        reason: "Motivo",
        reasonPlaceholder: "Motivo ou contexto adicional...",
        status: "Estado",
      },

      types: {
        paid_leave: "Férias pagas",
        unpaid_leave: "Licença sem vencimento",
        sick_leave: "Baixa médica",
        absence: "Ausência",
        other: "Outro",
      },

      status: {
        pending: "Pendente",
        accepted: "Aceite",
        rejected: "Rejeitada",
      },

      filters: {
        allStatuses: "Todos os estados",
        allTypes: "Todos os tipos",
      },

      table: {
        period: "Período",
        days: "Dias",
      },

      actions: {
        accept: "Aceitar",
        reject: "Rejeitar",
      },

      breadcrumbs: {
        hr: "RH",
        absences: "Ausências",
      },

      buttons: {
        create: "Submeter pedido",
      },

      errors: {
        fetchFailed: "Falha ao carregar as ausências",
        actionFailed: "Ocorreu um erro. Tente novamente.",
      },
    },
    advances: {
      title: "Adiantamentos",
      subtitle: "Reveja e faça a gestão dos pedidos de adiantamento salarial.",
      addAdvance: "Novo pedido de adiantamento",

      createTitle: "Novo pedido de adiantamento",
      createSureMessage: "Tem a certeza de que deseja submeter este pedido de adiantamento?",
      createSuccessTitle: "Pedido submetido",
      createSuccessMessage: "O pedido de adiantamento foi submetido com sucesso.",

      acceptTitle: "Aceitar adiantamento",
      acceptSureMessage: "Tem a certeza de que deseja aceitar este pedido de adiantamento?",

      rejectTitle: "Rejeitar adiantamento",
      rejectSureMessage: "Tem a certeza de que deseja rejeitar este pedido de adiantamento?",

      markRepaidTitle: "Marcar como reembolsado",
      markRepaidSureMessage: "Tem a certeza de que deseja marcar este adiantamento como totalmente reembolsado?",

      deleteTitle: "Eliminar adiantamento",
      deleteSureMessage: "Tem a certeza de que deseja eliminar este registo de adiantamento? Esta ação não pode ser desfeita.",

      emptyTitle: "Sem adiantamentos",
      emptyMessage: "Nenhum pedido de adiantamento corresponde aos seus filtros.",

      fields: {
        employee: "Funcionário",
        employeeSearchPlaceholder: "Pesquisar por nome, número, CIN, CNSS...",
        amount: "Montante",
        requestDate: "Data do pedido",
        reason: "Motivo",
        reasonPlaceholder: "Motivo ou contexto adicional...",
        status: "Estado",
      },

      status: {
        pending: "Pendente",
        accepted: "Aceite",
        rejected: "Rejeitado",
      },

      filters: {
        allStatuses: "Todos os estados",
      },

      table: {
        remaining: "Restante",
        fullyRepaid: "Totalmente reembolsado",
      },

      actions: {
        accept: "Aceitar",
        reject: "Rejeitar",
        markRepaid: "Marcar como reembolsado",
      },

      breadcrumbs: {
        hr: "RH",
        advances: "Adiantamentos",
      },

      buttons: {
        create: "Submeter pedido",
      },

      errors: {
        fetchFailed: "Falha ao carregar os adiantamentos",
        actionFailed: "Ocorreu um erro. Tente novamente.",
      },
    },
  },

  // ======================================================
  // GERMAN
  // ======================================================

  de: {
    sidebar: {
      admin: "Verwaltung",
      settings: "Einstellungen",
      help: "Hilfe und Support",
      profile: "Profil",
      hr: "Personalwesen",

      companies: "Unternehmen",
      organization: "Organisation",
      company: "Unternehmen",
      employees: "Mitarbeiter",
      salaries: "Gehälter",
      absences: "Abwesenheiten",
      advances: "Vorschüsse",
      users: "Benutzer",
      departments: "Abteilungen",
      jobPositions: "Positionen",
      rolesPermissions: "Rollen und Berechtigungen",
      locations: "Standorte",
      documents: "Dokumente",
      preferences: "Einstellungen",
      integrations: "Integrationen",

      dark: "Dunkel",
      light: "Hell",

      logout: "Abmelden",

      closeSidebar:
        "Seitenleiste schließen",

      openSidebar:
        "Seitenleiste öffnen",

      switchTheme:
        "Zu {theme}-Modus wechseln",

      dashboard:
        "Dashboard",
    },

    common: {
      welcome: "Willkommen",
      goodbye: "Auf Wiedersehen",
      loading: "Wird geladen...",
      error: "Fehler",
      fail: "Fehlgeschlagen",
      success: "Erfolg",
      update: "Aktualisieren",
      cancel: "Abbrechen",
      delete: "Löschen",
      confirm: "Bestätigen",
      close: "Schließen",
      edit: "Bearbeiten",
      reset: "Zurücksetzen",
      create: "Erstellen",
      noResults: "Keine Ergebnisse gefunden",
    },

    profile: {
      settings: "Einstellungen",

      firstName: "Vorname",
      lastName: "Nachname",
      email: "E-Mail",
      password: "Passwort",

      currentPassword: "Aktuelles Passwort",
      newPassword: "Neues Passwort",

      updateSureMessage:
        "Möchten Sie Ihr Profil wirklich aktualisieren?",

      updateFailMessage:
        "Ihr Profil konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",

      updateSuccessMessage:
        "Ihr Profil wurde erfolgreich aktualisiert.",

      bothPasswords:
        "Aktuelles und neues Passwort sind erforderlich.",

      info: "Informationen",
    },

    company: {
      title:
        "Unternehmen",

      subtitle:
        "Unternehmensinformationen verwalten",

      emptySubtitle:
        "Noch kein Unternehmen eingerichtet",

      emptyTitle:
        "Kein Unternehmen",

      emptyMessage:
        "Richten Sie Ihr Unternehmensprofil ein, um zu beginnen.",

      create:
        "Unternehmen erstellen",

      editTitle:
        "Unternehmen bearbeiten",

      name:
        "Unternehmensname",

      tradeName:
        "Handelsname",

      legalForm:
        "Rechtsform",

      industry:
        "Branche",

      ice:
        "ICE",

      taxId:
        "Steuer-ID",

      registrationNumber:
        "Handelsregisternummer",

      email:
        "E-Mail",

      phone:
        "Telefon",

      website:
        "Website",

      street:
        "Straße",

      city:
        "Stadt",

      postalCode:
        "Postleitzahl",

      logo:
        "Unternehmenslogo",

      employeeCount:
        "Mitarbeiter",

      section: {
        identity:
          "Identität",

        legal:
          "Rechtliche Informationen",

        contact:
          "Kontakt",
      },

      createTitle:
        "Unternehmen erstellen",

      createSureMessage:
        "Möchten Sie dieses Unternehmen wirklich erstellen?",

      createSuccessTitle:
        "Unternehmen erstellt",

      createSuccessMessage:
        "Das Unternehmen wurde erfolgreich erstellt.",

      createFailTitle:
        "Erstellung fehlgeschlagen",

      updateSureMessage:
        "Möchten Sie diese Änderungen wirklich speichern?",

      updateSuccessMessage:
        "Das Unternehmen wurde erfolgreich aktualisiert.",

      saveFailMessage:
        "Beim Speichern des Unternehmens ist ein Fehler aufgetreten.",

      loadFailTitle:
        "Laden fehlgeschlagen",

      loadFailMessage:
        "Die Unternehmensinformationen konnten nicht geladen werden.",

      deleteCompany:
        "Unternehmen löschen",

      deleteTitle:
        "Unternehmen löschen",

      deleteSureMessage:
        "Möchten Sie dieses Unternehmen wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",

      deleteSuccessTitle:
        "Unternehmen gelöscht",

      deleteSuccessMessage:
        "Das Unternehmen wurde erfolgreich gelöscht.",

      deleteFailTitle:
        "Löschen fehlgeschlagen",

      deleteFailMessage:
        "Beim Löschen des Unternehmens ist ein Fehler aufgetreten.",

      errors: {
        deleteAdminOnly:
          "Nur Administratoren oder der Eigentümer des Unternehmens können es löschen.",

        notFound:
          "Unternehmen nicht gefunden.",

        deleteNotAuthorized:
          "Sie sind nicht berechtigt, dieses Unternehmen zu löschen.",

        updateNotAuthorized:
          "Sie sind nicht berechtigt, dieses Unternehmen zu aktualisieren.",

        viewNotAuthorized:
          "Sie sind nicht berechtigt, dieses Unternehmen anzuzeigen.",

        duplicateCompany:
          "Ein Unternehmen mit dieser ICE, Steuer-ID, Registrierungsnummer oder CNSS-Nummer existiert bereits.",

        createFailed:
          "Fehler beim Erstellen des Unternehmens.",

        updateFailed:
          "Fehler beim Aktualisieren des Unternehmens.",

        deleteFailed:
          "Fehler beim Löschen des Unternehmens.",

        logoNotFound:
          "Unternehmenslogo nicht gefunden.",

        logoRequired:
          "Bitte wählen Sie ein Logo aus.",

        logoUploadFailed:
          "Fehler beim Hochladen des Logos.",

        logoDeleteFailed:
          "Fehler beim Löschen des Logos.",
      },
    },

    users: {
      title:
        "Benutzer",

      subtitle:
        "Benutzerkonten und Zugriffe verwalten.",

      addUser:
        "Benutzer hinzufügen",

      newUser:
        "Neuer Benutzer",

      createSubtitle:
        "Ein neues Benutzerkonto erstellen.",

      information:
        "Benutzerinformationen",

      role:
        "Rolle",

      status:
        "Status",

      userId:
        "Benutzer-ID",

      roles: {
        admin:
          "Administrator",

        owner:
          "Eigentümer",

        user:
          "Benutzer",
      },

      statuses: {
        active:
          "Aktiv",

        inactive:
          "Inaktiv",

        suspended:
          "Gesperrt",
      },

      emptyTitle:
        "Keine Benutzer",

      emptyMessage:
        "Derzeit gibt es keine Benutzer in Ihrer Organisation.",

      backToUsers:
        "Benutzer",

      createTitle:
        "Benutzer erstellen",

      createSureMessage:
        "Möchten Sie diesen Benutzer wirklich erstellen?",

      createSuccessTitle:
        "Benutzer erstellt",

      createSuccessMessage:
        "Der Benutzer wurde erfolgreich erstellt.",

      createFailTitle:
        "Erstellung fehlgeschlagen",

      createFailMessage:
        "Der Benutzer konnte nicht erstellt werden.",

      loadFailTitle:
        "Laden fehlgeschlagen",

      loadFailMessage:
        "Die Benutzer konnten nicht geladen werden. Bitte versuchen Sie es erneut.",

      deleteUser:
        "Benutzer löschen",

      deleteTitle:
        "Benutzer löschen",

      deleteSureMessage:
        "Möchten Sie diesen Benutzer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",

      deleteSuccessTitle:
        "Benutzer gelöscht",

      deleteSuccessMessage:
        "Der Benutzer wurde erfolgreich gelöscht.",

      deleteFailTitle:
        "Löschen fehlgeschlagen",

      deleteFailMessage:
        "Beim Löschen des Benutzers ist ein Fehler aufgetreten.",

      errors: {
        deleteAdminOnly:
          "Nur Administratoren können Benutzer löschen.",

        notFound:
          "Benutzer nicht gefunden.",

        updateNotAuthorized:
          "Sie sind nicht berechtigt, diesen Benutzer zu aktualisieren.",

        passwordNotAuthorized:
          "Sie sind nicht berechtigt, dieses Passwort zu ändern.",

        requiredCreateFields:
          "Bitte geben Sie Vorname, Nachname, E-Mail und Passwort an.",

        requiredUpdateFields:
          "Bitte geben Sie Vorname, Nachname und E-Mail an.",

        requiredPasswordFields:
          "Bitte geben Sie das aktuelle und das neue Passwort an.",

        emailExists:
          "Ein Benutzer mit dieser E-Mail existiert bereits.",

        currentPasswordIncorrect:
          "Das aktuelle Passwort ist falsch.",
      },

      editUser: "Benutzer bearbeiten",
      editSubtitle: "Aktualisieren Sie die Kontoinformationen dieses Benutzers.",

      updateTitle: "Benutzer bearbeiten",
      updateSureMessage: "Möchten Sie diese Änderungen wirklich speichern?",

      updateSuccessTitle: "Benutzer aktualisiert",
      updateSuccessMessage: "Der Benutzer wurde erfolgreich aktualisiert.",

      updateFailTitle: "Aktualisierung fehlgeschlagen",
      updateFailMessage: "Der Benutzer konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",

      department: "Abteilung",
      departments: {
          management: "Geschäftsleitung",
          hr: "Personalwesen",
          finance: "Finanzen",
          accounting: "Buchhaltung",
          sales: "Vertrieb",
          purchasing: "Einkauf",
          marketing: "Marketing",
          production: "Produktion",
          production_planning: "Produktionsplanung",
          quality_control: "Qualitätskontrolle",
          maintenance: "Instandhaltung",
          warehouse: "Lager",
          logistics: "Logistik",
          procurement: "Beschaffung",
          engineering: "Technik",
          design: "Design",
          research_development: "Forschung & Entwicklung",
          it: "IT",
          customer_service: "Kundenservice",
          administration: "Verwaltung",
          health_safety_environment: "Arbeitsschutz & Umwelt",
          security: "Sicherheit",
      },

      emptySearchTitle: "Keine Ergebnisse",
      emptySearchMessage: "Kein Benutzer entspricht Ihrer Suche.",

      toolbar: {
        searchPlaceholder: "Benutzer suchen...",
      },
    },
    employees: {
      title: "Mitarbeiter",
      subtitle: "Verwalten Sie die Mitarbeiter Ihres Unternehmens und deren Personaldaten.",
      addEmployee: "Mitarbeiter hinzufügen",
      backToEmployees: "Zurück zu den Mitarbeitern",
      editEmployee: "Mitarbeiter bearbeiten",
      newEmployee: "Neuer Mitarbeiter",
      employeeInformation: "Mitarbeiterinformationen",
      loadFailTitle: "Mitarbeiter konnten nicht geladen werden",
      loadFailMessage: "Beim Laden der Mitarbeiter ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
      loadCompaniesFailMessage: "Beim Laden der Unternehmen ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",

      createTitle: "Mitarbeiter hinzufügen",
      createSureMessage: "Möchten Sie diesen Mitarbeiter wirklich anlegen?",
      createSuccessTitle: "Mitarbeiter angelegt",
      createSuccessMessage: "Der Mitarbeiter wurde erfolgreich angelegt.",
      createFailTitle: "Mitarbeiter konnte nicht angelegt werden",
      createFailMessage: "Beim Anlegen des Mitarbeiters ist ein Fehler aufgetreten.",

      updateTitle: "Mitarbeiter bearbeiten",
      updateSureMessage: "Möchten Sie diese Änderungen wirklich speichern?",
      updateSuccessTitle: "Mitarbeiter aktualisiert",
      updateSuccessMessage: "Der Mitarbeiter wurde erfolgreich aktualisiert.",
      updateFailTitle: "Mitarbeiter konnte nicht aktualisiert werden",
      updateFailMessage: "Beim Aktualisieren des Mitarbeiters ist ein Fehler aufgetreten.",

      deleteTitle: "Mitarbeiter löschen",
      deleteSureMessage: "Möchten Sie {name} wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
      deleteSuccessTitle: "Mitarbeiter gelöscht",
      deleteSuccessMessage: "Der Mitarbeiter wurde gelöscht.",
      deleteFailTitle: "Mitarbeiter konnte nicht gelöscht werden",
      deleteFailMessage: "Beim Löschen des Mitarbeiters ist ein Fehler aufgetreten.",

      selectCompanyRequired: "Bitte wählen Sie ein Unternehmen aus.",
      invalidPhotoType: "Bitte wählen Sie eine Bilddatei aus.",

      toolbar: {
        company: "Unternehmen",
        selectCompany: "Unternehmen auswählen",
        loadingCompanies: "Unternehmen werden geladen...",
        searchPlaceholder: "Mitarbeiter suchen...",
      },

      companyInfo: {
        employeeCount_one: "{count} Mitarbeiter",
        employeeCount_other: "{count} Mitarbeiter",
      },

      emptyNoCompany: {
        title: "Keine Unternehmen gefunden",
        message: "Legen Sie zuerst ein Unternehmen an, bevor Sie Mitarbeiter hinzufügen.",
      },

      emptyNoEmployees: {
        title: "Keine Mitarbeiter gefunden",
        messageSearch: "Kein Mitarbeiter entspricht Ihrer Suche.",
        messageDefault: "Dieses Unternehmen hat noch keine Mitarbeiter.",
        cta: "Mitarbeiter hinzufügen",
      },

      loading: "Mitarbeiter werden geladen...",

      photo: {
        label: "Mitarbeiterfoto",
        choose: "Foto auswählen",
        change: "Foto ändern",
        remove: "Entfernen",
      },

      company: {
        label: "Unternehmen",
        selectPlaceholder: "Unternehmen auswählen",
        unnamed: "Unbenanntes Unternehmen",
      },

      sections: {
        personalInformation: "Persönliche Angaben",
        contactInformation: "Kontaktinformationen",
        employment: "Beschäftigung",
        identification: "Identifikation",
        company: "Unternehmen",
        notes: "Notizen",
      },

      fields: {
        employeeNumber: "Personalnummer",
        employeeNumberPlaceholder: "EMP-001",

        firstName: "Vorname",
        firstNamePlaceholder: "Vorname",

        lastName: "Nachname",
        lastNamePlaceholder: "Nachname",

        firstNameArabic: "Vorname (Arabisch)",
        firstNameArabicPlaceholder: "الاسم الأول",

        lastNameArabic: "Nachname (Arabisch)",
        lastNameArabicPlaceholder: "اسم العائلة",

        gender: "Geschlecht",
        genderPlaceholder: "Geschlecht auswählen",

        dateOfBirth: "Geburtsdatum",

        placeOfBirth: "Geburtsort",
        placeOfBirthPlaceholder: "Stadt",

        nationality: "Staatsangehörigkeit",
        nationalityPlaceholder: "Marokkanisch",

        maritalStatus: "Familienstand",
        maritalStatusPlaceholder: "Status auswählen",

        numberOfDependents: "Unterhaltsberechtigte",

        cin: "CIN",
        cinPlaceholder: "AB123456",

        passportNumber: "Passnummer",
        passportNumberPlaceholder: "Passnummer",

        passportExpiryDate: "Ablauf des Reisepasses",

        workPermitNumber: "Arbeitserlaubnisnummer",
        workPermitNumberPlaceholder: "Erlaubnisnummer",

        workPermitExpiryDate: "Ablauf der Arbeitserlaubnis",

        personalEmail: "Private E-Mail",
        personalEmailPlaceholder: "privat@email.com",

        workEmail: "Geschäftliche E-Mail",
        workEmailPlaceholder: "mitarbeiter@unternehmen.com",

        phone: "Telefon",
        phonePlaceholder: "+212...",

        secondaryPhone: "Zweite Telefonnummer",
        secondaryPhonePlaceholder: "+212...",

        street: "Straße",
        streetPlaceholder: "Adresse",

        city: "Stadt",
        cityPlaceholder: "Stadt",

        region: "Region",
        regionPlaceholder: "Region",

        postalCode: "Postleitzahl",
        postalCodePlaceholder: "40000",

        country: "Land",
        countryPlaceholder: "Marokko",

        emergencyName: "Notfallkontakt",
        emergencyNamePlaceholder: "Vollständiger Name",

        emergencyRelationship: "Beziehung",
        emergencyRelationshipPlaceholder: "Ehepartner, Elternteil...",

        emergencyPhone: "Notfalltelefon",
        emergencyPhonePlaceholder: "+212...",

        emergencyEmail: "Notfall-E-Mail",
        emergencyEmailPlaceholder: "email@beispiel.com",

        hireDate: "Einstellungsdatum",
        terminationDate: "Austrittsdatum",

        employmentStatus: "Beschäftigungsstatus",
        employmentStatusPlaceholder: "Status auswählen",

        employmentType: "Vertragsart",
        employmentTypePlaceholder: "Art auswählen",

        jobTitle: "Berufsbezeichnung",
        jobTitlePlaceholder: "Produktionsleiter",

        department: "Abteilung",
        departmentPlaceholder: "Produktion",

        service: "Bereich",
        servicePlaceholder: "Montage",

        position: "Position",
        positionPlaceholder: "Bediener",

        workLocation: "Arbeitsort",
        workLocationPlaceholder: "Fabrik",

        cnssNumber: "CNSS-Nummer",
        cnssNumberPlaceholder: "CNSS-Nummer",

        cnssRegistrationDate: "CNSS-Registrierungsdatum",

        taxIdentificationNumber: "Steueridentifikationsnummer",
        taxIdentificationNumberPlaceholder: "Steuer-ID",

        taxStatus: "Steuerstatus",
        taxStatusPlaceholder: "Steuerstatus",

        numberOfChildren: "Anzahl der Kinder",

        spouseWorking: "Ehepartner berufstätig",
        spouseWorkingCheckboxLabel: "Der Ehepartner ist derzeit berufstätig",

        bankName: "Bankname",
        bankNamePlaceholder: "Bank",

        accountName: "Kontoinhaber",
        accountNamePlaceholder: "Kontoinhaber",

        rib: "RIB",
        ribPlaceholder: "RIB",

        iban: "IBAN",
        ibanPlaceholder: "IBAN",

        paymentMethod: "Zahlungsmethode",
        paymentMethodPlaceholder: "Methode auswählen",

        notes: "Notizen",
        notesPlaceholder: "Zusätzliche Notizen...",

        isActive: "Aktiv",
        isActiveCheckboxLabel: "Der Mitarbeiter ist aktiv",
      },

      genders: {
        male: "Männlich",
        female: "Weiblich",
        other: "Divers",
      },

      maritalStatuses: {
        single: "Ledig",
        married: "Verheiratet",
        divorced: "Geschieden",
        widowed: "Verwitwet",
        other: "Sonstiges",
      },

      taxStatus: {
        taxable: "Steuerpflichtig",
        nonTaxable: "Nicht steuerpflichtig",
        exempt: "Befreit",
      },

      statuses: {
        active: "Aktiv",
        inactive: "Inaktiv",
        on_leave: "Beurlaubt",
        suspended: "Suspendiert",
        terminated: "Vertrag beendet",
        unknown: "Unbekannt",
      },

      employmentTypes: {
        permanent: "Unbefristet",
        fixed_term: "Befristet",
        temporary: "Vorübergehend",
        intern: "Praktikant",
        apprentice: "Auszubildender",
        freelance: "Freiberuflich",
        part_time: "Teilzeit",
        other: "Sonstiges",
      },

      paymentMethods: {
        bank_transfer: "Banküberweisung",
        cash: "Bar",
        check: "Scheck",
      },

      card: {
        view: "Anzeigen",
        edit: "Bearbeiten",
      },

      detail: {
        employeeLabel: "Mitarbeiter",
        firstName: "Vorname",
        lastName: "Nachname",
        gender: "Geschlecht",
        dateOfBirth: "Geburtsdatum",
        nationality: "Staatsangehörigkeit",
        maritalStatus: "Familienstand",
        phone: "Telefon",
        email: "E-Mail",
        address: "Adresse",
        jobTitle: "Berufsbezeichnung",
        department: "Abteilung",
        employmentType: "Vertragsart",
        hireDate: "Einstellungsdatum",
        workLocation: "Arbeitsort",
        service: "Bereich",
        cin: "CIN",
        passport: "Reisepass",
        cnssNumber: "CNSS-Nummer",
        taxId: "Steuer-ID",
        empty: "—",
      },

      buttons: {
        save: "Wird gespeichert...",
        createEmployee: "Mitarbeiter anlegen",
        updateEmployee: "Mitarbeiter aktualisieren",
        cancel: "Abbrechen",
      },

      breadcrumbs: {
        hr: "Personal",
        employees: "Mitarbeiter",
        addEmployee: "Mitarbeiter hinzufügen",
        editEmployee: "Mitarbeiter bearbeiten",
      },

      errors: {
        companyRequired: "Bitte wählen Sie ein Unternehmen aus.",
        invalidPhoto: "Bitte wählen Sie eine Bilddatei aus.",
        fetchCompaniesFailed: "Unternehmen konnten nicht abgerufen werden",
        fetchEmployeesFailed: "Mitarbeiter konnten nicht abgerufen werden",
        createFailed: "Mitarbeiter konnte nicht angelegt werden",
        updateFailed: "Mitarbeiter konnte nicht aktualisiert werden",
        deleteFailed: "Mitarbeiter konnte nicht gelöscht werden",
        notFound: "Mitarbeiter nicht gefunden",
        duplicateEmployeeNumber: "Ein Mitarbeiter mit dieser Nummer existiert bereits",
        requiredFields: "Bitte füllen Sie alle Pflichtfelder aus",
      },
    },
    salaries: {
      title: "Gehälter",
      subtitle: "Verwalten Sie die Vergütung und Gehaltshistorie der Mitarbeiter.",
      addSalary: "Gehalt hinzufügen",
      giveRaise: "Gehaltserhöhung gewähren",

      createTitle: "Neuer Gehaltseintrag",
      createSureMessage: "Möchten Sie dieses Gehalt wirklich speichern? Das aktuelle Gehalt dieses Mitarbeiters wird zu diesem Stichtag beendet.",
      createSuccessTitle: "Gehalt gespeichert",
      createSuccessMessage: "Der Gehaltseintrag wurde erfolgreich angelegt.",

      deleteTitle: "Gehaltseintrag löschen",
      deleteSureMessage: "Möchten Sie diesen Gehaltseintrag wirklich löschen? Dies kann nicht rückgängig gemacht werden.",

      emptyTitle: "Keine Gehälter",
      emptyMessage: "Für dieses Unternehmen gibt es noch keine Gehaltseinträge.",

      fields: {
        employee: "Mitarbeiter",
        employeeSearchPlaceholder: "Suche nach Name, Nummer, CIN, CNSS...",
        baseSalary: "Grundgehalt",
        effectiveDate: "Stichtag",
        notes: "Notizen",
        notesPlaceholder: "Grund für diese Änderung, zusätzlicher Kontext...",
      },

      table: {
        base: "Grundgehalt",
        gross: "Brutto",
        net: "Netto",
        endDate: "Enddatum",
        status: "Status",
        ongoing: "Laufend",
      },

      actions: {
        history: "Verlauf anzeigen",
      },

      history: {
        titleFor: "Gehaltsverlauf — {name}",
        empty: "Kein Gehaltsverlauf für diesen Mitarbeiter.",
        current: "Aktuell",
        past: "Vergangen",
      },

      breadcrumbs: {
        hr: "Personal",
        salaries: "Gehälter",
      },

      buttons: {
        create: "Gehalt speichern",
      },

      errors: {
        fetchFailed: "Gehälter konnten nicht geladen werden",
        actionFailed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      },
    },
    absences: {
      title: "Abwesenheiten",
      subtitle: "Prüfen und verwalten Sie Urlaubs- und Abwesenheitsanträge.",
      addAbsence: "Neuer Abwesenheitsantrag",

      createTitle: "Neuer Abwesenheitsantrag",
      createSureMessage: "Möchten Sie diesen Abwesenheitsantrag wirklich einreichen?",
      createSuccessTitle: "Antrag eingereicht",
      createSuccessMessage: "Der Abwesenheitsantrag wurde erfolgreich eingereicht.",

      acceptTitle: "Abwesenheit genehmigen",
      acceptSureMessage: "Möchten Sie diesen Abwesenheitsantrag wirklich genehmigen?",

      rejectTitle: "Abwesenheit ablehnen",
      rejectSureMessage: "Möchten Sie diesen Abwesenheitsantrag wirklich ablehnen?",

      deleteTitle: "Abwesenheit löschen",
      deleteSureMessage: "Möchten Sie diesen Abwesenheitseintrag wirklich löschen? Dies kann nicht rückgängig gemacht werden.",

      emptyTitle: "Keine Abwesenheiten",
      emptyMessage: "Kein Abwesenheitsantrag entspricht Ihren Filtern.",

      unjustified: "Unentschuldigt",

      fields: {
        employee: "Mitarbeiter",
        employeeSearchPlaceholder: "Suche nach Name, Nummer, CIN, CNSS...",
        type: "Art",
        startDate: "Startdatum",
        endDate: "Enddatum",
        halfDay: "Halber Tag",
        justified: "Entschuldigt",
        reason: "Grund",
        reasonPlaceholder: "Grund oder zusätzlicher Kontext...",
        status: "Status",
      },

      types: {
        paid_leave: "Bezahlter Urlaub",
        unpaid_leave: "Unbezahlter Urlaub",
        sick_leave: "Krankheitsurlaub",
        absence: "Abwesenheit",
        other: "Sonstiges",
      },

      status: {
        pending: "Ausstehend",
        accepted: "Genehmigt",
        rejected: "Abgelehnt",
      },

      filters: {
        allStatuses: "Alle Status",
        allTypes: "Alle Arten",
      },

      table: {
        period: "Zeitraum",
        days: "Tage",
      },

      actions: {
        accept: "Genehmigen",
        reject: "Ablehnen",
      },

      breadcrumbs: {
        hr: "Personal",
        absences: "Abwesenheiten",
      },

      buttons: {
        create: "Antrag einreichen",
      },

      errors: {
        fetchFailed: "Abwesenheiten konnten nicht geladen werden",
        actionFailed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      },
    },
    advances: {
      title: "Vorschüsse",
      subtitle: "Prüfen und verwalten Sie Gehaltsvorschussanträge.",
      addAdvance: "Neuer Vorschussantrag",

      createTitle: "Neuer Vorschussantrag",
      createSureMessage: "Möchten Sie diesen Vorschussantrag wirklich einreichen?",
      createSuccessTitle: "Antrag eingereicht",
      createSuccessMessage: "Der Vorschussantrag wurde erfolgreich eingereicht.",

      acceptTitle: "Vorschuss genehmigen",
      acceptSureMessage: "Möchten Sie diesen Vorschussantrag wirklich genehmigen?",

      rejectTitle: "Vorschuss ablehnen",
      rejectSureMessage: "Möchten Sie diesen Vorschussantrag wirklich ablehnen?",

      markRepaidTitle: "Als zurückgezahlt markieren",
      markRepaidSureMessage: "Möchten Sie diesen Vorschuss wirklich als vollständig zurückgezahlt markieren?",

      deleteTitle: "Vorschuss löschen",
      deleteSureMessage: "Möchten Sie diesen Vorschusseintrag wirklich löschen? Dies kann nicht rückgängig gemacht werden.",

      emptyTitle: "Keine Vorschüsse",
      emptyMessage: "Kein Vorschussantrag entspricht Ihren Filtern.",

      fields: {
        employee: "Mitarbeiter",
        employeeSearchPlaceholder: "Suche nach Name, Nummer, CIN, CNSS...",
        amount: "Betrag",
        requestDate: "Antragsdatum",
        reason: "Grund",
        reasonPlaceholder: "Grund oder zusätzlicher Kontext...",
        status: "Status",
      },

      status: {
        pending: "Ausstehend",
        accepted: "Genehmigt",
        rejected: "Abgelehnt",
      },

      filters: {
        allStatuses: "Alle Status",
      },

      table: {
        remaining: "Verbleibend",
        fullyRepaid: "Vollständig zurückgezahlt",
      },

      actions: {
        accept: "Genehmigen",
        reject: "Ablehnen",
        markRepaid: "Als zurückgezahlt markieren",
      },

      breadcrumbs: {
        hr: "Personal",
        advances: "Vorschüsse",
      },

      buttons: {
        create: "Antrag einreichen",
      },

      errors: {
        fetchFailed: "Vorschüsse konnten nicht geladen werden",
        actionFailed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      },
    },
  },
};

// ======================================================
// SUPPORTED LANGUAGES
// ======================================================

export const SUPPORTED_LANGUAGES = [
  "en",
  "fr",
  "ar",
  "es",
  "pt",
  "de",
];

// ======================================================
// GET DEFAULT LANGUAGE
// ======================================================

export const getDefaultLanguage = () => {
  // Check localStorage first

  const stored =
    localStorage.getItem("language");

  if (
    stored &&
    SUPPORTED_LANGUAGES.includes(stored)
  ) {
    return stored;
  }

  // Check browser language

  const browserLang =
    navigator.language.split("-")[0];

  if (
    SUPPORTED_LANGUAGES.includes(
      browserLang
    )
  ) {
    return browserLang;
  }

  // Default to English

  return "en";
};
