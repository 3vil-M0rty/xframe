// ======================================================
// i18n Configuration
// ======================================================

export const translations = {
  // ======================================================
  // ENGLISH
  // ======================================================

  en: { platform: { rename: "Rename the client", title: "Clients", subtitle: "Every client of the platform, with its companies and accounts. You see counts only — never a client's HR or purchasing data.", new: "New client", create: "Create the client", details: "Details", created: "Client \"{name}\" created. Its admin can log in now with {email} and the password you set.", firstAdmin: "First admin account", firstAdminHint: "The client's administrator: creates the companies, departments, employees and accounts. Give them the password over a secure channel; they can change it in their profile.", fields: { name: "Client name", namePlaceholder: "e.g. Atlas Group", notes: "Notes (internal)", firstName: "First name", lastName: "Last name", email: "Email", password: "Temporary password", passwordHint: "At least 8 characters.", }, columns: { client: "Client", companies: "Companies", accounts: "Accounts", employees: "Employees", status: "Status", created: "Created", }, status: { active: "Active", suspended: "Suspended", }, suspend: "Suspend", reactivate: "Reactivate", suspendTitle: "Suspend this client?", suspendMessage: "Every account of \"{name}\" will be logged out and blocked, including open sessions. Nothing is deleted; you can reactivate it at any time.", reactivateTitle: "Reactivate this client?", reactivateMessage: "The accounts of \"{name}\" will be able to log in again.", suspendedNotice: "\"{name}\" is suspended.", reactivatedNotice: "\"{name}\" is active again.", admins: "Admin accounts", addAdmin: "Add an admin", noAdmins: "No admin account.", adminAdded: "Admin account {email} created.", roles: { admin: "Admin", owner: "Owner", }, privacyNote: "Client isolation: this page only shows accounts that administer the client. Its employees, payroll, documents and purchasing stay visible to the client only.", emptyTitle: "No client yet", emptyMessage: "Create the first client and its admin account.", orphans: { title: "Records not attached to any client", hint: "Created before client isolation and not attached automatically. Until attached, nobody can see them. Choose the client they belong to.", companies: "Companies", users: "Accounts", chooseClient: "Choose a client", assign: "Attach to this client", done: "{companies} company(ies) and {users} account(s) attached.", }, errors: { load: "Couldn't load the clients.", save: "Couldn't save this change.", }, }, files: { open: "Open the file", openFailed: "Couldn't open the file", }, login: { useBackupCode: "Use a backup code instead", useAuthenticator: "Use authenticator code instead", invalidCode: "Invalid code", verifying: "Verifying...", verify: "Verify", backupCodeHint: "Enter one of your backup codes.", authenticatorHint: "Enter the 6-digit code from your authenticator app.", failed: "Login failed", signingIn: "Signing in...", signIn: "Sign in", password: "Password", email: "Email", }, purchasing: { supplierPayment: { done: "Payment of {amount} recorded on {count} invoice(s) — reference {ref}.", confirm: "Record the payment", total: "Payment total", title: "Payment to {supplier}", settle: "Settle the selection", selection: "{count} invoice(s) selected — {amount} left to pay", pickSupplierHint: "Choose a supplier above to settle several of its invoices with one payment.", }, invoiceVat: { oldestFirst: "Oldest invoices first (automatic)", settlesInvoice: "Invoice settled", hintCredit: "Copy the amounts of the supplier's credit note, rate by rate.", hintInvoice: "Copy the HT and VAT per rate exactly as printed on the supplier's invoice. Expected from receptions: {amount}.", estimated: "VAT estimated (no breakdown entered)", addRate: "Add a VAT rate", vatAmount: "VAT", }, missingInvoice: { badge: "No invoice", banner: "Goods received ({amount}) but no supplier invoice recorded: add it to schedule the payment and deduct the VAT.", }, dueDate: { supplierFieldHint: "Empty: invoices will use the legal default of 60 days, and you'll be warned.", savedNoTerms: "(legal default of 60 days: the supplier has no payment term recorded)", savedNotice: "Invoice {number} recorded — due on {date}.", manual: "Due date entered manually.", noSupplierTerms: "No payment term recorded for {supplier}: due date set to the legal default of 60 days (Loi 69-21). Add it in Suppliers so it's exact next time.", fromSupplier: "Due date calculated: {days} days, per {supplier}'s payment terms.", }, supplierDocs: { types: { other: "Other", patente: "Business tax (patente)", rib: "Bank details (RIB)", cnss: "CNSS certificate", rc: "Trade register (RC)", attestation_fiscale: "Tax compliance certificate", }, state: { ok: "Valid", expiring: "Expires soon", expired: "Expired", }, alertHint: "The purchasing team is alerted 30 days before a document expires.", deleteConfirm: "Delete this document?", noExpiry: "No expiry", expiryDate: "Expiry date", issueDate: "Issue date", number: "Number", label: "Name", type: "Type", add: "Add a document", empty: "No documents yet.", title: "Supplier documents", }, statement: { types: { payment: "Payment", credit_note: "Credit note", invoice: "Invoice", }, balance: "Balance", credit: "Credit", debit: "Debit", reference: "Reference", operation: "Operation", empty: "No movement in this period.", closing: "Balance owed", settled: "Paid / credited", invoiced: "Invoiced", opening: "Opening balance", title: "Supplier statement", }, restock: { suggested: "To order", requested: "Requested", incoming: "On order", minimum: "Minimum", stock: "In stock", createOrder: "Create the purchase order", noSupplier: "No supplier price recorded", empty: "Nothing to restock: every article is above its minimum or already on order.", subtitle: "Articles at or below their minimum, after what's already on order — grouped by the cheapest supplier.", title: "Restocking", }, reports: { withoutInvoiceReason: { overpaid: "paid beyond what was invoiced", no_invoice: "no invoice recorded", }, agedHint: "Based on supplier invoices and their due dates — orders without an invoice aren't counted yet.", withoutInvoiceHint: "VAT is deducted on a supplier INVOICE. Add the invoice on the order (Invoices → Add an invoice) and the payment will appear in the listing.", withoutInvoiceTitle: "{count} payment(s) not in this listing", aged: { total: "Total owed", d90plus: "> 90 d", d61_90: "61–90 d", d31_60: "31–60 d", d1_30: "1–30 d", notDue: "Not due", }, agedEmpty: "Nothing owed to suppliers.", agedTitle: "Aged supplier balance", accounts: { a5161: "Cash", a5141: "Bank", a4411: "Suppliers", a34552: "VAT recoverable", a6111: "Purchases", }, accountingHint: "Supplier invoices, credit notes and payments of the period as journal entries, on the Moroccan chart of accounts:", accountingTitle: "Accounting export (journal)", paymentDate: "Payment date", missingIds: "IF / ICE missing", supplierIds: "Supplier IF / ICE", vatEmpty: "No supplier payment in this period.", vatDeductible: "Deductible VAT", vatHint: "Invoices PAID in the period (VAT is deducted on payment), with the supplier's IF and ICE — to attach to the VAT return.", vatTitle: "VAT deduction listing", downloadXlsx: "Download Excel", subtitle: "Files for your accountant and your VAT return.", title: "Purchasing reports", }, compare: { hint: "Cheapest per line in green. Choosing a supplier creates the purchase order and closes the other quotes.", choose: "Choose", incomplete: "Incomplete", title: "Quote comparison", button: "Compare", created: "{count} price requests created (one per supplier). Use \"Compare\" once they've answered.", multiHint: "One price request per supplier ({count}) will be created — you'll be able to compare their answers.", addSupplier: "Add a supplier", suppliers: "Suppliers", }, email: { simulatedShort: "not sent (no SMTP)", simulated: "Email NOT sent: no email server is configured yet. It was recorded in the outbox — configure SMTP in the backend .env to send for real.", sent: "Email sent to {to}.", defaultMessageHint: "Leave empty to use the standard message", message: "Message", cc: "CC", to: "To", titleDp: "Send {number} to the supplier", title: "Send {number} to the supplier", send: "Send by email", }, approval: { approvedOn: "Approved on {date}", refusedBanner: "Approval refused: {reason}", waitingForApprover: "An admin, the owner or the purchasing manager must approve it.", pendingBanner: "Awaiting approval since {date}.", approvedNotice: "Order approved — it can now be sent to the supplier.", requested: "This order is above the approval threshold: it was sent for approval. Approvers have been notified.", refuseReason: "Reason for refusing", refuseTitle: "Refuse", refuse: "Refuse", approve: "Approve", }, supplierInvoices: { title: "Supplier invoices", subtitle: "Every supplier invoice by due date — what's left to pay and what's overdue.", overdue: "Overdue", overdueCount: "{count} invoice(s)", dueIn30: "Due within 30 days", empty: "No invoices here.", filters: { unpaid: "To pay", overdue: "Overdue", all: "All" } }, legal: { needs_agreementHint: "Payment term over 60 days: allowed only with a written agreement (Loi 69-21).", over_maxHint: "Payment term over 120 days: beyond the legal maximum (Loi 69-21)." }, invoiceStatus: { overdue: "Overdue by {days} d" }, invoices: { type: "Type", types: { invoice: "Invoice", credit_note: "Credit note" }, applied: "Deducted" }, match: { notInvoiced: "Not invoiced yet", matched: "Matches what was received", toInvoice: "{amount} still to invoice", overInvoiced: "{amount} invoiced too much", creditExpected: "A credit note of {amount} is expected from the supplier for the returned goods.", overInvoicedHint: "The supplier invoiced {amount} more than what was received and kept — check the invoice before paying." }, kpi: { ordered: "Ordered", received: "Received", ofOrder: "of the order", invoiced: "Invoiced (net)", paid: "Paid", settled: "Fully paid" }, pdf: { download: "Download PDF" }, supplierSelect: { choose: "Choose a supplier", none: "No supplier yet — add one in Purchasing > Suppliers", notInList: "not in the supplier list" }, supplierPrices: { open: "Supplier prices & references", internalReference: "Internal reference", internalReferencePlaceholder: "e.g. RM-GLOVES-01", referenceLocked: "Only production can change an existing internal reference.", referenceMissing: "This article has no internal reference yet — you can add one.", supplierReference: "Supplier's reference", none: "No supplier price yet.", addSupplier: "Add a supplier", noReference: "No reference" }, addToInventory: { button: "Add to inventory", title: "Add this article to the inventory", category: "Category", referenceOptional: "Optional — can be added later", threshold: "Minimum stock (alert)", stockNow: "{count} already received will be put into stock now.", stockLater: "Future receptions of this line will go into stock.", confirm: "Add to inventory" }, errors: { load: "Could not load the data.", save: "Could not save this change." }, columns: { number: "Number", date: "Date", supplier: "Supplier", status: "Status", payment: "Payment", paid: "Paid", received: "Received", note: "Note", article: "Article", quantity: "Quantity", requestedBy: "Requested by" }, filters: { missingInvoice: "Received, not invoiced", late: "Late deliveries", all: "All", number: "Order number" }, lines: { closed: "Closed", complete: "Complete", closedBecause: "Closed", receivedShort: "received", returnedShort: "returned", expectedShort: "still expected", close: "Close line", closeHint: "Accept what was received as final — nothing more will be expected on this line", reopen: "Reopen", closeTitle: "Close this line", closeSummary: "{received} received out of {ordered} ordered — the {missing} missing will no longer be expected.", closeReason: "Reason (optional)", closeReasonPlaceholder: "e.g. remainder cancelled with the supplier", closeEffect: "Once every line is received or closed, the order is marked received and its purchase requests are closed. You can reopen the line later.", priceFromArticle: "Price taken from the article's supplier price (inventory) — you can still change it", noPriceShort: "No price", pickSupplierForPrices: "Choose the supplier: article prices will be filled in from the inventory.", missingPrices: "{count} article(s) have no price for {supplier} in the inventory — enter it on the line.", article: "Article", pickArticle: "Inventory article (optional)", description: "Description", descriptionPlaceholder: "Article or service", quantity: "Qty", unit: "Unit", unitPrice: "Unit price (HT)", quotedPrice: "Quoted price (HT)", vat: "VAT", addLine: "Add a line" }, totals: { ht: "Total excl. VAT", vat: "VAT", ttc: "Total incl. VAT" }, orderStatus: { pending_approval: "Awaiting approval", draft: "Draft", sent: "Ordered", partially_received: "Partially received", received: "Received", cancelled: "Cancelled" }, paymentStatus: { unpaid: "Unpaid", partially_paid: "Partly paid", paid: "Paid" }, requestStatus: { pending: "Pending", delayed: "Delayed", ordered: "Ordered", declined: "Declined", received: "Received" }, priceStatus: { draft: "Draft", sent: "Sent", answered: "Answered", accepted: "Accepted", rejected: "Rejected" }, paymentMethods: { virement: "Bank transfer", cheque: "Cheque", especes: "Cash", effet: "Bill of exchange (effet)", carte: "Card", autre: "Other" }, summary: { missingInvoice: "Received, not invoiced", totalOrdered: "Total ordered (incl. VAT)", totalPaid: "Total paid", remaining: "Left to pay", overdue: "Orders with overdue invoices", byStatus: "Orders by status" }, requests: { title: "Purchase requests", subtitle: "Requests from production. Answer each one, or select several to create one purchase order.", createOrder: "Create a purchase order ({count})", empty: "No purchase requests here.", select: "Select", stock: "Stock", threshold: "threshold", productionNote: "Production's note", purchasingAnswer: "Purchasing's answer", filters: { open: "To handle", ordered: "Ordered", declined: "Declined", received: "Received", all: "All" }, actions: { ordered: "Mark as ordered", delayed: "Delay (with a reason)", declined: "Decline (with a reason)", note: "Add a note for production" }, dialog: { linkOrder: "Link to an existing purchase order (optional)", noOrder: "— No link (ordered another way) —", notifyHint: "Production is notified of your answer.", orderedTitle: "Mark as ordered", orderedLabel: "Note (optional)", orderedPlaceholder: "e.g. expected delivery on Monday", delayedTitle: "Delay the request", delayedLabel: "Why is it delayed?", delayedPlaceholder: "e.g. supplier out of stock until the 15th", declinedTitle: "Decline the request", declinedLabel: "Reason for declining", declinedPlaceholder: "e.g. article discontinued, use the new reference", noteTitle: "Note for production", noteLabel: "Note", notePlaceholder: "e.g. waiting for the supplier's quote" } }, orders: { title: "Purchase orders", subtitle: "Orders, receptions, invoices and payments — the recap of purchases.", new: "New purchase order", empty: "No purchase orders.", form: { editTitle: "Edit purchase order", supplierRequired: "Choose a supplier.", pickSupplier: "Choose a supplier", noSuppliers: "No active supplier yet — add one in Suppliers.", expectedDate: "Expected delivery", fromRequests: "Created from {count} purchase request(s): saving links them and notifies production.", saveDraft: "Save as draft", saveAndSend: "Save & mark as ordered", noCompany: "Open this page from the purchase orders list." } }, detail: { paymentWithoutInvoice: "Paid, but no supplier invoice is recorded yet: add it (Invoices above) so this payment counts in the TVA deduction listing and the aged balance.", lines: "Lines", addCreditNote: "Add a credit note", creditNoteNumber: "Credit note number", dueDateAuto: "Leave empty: invoice date + {days} days (supplier's payment terms)", expectedFromReceptions: "Expected from what was received: {amount}", markSent: "Mark as ordered", cancelOrder: "Cancel order", deleteConfirm: "Delete this draft?", cancelledBecause: "Cancelled", cancelReason: "Reason for cancelling", cancelRequestsHint: "The purchase requests on this order go back to the purchasing queue.", ordered: "Ordered", received: "Received", returned: "Returned", outstanding: "Still expected", kept: "Received and kept", noStock: "no stock (free line)", receptions: "Receptions & returns", receive: "Receive goods", returnGoods: "Return to supplier", sendFirst: "Mark the order as ordered before receiving goods.", receptionTitle: "Receive goods", returnTitle: "Return goods to the supplier", blNumber: "Delivery note (BL) number", returnReference: "Return reference", scan: "Scan (optional)", file: "File", stockInHint: "Received quantities are added to the inventory.", stockOutHint: "Returned quantities are removed from the inventory.", noReceptions: "Nothing received yet.", type: { reception: "Reception", return: "Return" }, invoices: "Invoices", addInvoice: "Add an invoice", invoiceNumber: "Invoice number", dueDate: "Due date", amountTTC: "Amount (incl. VAT)", noInvoices: "No invoices yet.", deleteInvoiceConfirm: "Delete this invoice?", payments: "Payments", addPayment: "Record a payment", amount: "Amount", method: "Payment method", paymentReference: "Reference", paymentReferencePlaceholder: "Cheque / transfer number", noPayments: "No payments yet.", deletePaymentConfirm: "Delete this payment?", linkedRequests: "Purchase requests on this order" }, priceRequests: { noPricesHint: "List what you want a price for — the supplier fills in the prices in their answer. A line can be an inventory article, or just typed in for an article you don't stock yet.", enterPricesHint: "Enter the prices from the supplier's answer, then create the purchase order — or reject it.", title: "Price requests", subtitle: "Ask suppliers for quotes, record their prices, and turn the best one into a purchase order.", new: "New price request", empty: "No price requests.", deadline: "Answer expected by", quote: "Supplier's quote", uploadQuote: "Attach the quote", markSent: "Mark as sent", markAnswered: "Mark as answered", reject: "Reject", convert: "Create the purchase order", deleteConfirm: "Delete this price request?" }, suppliers: { title: "Suppliers", subtitle: "Your suppliers and their details.", new: "New supplier", empty: "No suppliers.", search: "Search", searchPlaceholder: "Name, contact, city, ICE…", active: "Active", inactive: "Inactive", deleteConfirm: "Delete \"{name}\"?", deactivated: "This supplier has orders, so it was deactivated instead of deleted.", fields: { paymentDays: "Payment term (days)", name: "Name", contactName: "Contact", phone: "Phone", email: "Email", city: "City", address: "Address", ice: "ICE", identifiantFiscal: "Tax ID (IF)", rc: "Trade register (RC)", paymentTerms: "Payment terms" } }, history: { title: "Article history", subtitle: "Every purchase order and request for an inventory article.", pickHint: "Choose an article to see its purchase history.", inStock: "In stock", orders: "Orders", totalOrdered: "Total ordered", totalReceived: "Total received", averagePrice: "Average price", lastPrice: "Last price", noOrders: "This article isn't on any purchase order yet.", noRequests: "No purchase requests for this article.", openForArticle: "Purchase history" } }, holidays: { title: "Public holidays", subtitle: "The year's jours fériés: whether the company works, and how hours worked are paid.", downloadTemplate: "Download template", import: "Import Excel", add: "Add a holiday", year: "Year", howItWorks: "Each year: download the template (fixed-date holidays are already filled in), add the religious holidays with their official dates, then import it. Closed holiday: nobody is expected, and anyone who clocks in has their hours recorded as holiday hours. Pay \"double\" adds one extra hourly rate per hour worked; \"normal\" adds nothing.", importDone: "Import complete: {created} added, {updated} updated.", namePlaceholder: "Holiday name (e.g. Aïd al-Fitr)", previewTitle: "Preview of {file}", previewErrors: "{count} row(s) to fix — correct the file and import it again", previewReady: "{count} row(s) ready to import", columns: { row: "Row", date: "Date", name: "Name", open: "Company", pay: "Pay if worked", check: "Check" }, defaultClosed: "Closed (default)", defaultDouble: "Double (default)", open: "Open", closed: "Closed", payDouble: "Double", payNormal: "Normal", confirmImport: "Import", emptyTitle: "No public holidays for {year} yet", emptyMessage: "Download the template, complete it, and import it.", deleteTitle: "Delete public holiday", deleteMessage: "Delete \"{name}\"? Attendance already recorded for that day is kept.", errors: { load: "Could not load the public holidays.", save: "Could not save this change.", template: "Could not download the template.", read: "Could not read this file.", import: "The import failed." } }, myDepartment: { adminTitle: "Department access", adminSubtitle: "Every department you oversee: its manager, which job titles get the department's module, and who has access.", adminEmptyTitle: "No departments yet.", noManagerAssigned: "No manager assigned", title: "My department", subtitle: "Your team, and which job titles get access to the department's module.", loadError: "Could not load your department.", saveError: "Could not save this change.", saved: "Saved.", accountsUpdated: "Saved — {count} account(s) updated.", emptyTitle: "You don't manage a department yet.", positionsTitle: "Job titles & access", positionsHint: "Switch on a job title to give everyone holding it access to this department's module. Everyone else sees My Space only.", noModule: "This department doesn't unlock a module, so there's no access to distribute.", noPositions: "No job positions defined for this department yet.", holders: "{count} employee(s)", toggleLabel: "Grants module access", teamTitle: "Team", noEmployees: "No employees in this department.", columns: { name: "Name", jobTitle: "Job title", access: "Access" }, noLogin: "No login", moduleAccess: "Module access", mySpaceOnly: "My Space only" },
    // ====================================================
    // SIDEBAR
    // ====================================================

    sidebar: { platform: "Platform", clients: "Clients", purchasingReports: "Purchasing reports", restock: "Restocking", supplierInvoices: "Supplier invoices", purchasing: "Purchasing", purchaseRequestsQueue: "Purchase requests", purchaseOrders: "Purchase orders", priceRequests: "Price requests", suppliers: "Suppliers", purchasingInventory: "Inventory", articleHistory: "Article history", holidays: "Public holidays", departmentAccess: "Department access", myDepartment: "My department", myRecords: "My records",
      leaveCalendar: "Leave Calendar",
      performanceReviews: "Performance Reviews",
      disciplinaryActions: "Disciplinary Actions",
      admin: "Admin",
      settings: "Settings",
      help: "Help & Support",
      profile: "Profile",
      hr : "Human Resources",
      companies: "Companies",
      organization: "Organization",
      company: "Company",
      employees: "Employees",
      payroll: "Payroll",
      contracts: "Contracts",
      employeeDocuments: "Documents",
      attendance: "Attendance",
      orgChart: "Org Chart",
      reports: "Reports",
      auditLog: "Audit Log",
      mySpace: "My Space",
      myProfile: "My Profile",
      myPayslips: "My Payslips",
      myAbsences: "My Absences",
      myAdvances: "My Advances",
      myAttendance: "My Attendance",
      salaries: "Salaries",
      absences: "Absences",
      advances: "Advances",
      users: "Users",
      workSchedule: "Work Schedule",
      production: "Production",
      inventory: "Inventory",
      purchaseRequests: "Purchase Requests",
      inventorySettings: "Settings",
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

    common: { home: "Home", breadcrumb: "Breadcrumb", clear: "Clear", clearSearch: "Clear search", nextPage: "Next page", previousPage: "Previous page", pagination: "Pagination", hidePassword: "Hide password", showPassword: "Show password", somethingWentWrong: "Something went wrong", confirmAction: "Confirm action", pageNotFoundHint: "This page doesn't exist or has moved.", pageNotFound: "Page not found", status: "Status", save: "Save", back: "Back",
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
      chooseFile: "Choose file",
      noFileChosen: "No file chosen",
      dateFrom: "From",
      dateTo: "To",
    },

    // ====================================================
    // PROFILE
    // ====================================================

    profile: { loadFailed: "Failed to load the profile",
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

    company: { workflow: { accountInvalid: "An accounting account is 4 to 10 digits.", purchaseAccountHint: "Used in the accounting export for articles whose category has no account of its own, and for typed-in lines (e.g. 6111, 6121, 6125).", purchaseAccount: "Default purchase account", purchaseThresholdHint: "Purchase orders at or above this amount (incl. VAT) must be approved by an admin, the owner or the purchasing manager before being ordered. 0 = no approval.", purchaseThreshold: "Purchase order approval threshold", title: "Approval workflow", sequentialApproval: "Require manager approval before HR", sequentialApprovalHint: "When on, absence and advance requests must be approved by the employee's manager first, then receive final approval from HR. Employees without a manager go straight to HR.", saveFailed: "Could not save this setting." },
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

      downloadFiche:
        "Download fact sheet",

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

        ficheDownloadFailed:
          "Error generating the company fact sheet.",

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
      inheritedFromEmployee: "Department and HR role are inherited from the linked employee {name} ({department} — {jobTitle}). To change them, update the employee's Department or Job Title instead.",

      updateTitle: "Update User",
      updateSureMessage: "Are you sure you want to save these changes?",

      updateSuccessTitle: "User Updated",
      updateSuccessMessage: "The user has been updated successfully.",

      updateFailTitle: "Update Failed",
      updateFailMessage: "We couldn't update the user. Please try again.",

      hrRole: {
        label: "HR Job Title",
        notApplicable: "Not applicable (not HR)",
        assistant: "Assistant(e) RH",
        officer: "Chargé(e) RH",
        manager: "Responsable RH",
        director: "Directeur/Directrice RH",
      },
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

      documents: {
        menuButton: "Documents",
        attestationTravail: "Attestation de travail",
        attestationSalaire: "Attestation de salaire",
        certificatTravail: "Certificat de travail",
        contratTravail: "Contrat de travail",
        soldeToutCompte: "Reçu pour solde de tout compte",
        generationFailed: "Error generating the document.",
      },

      bulkImport: {
        exportButton: "Export (CSV)",
        exportFailed: "Could not export employees.",
        openButton: "Import (CSV)",
        title: "Bulk import employees",
        helpText: "Upload a CSV file to create multiple employees at once. Every row is checked first — nothing is created until you confirm.",
        downloadTemplate: "Download CSV template",
        preview: "Check file",
        previewing: "Checking...",
        previewFailed: "Could not read this file.",
        summaryValid: "{count} ready to import",
        summaryErrors: "{count} with errors",
        summaryWarnings: "{count} with warnings",
        rowOk: "Looks good",
        fixErrorsFirst: "Fix the rows with errors and re-upload the file before importing — rows with only warnings will still be imported.",
        importButton: "Import {count} employee(s)",
        committing: "Importing...",
        commitFailed: "Could not complete the import.",
        commitSuccess: "{count} employee(s) imported successfully.",
      },

      fields: { manager: "Manager", noManagerCandidates: "No other employee in this company yet",
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
        noDepartments: "No departments defined yet — add one from Organization > Departments",

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
        createLogin: "Self-service login",
        createLoginCheckboxLabel: "Also create a self-service login for this employee (uses their work email)",
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

      linkedUser: {
        title: "Self-service access",
        linkedTo: "Linked to:",
        link: "Link",
        unlink: "Unlink",
        linkTitle: "Link user account",
        linkSureMessage: "Link this user account to this employee? They'll get access to My Space (payslips, absence/advance requests, attendance).",
        unlinkTitle: "Unlink user account",
        unlinkSureMessage: "Unlink this user account from this employee? They'll lose access to My Space.",
        searchPlaceholder: "Search users by name or email...",
        actionFailed: "Something went wrong. Please try again.",
        orCreateNew: "or",
        createLogin: "Create new login",
        createLoginTitle: "Create login",
        createLoginSureMessage: "Create a new self-service login for this employee? A temporary password will be generated and shown once — make sure to save it.",
        loginCreatedTitle: "Login created",
        loginCreatedMessage: "Email: {email}\nTemporary password: {password}\n\nShare this with the employee — it won't be shown again. They should change it after their first login (from their Profile page).",
        loginNotCreatedTitle: "Employee created, but no login yet",
        resetPassword: "Reset password",
        resetPasswordTitle: "Reset password",
        resetPasswordSureMessage: "Generate a new temporary password for this employee's login? Their current password will stop working immediately.",
      },

      related: {
        empty: "Nothing here yet.",
        tabs: {
          salary: "Salary",
          absences: "Absences",
          advances: "Advances",
          contracts: "Contracts",
          documents: "Documents",
          attendance: "Attendance",
        },
      },
    },
    workSchedule: { shiftType: "Shift type", continuous: "One continuous shift", split: "Split shift (midday break)", continuousHint: "Employees clock in once and clock out once, e.g. 09:00 → 16:00. Anything worked beyond the scheduled hours counts as overtime.", splitHint: "Employees clock in and out twice, e.g. 08:00 → 12:00 and 14:00 → 18:00. The midday break isn't counted as worked time; overtime is anything beyond the scheduled hours, and lateness is checked on both arrivals.", morningIn: "Clock in", middayOut: "Midday out", middayIn: "Midday in", finalOut: "Clock out", scheduledHours: "Hours", applyToAll: "Copy this day's times to every working day", applyToAllShort: "Apply to all days", invalidTimes: "the times must be in order (clock in, then midday out, then midday in, then clock out).", invalidShort: "Check times",
      title: "Work Schedule",
      subtitle: "Set expected clock-in times, work hours, and grace periods per day — used to calculate lateness and overtime.",
      fields: { day: "Day", workingDay: "Working day", startTime: "Start time", workHours: "Work hours", grace: "Grace (min)" },
      days: {
        monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
        friday: "Friday", saturday: "Saturday", sunday: "Sunday",
      },
      working: "Working day",
      dayOff: "Day off",
      hoursUnit: "h",
      minutesUnit: "min",
      footnote: "Clocking in later than the start time plus the grace period marks the day \"late\". Overtime is anything worked beyond the configured work hours.",
      savedTitle: "Schedule saved",
      savedMessage: "The work schedule was updated successfully.",
      saveFailed: "Something went wrong while saving. Please try again.",
      hoursManagement: {
        title: "Hours Management",
        subtitle: "Control how attendance affects payroll — each option below is independent.",
        payOvertime: "Pay overtime",
        payOvertimeHint: "Add extra pay for hours worked beyond the scheduled work hours.",
        deductLateArrival: "Deduct for late arrival",
        deductLateArrivalHint: "Reduce pay for time lost to late clock-ins.",
        deductEarlyLeave: "Deduct for early leave",
        deductEarlyLeaveHint: "Reduce pay for time lost to leaving before the scheduled end time.",
        deductionRate: "Deduction rate",
        deductionRateHint: "Multiplier applied to the hourly rate for late/early deductions — 1× is a straight pay-for-time deduction.",
        monthlyStandardHours: "Monthly standard hours",
        monthlyStandardHoursHint: "Used to compute the hourly rate from the base salary (base salary ÷ this number).",
        rateSuffix: "×",
      },
    },


    production: {
      title: "Production",
    },

    inventory: {
      title: "Inventory",
      subtitle: "Track stock, thresholds, and supplier prices.",
      addProduct: "Add product",
      editProduct: "Edit product",
      searchPlaceholder: "Search by name or reference...",
      lowStockOnly: "Low stock only",
      lowStock: "Low stock",
      asOfDate: "As of date",
      viewingAsOf: "Showing inventory as of {date}.",
      deleteTitle: "Delete product",
      deleteSureMessage: "Are you sure you want to delete this product? Its movement history will also be removed. This cannot be undone.",
      emptyTitle: "No products yet",
      emptyMessage: "Add your first product to start tracking inventory.",
      purchaseRequestSuccess: "Purchase request submitted successfully.",
      fields: {
        category: "Category", selectCategory: "Select a category", name: "Name",
        internalReference: "Internal reference", quantity: "Quantity", unit: "Unit",
        threshold: "Threshold", sellingPrice: "Selling price", image: "Image",
        prices: "Supplier prices", supplierName: "Supplier", price: "Price",
        supplierReference: "Supplier reference", reason: "Reason", notes: "Notes",
        search: "Search", orderedQuantity: "Ordered quantity",
      },
      actions: {
        add: "Add stock", remove: "Remove stock", requestPurchase: "Request purchase",
        submitRequest: "Submit request",
      },
      errors: {
        fetchFailed: "Failed to load inventory", saveFailed: "Something went wrong while saving.",
        deleteFailed: "Something went wrong while deleting.", adjustFailed: "Something went wrong while updating the quantity.",
        missingFields: "Please fill in the category, name, and internal reference.",
        invalidQuantity: "Please enter a valid quantity.", purchaseRequestFailed: "Something went wrong while submitting the request.",
      },
    },

    inventorySettings: {
      title: "Inventory Settings",
      subtitle: "Define the categories (rubriques) used across your inventory.",
      addCategory: "Add category",
      editCategory: "Edit category",
      deleteTitle: "Delete category",
      deleteSureMessage: "Are you sure you want to delete this category? Products still using it must be reassigned or deleted first.",
      emptyTitle: "No categories yet",
      emptyMessage: "Add your first inventory category (e.g. \"Raw material\", \"Finished product\").",
      fields: { fixedAssetOff: "No — VAT on 34552", fixedAssetOn: "Yes — VAT on 34551", fixedAsset: "Fixed asset", accountingAccountHint: "Where purchases of this category go in the accounting export — e.g. 6121 raw materials, 6122 consumables, 2332 equipment. Empty: the company's default account.", accountingAccount: "Accounting account (purchases)",
        name: "Name", namePlaceholder: "e.g. Matière première",
        icon: "Icon", description: "Description", descriptionPlaceholder: "Optional",
      },
      errors: {
        nameRequired: "Category name is required", saveFailed: "Something went wrong while saving.",
        deleteFailed: "Something went wrong while deleting.",
      },
    },

    purchaseRequests: {
      title: "Purchase Requests",
      subtitle: "Restocking requests sent to Purchasing, and their answer.",
      emptyTitle: "No purchase requests",
      emptyMessage: "No purchase requests match your filters.",
      markReceived: "Mark as received",
      fields: { product: "Product", quantity: "Quantity", requestedBy: "Requested by" },
      status: { received: "Received" },
    },

    departments: { noManagerBadge: "No manager", managerLabel: "Manager", moduleAccessBadge: "Module access",
      title: "Departments",
      subtitle: "Define your organization's departments and the job positions (postes) within them.",
      addDepartment: "Add department",
      addDefaults: "Add default departments",
      defaultsModal: {
        title: "Add default departments",
        helpText: "Pick the departments you want to add — each comes with a standard name, description, and (for HR/Production) module access already set. You can still edit or add more later.",
        adding: "Adding...",
        addButton: "Add {count} department(s)",
      },
      editDepartment: "Edit department",
      addPosition: "Add position",
      editPosition: "Edit position",
      deleteTitle: "Delete department",
      deleteSureMessage: "Are you sure you want to delete this department? Employees and positions still using it must be reassigned first.",
      deletePositionTitle: "Delete position",
      deletePositionSureMessage: "Are you sure you want to delete this position? Employees still holding it, or other positions reporting to it, must be reassigned first.",
      emptyTitle: "No departments yet",
      emptyMessage: "Add your first department to start building your org structure.",
      searchPlaceholder: "Search departments...",
      noSearchResults: "No departments match your search.",
      noPositions: "No positions defined in this department yet.",
      fields: { purchasingAccess: "Purchasing module access", manager: "Department manager", noManager: "No manager", managerHint: "Oversees the whole department: full module access, approves the team's requests, and decides which job titles get module access.", grantsModuleAccess: "Grants module access", grantsModuleAccessHint: "Holders of this position get this department's module (e.g. HR or Inventory). Leave off for staff who should only see My Space.",
        name: "Name", description: "Description", permissionKey: "Module access",
        permissionKeyHint: "Optional — only set this on ONE department if employees there (and their auto-created logins) should get HR or Production module access. Most departments should leave this as \"No special access\".",
        category: "Job function",
        noCategory: "No specific function",
        categoryHint: "Optional — lets the employee form suggest standard job titles for this department instead of leaving it free text. Purely a suggestion; carries no access implications, unlike Module access above.",
        noSpecialAccess: "No special access", hrAccess: "HR module access", productionAccess: "Production module access",
        positionTitle: "Position title", reportsTo: "Reports to", noReportsTo: "None (top-level position)",
        salaryMin: "Salary band — min", salaryMax: "Salary band — max", salaryBand: "Salary band",
        requiredSkills: "Required skills", requiredSkillsPlaceholder: "Comma-separated, e.g. Excel, Leadership",
      },
      errors: {
        nameRequired: "Department name is required", titleRequired: "Position title is required",
        saveFailed: "Something went wrong while saving.", deleteFailed: "Something went wrong while deleting.",
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

      history: { deleteRecord: "Delete this salary record",
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
        reviewComment: "Review comment",
        status: "Status",
      },

      types: {
        paid_leave: "Paid leave",
        unpaid_leave: "Unpaid leave",
        sick_leave: "Sick leave",
        absence: "Absence",
        other: "Other",
      },

      status: { manager_approved: "Manager approved",
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
        reviewComment: "Review comment",
        status: "Status",
      },

      status: { manager_approved: "Manager approved",
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
    payroll: {
      title: "Payroll",
      subtitle: "Generate monthly payroll runs and manage payslips.",
      generateRun: "Generate payroll",
      createTitle: "Generate payroll run",
      createSureMessage: "Generate payroll for this period? A payslip will be created for every active employee with a salary on file.",
      createSuccessTitle: "Payroll run created",
      createSuccessMessage: "The payroll run was generated successfully.",
      completeTitle: "Complete payroll run",
      completeSureMessage: "Complete this payroll run? Once completed, payslips are locked and employees are notified.",
      deleteTitle: "Delete payroll run",
      deleteSureMessage: "Delete this draft payroll run and all its payslips? This cannot be undone.",
      emptyTitle: "No payroll runs yet",
      emptyMessage: "Generate your first payroll run for this company.",
      noPayslips: "No payslips in this run.",
      fields: { month: "Month", year: "Year", status: "Status" },
      table: { period: "Period", employees: "Employees", gross: "Gross", net: "Net", searchPlaceholder: "Search employees..." },
      status: { draft: "Draft", completed: "Completed", voided: "Voided" },
      payslipStatus: { draft: "Draft", validated: "Validated", paid: "Paid" },
      actions: { view: "View", complete: "Complete", regenerate: "Regenerate", markPaid: "Mark as paid", downloadPdf: "Download payslip" },
      exports: {
        cnss: "CNSS Export",
        cnssHint: "Declaration worksheet — verify against the current Damancom format before uploading",
        register: "Payroll Register",
        bankTransfer: "Bank Transfer File",
      },
      buttons: { generate: "Generate", saving: "Saving..." },
      breadcrumbs: { hr: "HR", payroll: "Payroll" },
      months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
      errors: { fetchFailed: "Failed to load payroll runs", actionFailed: "Something went wrong. Please try again." },
    },

    contracts: {
      title: "Contracts",
      subtitle: "Track employment contracts, renewals, and expiry dates.",
      addContract: "New contract",
      createTitle: "New contract",
      createSureMessage: "Are you sure you want to create this contract?",
      createSuccessTitle: "Contract created",
      createSuccessMessage: "The contract was created successfully.",
      renewTitle: "Renew contract",
      renewSureMessage: "Renew this contract? The current one will be closed and a new one started.",
      deleteTitle: "Delete contract",
      deleteSureMessage: "Are you sure you want to delete this contract? This cannot be undone.",
      emptyTitle: "No contracts yet",
      emptyMessage: "This company has no contracts on file yet.",
      expiringBanner: "{count} contract(s) expiring within 30 days.",
      fields: { employee: "Employee", type: "Contract type", startDate: "Start date", endDate: "End date" },
      status: { active: "Active", expired: "Expired", terminated: "Terminated", renewed: "Renewed" },
      actions: { renew: "Renew" },
      buttons: { create: "Save contract" },
      breadcrumbs: { hr: "HR", contracts: "Contracts" },
      errors: { fetchFailed: "Failed to load contracts", actionFailed: "Something went wrong. Please try again." },
    },

    documents: {
      title: "Documents",
      subtitle: "Store employee documents and track expiry dates.",
      uploadDocument: "Upload document",
      editDocument: "Edit document",
      deleteTitle: "Delete document",
      deleteSureMessage: "Are you sure you want to delete this document? This cannot be undone.",
      emptyTitle: "No documents yet",
      emptyMessage: "This company has no documents on file yet.",
      expiringBanner: "{count} document(s) expiring within 30 days.",
      fields: { employee: "Employee", type: "Type", label: "Label", labelPlaceholder: "e.g. National ID card", expiryDate: "Expiry date", file: "File", replaceFile: "Replace file (optional)" },
      table: { file: "File" },
      types: {
        cin: "National ID (CIN)", passport: "Passport", work_permit: "Work permit",
        residence_permit: "Residence permit", contract: "Contract", diploma: "Diploma",
        cv: "CV", medical_certificate: "Medical certificate", other: "Other",
      },
      actions: { view: "View", loadMore: "Load more", loadMoreCount: "Showing {loaded} of {total}" },
      buttons: { upload: "Upload" },
      breadcrumbs: { hr: "HR", documents: "Documents" },
      errors: {
        fetchFailed: "Failed to load documents", actionFailed: "Something went wrong. Please try again.",
        missingFields: "Please choose an employee and a file.", uploadFailed: "Failed to upload the document.",
      },
    },

    attendance: {
      title: "Attendance",
      subtitle: "Review clock-in/clock-out records.",
      emptyTitle: "No attendance records",
      emptyMessage: "No attendance records match your filters.",
      filterAllEmployees: "All employees",
      fields: { employee: "Employee", date: "Date", clockIn: "Clock in", clockOut: "Clock out", notes: "Notes" },
      status: { present: "Present", late: "Late", absent: "Absent", half_day: "Half day", holiday: "Holiday" },
      breadcrumbs: { hr: "HR", attendance: "Attendance" },
      errors: { fetchFailed: "Failed to load attendance" },
    },

    reports: { chart: { zoomHint: "Drag the handles below the chart to zoom in", yearly: "Yearly", monthly: "Monthly", view: "View", lastMonths: "Last {n} months", range: "Range", },
      title: "Reports",
      subtitle: "Headcount, turnover, absenteeism, and payroll cost trends.",
      stats: { totalHeadcount: "Total headcount", activeEmployees: "Active employees", currentGross: "Current monthly gross (est.)", currentNet: "Current monthly net (est.)", missingSalaryNote: "{count} active employee(s) have no salary on file yet — not included in this estimate." },
      expand: "Expand",
      charts: {
        headcountByDepartment: "Headcount by department", turnover: "Turnover (last 12 months)",
        hires: "Hires", terminations: "Terminations", absenteeism: "Absenteeism rate (last 6 months)",
        absenteeismRate: "Absenteeism rate", payrollCost: "Payroll cost (last 12 months)",
        estimatedFootnote: "* The current month, marked with an asterisk, is a live estimate from current salaries — payroll hasn't been run for it yet.",
      },
      breadcrumbs: { hr: "HR", reports: "Reports" },
      loadError: "Some report data failed to load. Please try again, or check the console for details.",
      rankings: {
        title: "Employee rankings",
        last30Days: "Last 30 days",
        last90Days: "Last 90 days",
        last365Days: "Last 12 months",
        mostAbsenceDays: "Most absence days",
        bestAttendanceRate: "Best attendance rate",
        mostOvertimeHours: "Most overtime hours",
        mostLateDays: "Most late arrivals",
        noData: "No data for this period.",
        days: "days",
      },
    },

    auditLog: {
      title: "Audit Log",
      subtitle: "Who changed what, and when.",
      deleteTitle: "Delete audit log entry",
      deleteSureMessage: "Are you sure you want to delete this audit log entry? This cannot be undone.",
      emptyTitle: "No activity yet",
      emptyMessage: "No changes have been logged yet for this filter.",
      fields: { action: "Action", resourceType: "Type", resource: "Record", actor: "By", date: "Date" },
      resourceTypes: {
        Employee: "Employee", Salary: "Salary", Absence: "Absence", Advance: "Advance",
        Contract: "Contract", EmployeeDocument: "Document", PayrollRun: "Payroll run", WorkSchedule: "Work schedule",
      },
      actions: { create: "Created", update: "Updated", delete: "Deleted", review: "Reviewed" },
      breadcrumbs: { hr: "HR", auditLog: "Audit Log" },
      errors: { actionFailed: "This action failed. Please try again.", fetchFailed: "Failed to load the audit log" },
    },

    orgChart: {
      title: "Org Chart",
      subtitle: "Reporting structure, built from each employee's manager.",
      emptyTitle: "No org chart yet",
      emptyMessage: "Set a manager on employees to build the reporting structure.",
      breadcrumbs: { hr: "HR", orgChart: "Org Chart" },
    },

    mySpace: {
      title: "My Space",
      subtitle: "Your profile, payslips, and requests.",
      tabs: { profile: "Profile", payslips: "Payslips", absences: "Absences", advances: "Advances", attendance: "Attendance", records: "Records" },
      records: {
        performanceReviews: "Performance reviews",
        disciplinaryActions: "Disciplinary records",
        noReviews: "You have no performance reviews yet.",
        noDisciplinaryActions: "You have no disciplinary records.",
        reviewedBy: "Reviewed by",
        acknowledge: "Acknowledge",
        acknowledgeTitle: "Acknowledge",
        acknowledgeReviewMessage: "This confirms you've read this performance review. Continue?",
        acknowledgeDisciplineMessage: "This confirms you've read this record. Continue?",
        loadError: "Failed to load your records.",
        acknowledgeError: "Error acknowledging this record.",
      },
      leaveBalance: { title: "Paid leave balance", accrued: "Accrued", used: "Used", remaining: "Remaining" },
      teamRequests: { advance: "Salary advance", days: "{count} day(s)", reviewFailed: "Couldn't record this decision. Please try again.", title: "Your team's pending requests" },
      payslips: { emptyTitle: "No payslips yet", emptyMessage: "Your payslips will appear here once payroll is run." },
      absences: { cancelTitle: "Cancel request", cancelSureMessage: "Cancel this absence request?" },
      attendance: { holidayToday: "Public holiday today: {name}", holidayDouble: "hours worked are paid double", clockOutLunch: "Clock out for lunch", clockInAfternoon: "Clock back in", dayComplete: "Day complete ✓", scheduleToday: "Today", restDay: "Rest day", morning: "Morning", afternoon: "Afternoon", punchFailed: "Couldn't record this clock-in/out. Please try again.", todayStatus: "Today", clockIn: "Clock in", clockOut: "Clock out" },
    },

    notifications: {
      title: "Notifications",
      empty: "No notifications yet.",
      markAllRead: "Mark all read",
      now: "now",
      minutesShort: "m",
      hoursShort: "h",
      daysShort: "d",
    },

    units: {
      unit: "Unit",
      piece: "Piece",
      pair: "Pair",
      dozen: "Dozen",
      set: "Set",
      kg: "Kilogram (kg)",
      g: "Gram (g)",
      t: "Ton (t)",
      lb: "Pound (lb)",
      oz: "Ounce (oz)",
      quintal: "Quintal (q)",
      l: "Liter (L)",
      ml: "Milliliter (mL)",
      m3: "Cubic meter (m³)",
      gal: "Gallon (gal)",
      m: "Meter (m)",
      cm: "Centimeter (cm)",
      mm: "Millimeter (mm)",
      km: "Kilometer (km)",
      ft: "Foot (ft)",
      in: "Inch (in)",
      yd: "Yard (yd)",
      m2: "Square meter (m²)",
      ft2: "Square foot (ft²)",
      ha: "Hectare (ha)",
      box: "Box",
      carton: "Carton",
      pallet: "Pallet",
      bag: "Bag",
      sack: "Sack",
      bottle: "Bottle",
      can: "Can",
      roll: "Roll",
      sheet: "Sheet",
      bundle: "Bundle",
      case: "Case",
      drum: "Drum",
      barrel: "Barrel",
      container: "Container",
      hour: "Hour",
      day: "Day",
      month: "Month",
    },

    contentTranslation: {
      title: "Translations",
      editButton: "Translations",
      original: "Original",
      auto: "Auto-translated",
      manual: "Manually edited",
      missing: "Not translated yet",
      regenerate: "Regenerate",
      originalHint: "This is the original text — edit the field itself to change it.",
      save: "Save",
      saving: "Saving…",
      close: "Close",
      placeholder: "Enter the translation…",
      errors: {
        loadFailed: "Failed to load translations.",
        saveFailed: "Failed to save the translation.",
        regenerateFailed: "Failed to regenerate the translation.",
      },
    },
  twoFactor: { qrAlt: "2FA QR code",
    title: "Two-factor authentication",
    disabledHint: "Add an extra layer of security to your account — after your password, you'll also need a code from an authenticator app to sign in.",
    enabledHint: "Two-factor authentication is enabled on your account. You'll be asked for a code from your authenticator app every time you sign in.",
    enableButton: "Enable two-factor authentication",
    disableButton: "Disable two-factor authentication",
    disabling: "Disabling...",
    scanTitle: "Scan the QR code",
    scanHint: "Scan this with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows to confirm.",
    manualEntryLabel: "Can't scan it? Enter this code manually:",
    confirmAndEnable: "Confirm and enable",
    verifying: "Verifying...",
    backupCodesTitle: "Save your backup codes",
    backupCodesHint: "Each code can be used once to sign in if you lose access to your authenticator app. Save them somewhere safe — they won't be shown again.",
    copyBackupCodes: "Copy codes",
    copied: "Copied",
    iSavedThem: "I've saved these codes",
    confirmPasswordLabel: "Confirm your password to continue",
    errors: {
      statusFailed: "Could not check two-factor status.",
      setupFailed: "Could not start two-factor setup.",
      invalidCode: "That code didn't match — check your authenticator app and try again.",
      disableFailed: "Could not disable two-factor authentication.",
    },
  },

  disciplinaryActions: {
    title: "Disciplinary Actions",
    subtitle: "Track warnings and corrective actions issued to employees.",
    addAction: "Add record",
    editAction: "Edit record",
    emptyTitle: "No disciplinary records yet",
    emptyMessage: "This company has no disciplinary actions on file.",
    deleteTitle: "Delete record",
    deleteSureMessage: "Are you sure you want to delete this record? This cannot be undone.",
    acknowledged: "Acknowledged",
    notAcknowledged: "Not yet acknowledged",
    breadcrumbs: {
      hr: "HR",
      disciplinaryActions: "Disciplinary Actions",
    },
    fields: {
      employee: "Employee",
      type: "Type",
      date: "Date",
      reason: "Reason",
      description: "Description",
      suspensionDays: "Suspension (days)",
      issuedBy: "Issued by",
      notes: "Notes",
    },
    types: {
      verbal_warning: "Verbal warning",
      written_warning: "Written warning",
      final_warning: "Final warning",
      suspension: "Suspension",
      termination_notice: "Termination notice",
    },
    errors: {
      fetchFailed: "Failed to load disciplinary records",
      saveFailed: "Error saving record",
      deleteFailed: "Error deleting record",
    },
  },
  performanceReviews: {
    title: "Performance Reviews",
    subtitle: "Review cycles, goals, and ratings for your employees.",
    addReview: "New review",
    editReview: "Edit review",
    emptyTitle: "No performance reviews yet",
    emptyMessage: "This company has no performance reviews on file.",
    deleteTitle: "Delete review",
    deleteSureMessage: "Are you sure you want to delete this review? This cannot be undone.",
    reviewedBy: "Reviewed by",
    submitButton: "Submit to employee",
    breadcrumbs: {
      hr: "HR",
      performanceReviews: "Performance Reviews",
    },
    fields: {
      employee: "Employee",
      reviewer: "Reviewer",
      periodLabel: "Review period",
      periodLabelPlaceholder: "e.g. Annual review 2026",
      reviewDate: "Review date",
      goals: "Goals (one per line)",
      goalsPlaceholder: "Improve response time on support tickets\nComplete the onboarding certification",
      strengths: "Strengths",
      areasForImprovement: "Areas for improvement",
      comments: "Comments",
    },
    criteria: {
      jobKnowledge: "Job knowledge",
      qualityOfWork: "Quality of work",
      communication: "Communication",
      teamwork: "Teamwork",
      initiative: "Initiative",
      punctuality: "Punctuality",
    },
    statuses: {
      draft: "Draft",
      submitted: "Submitted",
      acknowledged: "Acknowledged",
    },
    errors: {
      fetchFailed: "Failed to load performance reviews",
      saveFailed: "Error saving review",
      submitFailed: "Error submitting review",
      deleteFailed: "Error deleting review",
    },
  },
  leaveCalendar: {
    title: "Leave Calendar",
    subtitle: "See who's on approved leave at a glance.",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    breadcrumbs: {
      hr: "HR",
      leaveCalendar: "Leave Calendar",
    },
    weekdays: {
      0: "Mon",
      1: "Tue",
      2: "Wed",
      3: "Thu",
      4: "Fri",
      5: "Sat",
      6: "Sun",
    },
    errors: {
      fetchFailed: "Failed to load the leave calendar",
    },
  },
  },

  // ======================================================
  // FRENCH
  // ======================================================

  fr: { platform: { rename: "Renommer le client", title: "Clients", subtitle: "Tous les clients de la plateforme, avec leurs sociétés et leurs comptes. Vous ne voyez que des totaux — jamais les données RH ou achats d'un client.", new: "Nouveau client", create: "Créer le client", details: "Détails", created: "Client « {name} » créé. Son administrateur peut se connecter dès maintenant avec {email} et le mot de passe défini.", firstAdmin: "Premier compte administrateur", firstAdminHint: "L'administrateur du client : il crée les sociétés, départements, employés et comptes. Transmettez-lui le mot de passe par un canal sûr ; il pourra le changer dans son profil.", fields: { name: "Nom du client", namePlaceholder: "ex. Groupe Atlas", notes: "Notes (internes)", firstName: "Prénom", lastName: "Nom", email: "E-mail", password: "Mot de passe provisoire", passwordHint: "Au moins 8 caractères.", }, columns: { client: "Client", companies: "Sociétés", accounts: "Comptes", employees: "Employés", status: "Statut", created: "Créé le", }, status: { active: "Actif", suspended: "Suspendu", }, suspend: "Suspendre", reactivate: "Réactiver", suspendTitle: "Suspendre ce client ?", suspendMessage: "Tous les comptes de « {name} » seront déconnectés et bloqués, y compris les sessions ouvertes. Rien n'est supprimé ; vous pouvez le réactiver à tout moment.", reactivateTitle: "Réactiver ce client ?", reactivateMessage: "Les comptes de « {name} » pourront de nouveau se connecter.", suspendedNotice: "« {name} » est suspendu.", reactivatedNotice: "« {name} » est de nouveau actif.", admins: "Comptes administrateurs", addAdmin: "Ajouter un administrateur", noAdmins: "Aucun compte administrateur.", adminAdded: "Compte administrateur {email} créé.", roles: { admin: "Administrateur", owner: "Propriétaire", }, privacyNote: "Isolation des clients : cette page n'affiche que les comptes qui administrent le client. Ses employés, sa paie, ses documents et ses achats restent visibles par le client seulement.", emptyTitle: "Aucun client pour l'instant", emptyMessage: "Créez le premier client et son compte administrateur.", orphans: { title: "Données rattachées à aucun client", hint: "Créées avant l'isolation des clients et non rattachées automatiquement. Tant qu'elles ne sont pas rattachées, personne ne les voit. Choisissez le client auquel elles appartiennent.", companies: "Sociétés", users: "Comptes", chooseClient: "Choisir un client", assign: "Rattacher à ce client", done: "{companies} société(s) et {users} compte(s) rattaché(s).", }, errors: { load: "Impossible de charger les clients.", save: "Impossible d'enregistrer cette modification.", }, }, files: { open: "Ouvrir le fichier", openFailed: "Impossible d'ouvrir le fichier", }, login: { useBackupCode: "Utiliser plutôt un code de secours", useAuthenticator: "Utiliser plutôt le code de l'application", invalidCode: "Code invalide", verifying: "Vérification...", verify: "Vérifier", backupCodeHint: "Saisissez l'un de vos codes de secours.", authenticatorHint: "Saisissez le code à 6 chiffres de votre application d'authentification.", failed: "Échec de la connexion", signingIn: "Connexion...", signIn: "Se connecter", password: "Mot de passe", email: "E-mail", }, purchasing: { supplierPayment: { done: "Règlement de {amount} enregistré sur {count} facture(s) — référence {ref}.", confirm: "Enregistrer le règlement", total: "Total du règlement", title: "Règlement à {supplier}", settle: "Régler la sélection", selection: "{count} facture(s) sélectionnée(s) — reste à payer {amount}", pickSupplierHint: "Choisissez un fournisseur ci-dessus pour régler plusieurs de ses factures en un seul paiement.", }, invoiceVat: { oldestFirst: "Factures les plus anciennes d'abord (automatique)", settlesInvoice: "Facture réglée", hintCredit: "Recopiez les montants de l'avoir du fournisseur, taux par taux.", hintInvoice: "Recopiez le HT et la TVA par taux exactement comme sur la facture du fournisseur. Attendu d'après les réceptions : {amount}.", estimated: "TVA estimée (pas de détail saisi)", addRate: "Ajouter un taux de TVA", vatAmount: "TVA", }, missingInvoice: { badge: "Sans facture", banner: "Marchandise reçue ({amount}) mais aucune facture fournisseur saisie : ajoutez-la pour planifier le paiement et déduire la TVA.", }, dueDate: { supplierFieldHint: "Vide : les factures prendront le délai légal par défaut de 60 jours, avec un avertissement.", savedNoTerms: "(délai légal par défaut de 60 jours : le fournisseur n'a pas de délai de paiement renseigné)", savedNotice: "Facture {number} enregistrée — échéance le {date}.", manual: "Échéance saisie manuellement.", noSupplierTerms: "Aucun délai de paiement renseigné pour {supplier} : échéance fixée au délai légal par défaut de 60 jours (Loi 69-21). Renseignez-le dans Fournisseurs pour qu'elle soit exacte la prochaine fois.", fromSupplier: "Échéance calculée : {days} jours, selon les conditions de {supplier}.", }, supplierDocs: { types: { other: "Autre", patente: "Patente / taxe professionnelle", rib: "RIB", cnss: "Attestation CNSS", rc: "Registre de commerce (RC)", attestation_fiscale: "Attestation de régularité fiscale", }, state: { ok: "Valide", expiring: "Expire bientôt", expired: "Expiré", }, alertHint: "L'équipe achats est alertée 30 jours avant l'expiration d'un document.", deleteConfirm: "Supprimer ce document ?", noExpiry: "Sans expiration", expiryDate: "Date d'expiration", issueDate: "Date d'émission", number: "Numéro", label: "Nom", type: "Type", add: "Ajouter un document", empty: "Aucun document.", title: "Documents fournisseur", }, statement: { types: { payment: "Règlement", credit_note: "Avoir", invoice: "Facture", }, balance: "Solde", credit: "Crédit", debit: "Débit", reference: "Référence", operation: "Opération", empty: "Aucun mouvement sur cette période.", closing: "Solde dû", settled: "Réglé / avoirs", invoiced: "Facturé", opening: "Solde d'ouverture", title: "Relevé fournisseur", }, restock: { suggested: "À commander", requested: "Demandé", incoming: "En commande", minimum: "Minimum", stock: "En stock", createOrder: "Créer le bon de commande", noSupplier: "Aucun prix fournisseur enregistré", empty: "Rien à réapprovisionner : tous les articles sont au-dessus de leur minimum ou déjà commandés.", subtitle: "Articles au niveau ou sous leur stock minimum, après ce qui est déjà commandé — regroupés par fournisseur le moins cher.", title: "Réapprovisionnement", }, reports: { withoutInvoiceReason: { overpaid: "payé au-delà du facturé", no_invoice: "aucune facture saisie", }, agedHint: "Basée sur les factures fournisseurs et leurs échéances — les commandes sans facture ne sont pas encore comptées.", withoutInvoiceHint: "La TVA se déduit sur FACTURE fournisseur. Ajoutez la facture sur le bon de commande (Factures → Ajouter une facture) et le paiement apparaîtra dans le relevé.", withoutInvoiceTitle: "{count} paiement(s) absent(s) de ce relevé", aged: { total: "Total dû", d90plus: "> 90 j", d61_90: "61–90 j", d31_60: "31–60 j", d1_30: "1–30 j", notDue: "Non échu", }, agedEmpty: "Rien n'est dû aux fournisseurs.", agedTitle: "Balance âgée fournisseurs", accounts: { a5161: "Caisse", a5141: "Banque", a4411: "Fournisseurs", a34552: "TVA récupérable", a6111: "Achats", }, accountingHint: "Factures, avoirs et règlements fournisseurs de la période en écritures comptables, selon le plan comptable marocain :", accountingTitle: "Export comptable (journal)", paymentDate: "Date de paiement", missingIds: "IF / ICE manquants", supplierIds: "IF / ICE fournisseur", vatEmpty: "Aucun règlement fournisseur sur cette période.", vatDeductible: "TVA déductible", vatHint: "Factures RÉGLÉES sur la période (la TVA se déduit au paiement), avec l'IF et l'ICE du fournisseur — à joindre à la déclaration de TVA.", vatTitle: "Relevé des déductions de TVA", downloadXlsx: "Télécharger Excel", subtitle: "Les fichiers pour votre comptable et votre déclaration de TVA.", title: "Rapports achats", }, compare: { hint: "Le moins cher par ligne en vert. Choisir un fournisseur crée le bon de commande et clôture les autres offres.", choose: "Choisir", incomplete: "Incomplète", title: "Comparaison des offres", button: "Comparer", created: "{count} demandes de prix créées (une par fournisseur). Utilisez « Comparer » quand ils auront répondu.", multiHint: "Une demande de prix par fournisseur ({count}) sera créée — vous pourrez comparer leurs réponses.", addSupplier: "Ajouter un fournisseur", suppliers: "Fournisseurs", }, email: { simulatedShort: "non envoyé (pas de SMTP)", simulated: "E-mail NON envoyé : aucun serveur d'e-mail n'est encore configuré. Il a été enregistré dans la boîte d'envoi — configurez SMTP dans le .env du backend pour envoyer réellement.", sent: "E-mail envoyé à {to}.", defaultMessageHint: "Laisser vide pour utiliser le message standard", message: "Message", cc: "Copie (CC)", to: "Destinataire", titleDp: "Envoyer {number} au fournisseur", title: "Envoyer {number} au fournisseur", send: "Envoyer par e-mail", }, approval: { approvedOn: "Approuvé le {date}", refusedBanner: "Approbation refusée : {reason}", waitingForApprover: "Un admin, le propriétaire ou le responsable des achats doit l'approuver.", pendingBanner: "En attente d'approbation depuis le {date}.", approvedNotice: "BC approuvé — il peut maintenant être envoyé au fournisseur.", requested: "Ce BC dépasse le seuil d'approbation : il a été soumis pour approbation. Les approbateurs ont été notifiés.", refuseReason: "Motif du refus", refuseTitle: "Refuser", refuse: "Refuser", approve: "Approuver", }, supplierInvoices: { title: "Factures fournisseurs", subtitle: "Toutes les factures fournisseurs par échéance — ce qui reste à payer et ce qui est en retard.", overdue: "En retard", overdueCount: "{count} facture(s)", dueIn30: "À payer sous 30 jours", empty: "Aucune facture ici.", filters: { unpaid: "À payer", overdue: "En retard", all: "Toutes" } }, legal: { needs_agreementHint: "Délai de paiement supérieur à 60 jours : autorisé seulement par accord écrit (Loi 69-21).", over_maxHint: "Délai de paiement supérieur à 120 jours : au-delà du maximum légal (Loi 69-21)." }, invoiceStatus: { overdue: "En retard de {days} j" }, invoices: { type: "Type", types: { invoice: "Facture", credit_note: "Avoir" }, applied: "Déduit" }, match: { notInvoiced: "Pas encore facturé", matched: "Conforme aux réceptions", toInvoice: "{amount} restent à facturer", overInvoiced: "{amount} facturés en trop", creditExpected: "Un avoir de {amount} est attendu du fournisseur pour la marchandise retournée.", overInvoicedHint: "Le fournisseur a facturé {amount} de plus que ce qui a été reçu et conservé — vérifiez la facture avant de payer." }, kpi: { ordered: "Commandé", received: "Réceptionné", ofOrder: "de la commande", invoiced: "Facturé (net)", paid: "Payé", settled: "Soldé" }, pdf: { download: "Télécharger le PDF" }, supplierSelect: { choose: "Choisir un fournisseur", none: "Aucun fournisseur — ajoutez-en un dans Achats > Fournisseurs", notInList: "absent de la liste des fournisseurs" }, supplierPrices: { open: "Prix et références fournisseurs", internalReference: "Référence interne", internalReferencePlaceholder: "ex. RM-GANTS-01", referenceLocked: "Seule la production peut modifier une référence interne existante.", referenceMissing: "Cet article n'a pas encore de référence interne — vous pouvez l'ajouter.", supplierReference: "Référence fournisseur", none: "Aucun prix fournisseur pour l'instant.", addSupplier: "Ajouter un fournisseur", noReference: "Sans référence" }, addToInventory: { button: "Ajouter à l'inventaire", title: "Ajouter cet article à l'inventaire", category: "Catégorie", referenceOptional: "Facultatif — peut être ajoutée plus tard", threshold: "Stock minimum (alerte)", stockNow: "{count} déjà reçu(s) seront mis en stock maintenant.", stockLater: "Les prochaines réceptions de cette ligne iront en stock.", confirm: "Ajouter à l'inventaire" }, errors: { load: "Impossible de charger les données.", save: "Impossible d'enregistrer cette modification." }, columns: { number: "Numéro", date: "Date", supplier: "Fournisseur", status: "Statut", payment: "Paiement", paid: "Payé", received: "Reçu", note: "Note", article: "Article", quantity: "Quantité", requestedBy: "Demandé par" }, filters: { missingInvoice: "Reçus sans facture", late: "Livraisons en retard", all: "Tous", number: "Numéro de BC" }, lines: { closed: "Soldée", complete: "Complète", closedBecause: "Soldée", receivedShort: "reçus", returnedShort: "retournés", expectedShort: "encore attendus", close: "Solder", closeHint: "Accepter la quantité reçue comme définitive — plus rien ne sera attendu sur cette ligne", reopen: "Rouvrir", closeTitle: "Solder la ligne", closeSummary: "{received} reçus sur {ordered} commandés — les {missing} manquants ne seront plus attendus.", closeReason: "Motif (facultatif)", closeReasonPlaceholder: "ex. reliquat annulé avec le fournisseur", closeEffect: "Quand toutes les lignes sont reçues ou soldées, le BC passe en « Réceptionné » et ses demandes d'achat sont clôturées. Vous pourrez rouvrir la ligne.", priceFromArticle: "Prix repris du prix fournisseur de l'article (inventaire) — modifiable si besoin", noPriceShort: "Aucun prix", pickSupplierForPrices: "Choisissez le fournisseur : les prix des articles seront repris de l'inventaire.", missingPrices: "{count} article(s) sans prix pour {supplier} dans l'inventaire — saisissez-le sur la ligne.", article: "Article", pickArticle: "Article de l'inventaire (facultatif)", description: "Désignation", descriptionPlaceholder: "Article ou prestation", quantity: "Qté", unit: "Unité", unitPrice: "Prix unitaire HT", quotedPrice: "Prix proposé HT", vat: "TVA", addLine: "Ajouter une ligne" }, totals: { ht: "Total HT", vat: "TVA", ttc: "Total TTC" }, orderStatus: { pending_approval: "En attente d'approbation", draft: "Brouillon", sent: "Commandé", partially_received: "Réception partielle", received: "Réceptionné", cancelled: "Annulé" }, paymentStatus: { unpaid: "Non payé", partially_paid: "Partiellement payé", paid: "Payé" }, requestStatus: { pending: "En attente", delayed: "Retardée", ordered: "Commandée", declined: "Refusée", received: "Reçue" }, priceStatus: { draft: "Brouillon", sent: "Envoyée", answered: "Répondue", accepted: "Acceptée", rejected: "Refusée" }, paymentMethods: { virement: "Virement", cheque: "Chèque", especes: "Espèces", effet: "Effet de commerce", carte: "Carte", autre: "Autre" }, summary: { missingInvoice: "Reçus sans facture", totalOrdered: "Total commandé (TTC)", totalPaid: "Total payé", remaining: "Reste à payer", overdue: "BC avec factures échues", byStatus: "BC par statut" }, requests: { title: "Demandes d'achat", subtitle: "Les demandes de la production. Traitez-les une par une, ou sélectionnez-en plusieurs pour créer un bon de commande.", createOrder: "Créer un bon de commande ({count})", empty: "Aucune demande d'achat ici.", select: "Sélectionner", stock: "Stock", threshold: "seuil", productionNote: "Note de la production", purchasingAnswer: "Réponse des achats", filters: { open: "À traiter", ordered: "Commandées", declined: "Refusées", received: "Reçues", all: "Toutes" }, actions: { ordered: "Marquer comme commandée", delayed: "Retarder (avec un motif)", declined: "Refuser (avec un motif)", note: "Ajouter une note pour la production" }, dialog: { linkOrder: "Lier à un bon de commande existant (facultatif)", noOrder: "— Sans lien (commandé autrement) —", notifyHint: "La production est notifiée de votre réponse.", orderedTitle: "Marquer comme commandée", orderedLabel: "Note (facultatif)", orderedPlaceholder: "ex. livraison prévue lundi", delayedTitle: "Retarder la demande", delayedLabel: "Pourquoi est-elle retardée ?", delayedPlaceholder: "ex. fournisseur en rupture jusqu'au 15", declinedTitle: "Refuser la demande", declinedLabel: "Motif du refus", declinedPlaceholder: "ex. article arrêté, utiliser la nouvelle référence", noteTitle: "Note pour la production", noteLabel: "Note", notePlaceholder: "ex. en attente du devis du fournisseur" } }, orders: { title: "Bons de commande", subtitle: "Commandes, réceptions, factures et paiements — le récapitulatif des achats.", new: "Nouveau bon de commande", empty: "Aucun bon de commande.", form: { editTitle: "Modifier le bon de commande", supplierRequired: "Choisissez un fournisseur.", pickSupplier: "Choisir un fournisseur", noSuppliers: "Aucun fournisseur actif — ajoutez-en un dans Fournisseurs.", expectedDate: "Livraison prévue", fromRequests: "Créé à partir de {count} demande(s) d'achat : l'enregistrement les lie et notifie la production.", saveDraft: "Enregistrer en brouillon", saveAndSend: "Enregistrer et marquer commandé", noCompany: "Ouvrez cette page depuis la liste des bons de commande." } }, detail: { paymentWithoutInvoice: "Payé, mais aucune facture fournisseur n'est encore saisie : ajoutez-la (Factures ci-dessus) pour que ce paiement compte dans le relevé de TVA et la balance âgée.", lines: "Lignes", addCreditNote: "Ajouter un avoir", creditNoteNumber: "N° d'avoir", dueDateAuto: "Laisser vide : date de facture + {days} jours (conditions du fournisseur)", expectedFromReceptions: "Attendu d'après les réceptions : {amount}", markSent: "Marquer comme commandé", cancelOrder: "Annuler le BC", deleteConfirm: "Supprimer ce brouillon ?", cancelledBecause: "Annulé", cancelReason: "Motif de l'annulation", cancelRequestsHint: "Les demandes d'achat de ce BC reviennent dans la file des achats.", ordered: "Commandé", received: "Reçu", returned: "Retourné", outstanding: "Reste à recevoir", kept: "Reçu et conservé", noStock: "hors stock (ligne libre)", receptions: "Réceptions et retours", receive: "Réceptionner", returnGoods: "Retour fournisseur", sendFirst: "Marquez le BC comme commandé avant de réceptionner.", receptionTitle: "Réceptionner la marchandise", returnTitle: "Retourner la marchandise au fournisseur", blNumber: "N° du bon de livraison (BL)", returnReference: "Référence du retour", scan: "Scan (facultatif)", file: "Fichier", stockInHint: "Les quantités reçues sont ajoutées à l'inventaire.", stockOutHint: "Les quantités retournées sont retirées de l'inventaire.", noReceptions: "Rien de réceptionné pour l'instant.", type: { reception: "Réception", return: "Retour" }, invoices: "Factures", addInvoice: "Ajouter une facture", invoiceNumber: "N° de facture", dueDate: "Échéance", amountTTC: "Montant TTC", noInvoices: "Aucune facture.", deleteInvoiceConfirm: "Supprimer cette facture ?", payments: "Paiements", addPayment: "Enregistrer un paiement", amount: "Montant", method: "Mode de paiement", paymentReference: "Référence", paymentReferencePlaceholder: "N° de chèque / virement", noPayments: "Aucun paiement.", deletePaymentConfirm: "Supprimer ce paiement ?", linkedRequests: "Demandes d'achat de ce BC" }, priceRequests: { noPricesHint: "Indiquez ce dont vous voulez le prix — c'est le fournisseur qui propose les prix dans sa réponse. Une ligne peut être un article de l'inventaire, ou simplement saisie pour un article que vous n'avez pas encore.", enterPricesHint: "Saisissez les prix de la réponse du fournisseur, puis créez le bon de commande — ou refusez-la.", title: "Demandes de prix", subtitle: "Demandez des devis aux fournisseurs, saisissez leurs prix, et transformez le meilleur en bon de commande.", new: "Nouvelle demande de prix", empty: "Aucune demande de prix.", deadline: "Réponse attendue le", quote: "Devis du fournisseur", uploadQuote: "Joindre le devis", markSent: "Marquer envoyée", markAnswered: "Marquer répondue", reject: "Refuser", convert: "Créer le bon de commande", deleteConfirm: "Supprimer cette demande de prix ?" }, suppliers: { title: "Fournisseurs", subtitle: "Vos fournisseurs et leurs coordonnées.", new: "Nouveau fournisseur", empty: "Aucun fournisseur.", search: "Rechercher", searchPlaceholder: "Nom, contact, ville, ICE…", active: "Actif", inactive: "Inactif", deleteConfirm: "Supprimer « {name} » ?", deactivated: "Ce fournisseur a des commandes : il a été désactivé au lieu d'être supprimé.", fields: { paymentDays: "Délai de paiement (jours)", name: "Raison sociale", contactName: "Contact", phone: "Téléphone", email: "E-mail", city: "Ville", address: "Adresse", ice: "ICE", identifiantFiscal: "Identifiant fiscal (IF)", rc: "Registre de commerce (RC)", paymentTerms: "Conditions de paiement" } }, history: { title: "Historique article", subtitle: "Tous les bons de commande et demandes d'un article de l'inventaire.", pickHint: "Choisissez un article pour voir son historique d'achat.", inStock: "En stock", orders: "Commandes", totalOrdered: "Total commandé", totalReceived: "Total reçu", averagePrice: "Prix moyen", lastPrice: "Dernier prix", noOrders: "Cet article ne figure sur aucun bon de commande.", noRequests: "Aucune demande d'achat pour cet article.", openForArticle: "Historique d'achat" } }, holidays: { title: "Jours fériés", subtitle: "Les jours fériés de l'année : l'entreprise travaille-t-elle, et comment les heures travaillées sont payées.", downloadTemplate: "Télécharger le modèle", import: "Importer Excel", add: "Ajouter un jour férié", year: "Année", howItWorks: "Chaque année : téléchargez le modèle (les fêtes à date fixe sont déjà remplies), ajoutez les fêtes religieuses avec leurs dates officielles, puis importez-le. Jour chômé : personne n'est attendu, et les heures de ceux qui pointent sont comptées en heures de jour férié. Paiement « double » : une heure supplémentaire payée par heure travaillée ; « normal » : aucune majoration.", importDone: "Import terminé : {created} ajouté(s), {updated} mis à jour.", namePlaceholder: "Nom du jour férié (ex. Aïd al-Fitr)", previewTitle: "Aperçu de {file}", previewErrors: "{count} ligne(s) à corriger — corrigez le fichier et importez-le à nouveau", previewReady: "{count} ligne(s) prêtes à importer", columns: { row: "Ligne", date: "Date", name: "Nom", open: "Entreprise", pay: "Paiement si travaillé", check: "Contrôle" }, defaultClosed: "Fermée (par défaut)", defaultDouble: "Double (par défaut)", open: "Ouverte", closed: "Fermée", payDouble: "Double", payNormal: "Normal", confirmImport: "Importer", emptyTitle: "Aucun jour férié pour {year}", emptyMessage: "Téléchargez le modèle, complétez-le et importez-le.", deleteTitle: "Supprimer le jour férié", deleteMessage: "Supprimer « {name} » ? Les pointages déjà enregistrés pour ce jour sont conservés.", errors: { load: "Impossible de charger les jours fériés.", save: "Impossible d'enregistrer cette modification.", template: "Impossible de télécharger le modèle.", read: "Impossible de lire ce fichier.", import: "L'import a échoué." } }, myDepartment: { adminTitle: "Accès par département", adminSubtitle: "Tous les départements que vous supervisez : leur responsable, les postes qui donnent accès au module et qui y a accès.", adminEmptyTitle: "Aucun département pour l'instant.", noManagerAssigned: "Aucun responsable désigné", title: "Mon département", subtitle: "Votre équipe, et les postes qui donnent accès au module du département.", loadError: "Impossible de charger votre département.", saveError: "Impossible d'enregistrer cette modification.", saved: "Enregistré.", accountsUpdated: "Enregistré — {count} compte(s) mis à jour.", emptyTitle: "Vous ne gérez encore aucun département.", positionsTitle: "Postes et accès", positionsHint: "Activez un poste pour donner à tous ses titulaires l'accès au module du département. Les autres ne voient que Mon espace.", noModule: "Ce département ne donne accès à aucun module : il n'y a pas d'accès à distribuer.", noPositions: "Aucun poste défini pour ce département.", holders: "{count} employé(s)", toggleLabel: "Donne accès au module", teamTitle: "Équipe", noEmployees: "Aucun employé dans ce département.", columns: { name: "Nom", jobTitle: "Poste", access: "Accès" }, noLogin: "Pas de compte", moduleAccess: "Accès module", mySpaceOnly: "Mon espace uniquement" },
    sidebar: { platform: "Plateforme", clients: "Clients", purchasingReports: "Rapports achats", restock: "Réapprovisionnement", supplierInvoices: "Factures fournisseurs", purchasing: "Achats", purchaseRequestsQueue: "Demandes d'achat", purchaseOrders: "Bons de commande", priceRequests: "Demandes de prix", suppliers: "Fournisseurs", purchasingInventory: "Inventaire", articleHistory: "Historique article", holidays: "Jours fériés", departmentAccess: "Accès par département", myDepartment: "Mon département", myRecords: "Mon dossier",
      leaveCalendar: "Calendrier des congés",
      performanceReviews: "Évaluations",
      disciplinaryActions: "Actions disciplinaires",
      admin: "Admin",
      settings: "Paramètres",
      help: "Aide & Support",
      profile: "Profil",
      hr: "Ressources humaines",

      companies: "Entreprises",
      organization: "Organisation",
      company: "Entreprise",
      employees: "Employés",
      payroll: "Paie",
      contracts: "Contrats",
      employeeDocuments: "Documents",
      attendance: "Présence",
      orgChart: "Organigramme",
      reports: "Rapports",
      auditLog: "Journal d'audit",
      mySpace: "Mon espace",
      myProfile: "Mon profil",
      myPayslips: "Mes bulletins de paie",
      myAbsences: "Mes absences",
      myAdvances: "Mes avances",
      myAttendance: "Ma présence",
      salaries: "Salaires",
      absences: "Absences",
      advances: "Avances",
      users: "Utilisateurs",
      workSchedule: "Horaires de travail",
      production: "Production",
      inventory: "Inventaire",
      purchaseRequests: "Demandes d'achat",
      inventorySettings: "Paramètres",
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

    common: { home: "Accueil", breadcrumb: "Fil d'Ariane", clear: "Effacer", clearSearch: "Effacer la recherche", nextPage: "Page suivante", previousPage: "Page précédente", pagination: "Pagination", hidePassword: "Masquer le mot de passe", showPassword: "Afficher le mot de passe", somethingWentWrong: "Une erreur est survenue", confirmAction: "Confirmer l'action", pageNotFoundHint: "Cette page n'existe pas ou a été déplacée.", pageNotFound: "Page introuvable", status: "Statut", save: "Enregistrer", back: "Retour",
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
      chooseFile: "Choisir un fichier",
      noFileChosen: "Aucun fichier choisi",
      dateFrom: "Du",
      dateTo: "Au",
    },

    profile: { loadFailed: "Impossible de charger le profil",
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

    company: { workflow: { accountInvalid: "Un compte comptable comporte 4 à 10 chiffres.", purchaseAccountHint: "Utilisé dans l'export comptable pour les articles dont la catégorie n'a pas de compte, et pour les lignes saisies (ex. 6111, 6121, 6125).", purchaseAccount: "Compte d'achat par défaut", purchaseThresholdHint: "Les BC d'un montant TTC supérieur ou égal doivent être approuvés par un admin, le propriétaire ou le responsable des achats avant d'être commandés. 0 = pas d'approbation.", purchaseThreshold: "Seuil d'approbation des bons de commande", title: "Circuit de validation", sequentialApproval: "Validation du manager avant les RH", sequentialApprovalHint: "Si activé, les demandes d'absence et d'avance doivent d'abord être validées par le manager de l'employé, puis recevoir la validation finale des RH. Les employés sans manager passent directement par les RH.", saveFailed: "Impossible d'enregistrer ce paramètre." },
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

      downloadFiche:
        "Télécharger la fiche",

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

        ficheDownloadFailed:
          "Erreur lors de la génération de la fiche de l'entreprise.",

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
      inheritedFromEmployee: "Le département et le rôle RH sont hérités de l'employé lié {name} ({department} — {jobTitle}). Pour les modifier, mettez à jour le Département ou le Poste de l'employé.",

      updateTitle: "Modifier l'utilisateur",
      updateSureMessage: "Voulez-vous vraiment enregistrer ces modifications ?",

      updateSuccessTitle: "Utilisateur mis à jour",
      updateSuccessMessage: "L'utilisateur a été mis à jour avec succès.",

      updateFailTitle: "Échec de la mise à jour",
      updateFailMessage: "Impossible de mettre à jour l'utilisateur. Veuillez réessayer.",

      hrRole: {
        label: "Poste RH",
        notApplicable: "Non applicable (hors RH)",
        assistant: "Assistant(e) RH",
        officer: "Chargé(e) RH",
        manager: "Responsable RH",
        director: "Directeur/Directrice RH",
      },

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

      documents: {
        menuButton: "Documents",
        attestationTravail: "Attestation de travail",
        attestationSalaire: "Attestation de salaire",
        certificatTravail: "Certificat de travail",
        contratTravail: "Contrat de travail",
        soldeToutCompte: "Reçu pour solde de tout compte",
        generationFailed: "Erreur lors de la génération du document.",
      },

      bulkImport: {
        exportButton: "Exporter (CSV)",
        exportFailed: "Impossible d'exporter les employés.",
        openButton: "Importer (CSV)",
        title: "Importer des employés en masse",
        helpText: "Téléversez un fichier CSV pour créer plusieurs employés à la fois. Chaque ligne est d'abord vérifiée — rien n'est créé avant votre confirmation.",
        downloadTemplate: "Télécharger le modèle CSV",
        preview: "Vérifier le fichier",
        previewing: "Vérification...",
        previewFailed: "Impossible de lire ce fichier.",
        summaryValid: "{count} prêt(s) à importer",
        summaryErrors: "{count} avec des erreurs",
        summaryWarnings: "{count} avec des avertissements",
        rowOk: "Tout est correct",
        fixErrorsFirst: "Corrigez les lignes en erreur et retéléversez le fichier avant d'importer — les lignes avec seulement des avertissements seront quand même importées.",
        importButton: "Importer {count} employé(s)",
        committing: "Importation...",
        commitFailed: "Impossible de terminer l'importation.",
        commitSuccess: "{count} employé(s) importé(s) avec succès.",
      },

      fields: { manager: "Responsable (N+1)", noManagerCandidates: "Aucun autre employé dans cette entreprise",
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
        noDepartments: "Aucun département défini pour l'instant — ajoutez-en un depuis Organisation > Départements",

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
        createLogin: "Accès self-service",
        createLoginCheckboxLabel: "Créer aussi un accès self-service pour cet employé (utilise son e-mail professionnel)",
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

      linkedUser: {
        title: "Accès self-service",
        linkedTo: "Lié à :",
        link: "Lier",
        unlink: "Délier",
        linkTitle: "Lier un compte utilisateur",
        linkSureMessage: "Lier ce compte utilisateur à cet employé ? Il aura accès à Mon espace (bulletins de paie, demandes d'absence/avance, présence).",
        unlinkTitle: "Délier le compte utilisateur",
        unlinkSureMessage: "Délier ce compte utilisateur de cet employé ? Il perdra l'accès à Mon espace.",
        searchPlaceholder: "Rechercher des utilisateurs par nom ou e-mail...",
        actionFailed: "Une erreur est survenue. Veuillez réessayer.",
        orCreateNew: "ou",
        createLogin: "Créer un nouvel accès",
        createLoginTitle: "Créer un accès",
        createLoginSureMessage: "Créer un nouvel accès self-service pour cet employé ? Un mot de passe temporaire sera généré et affiché une seule fois — pensez à le noter.",
        loginCreatedTitle: "Accès créé",
        loginCreatedMessage: "E-mail : {email}\nMot de passe temporaire : {password}\n\nPartagez-le avec l'employé — il ne sera plus affiché ensuite. Il devra le changer après sa première connexion (depuis sa page Profil).",
        loginNotCreatedTitle: "Employé créé, mais pas encore d'accès",
        resetPassword: "Réinitialiser le mot de passe",
        resetPasswordTitle: "Réinitialiser le mot de passe",
        resetPasswordSureMessage: "Générer un nouveau mot de passe temporaire pour le compte de cet employé ? Son mot de passe actuel cessera de fonctionner immédiatement.",
      },

      related: {
        empty: "Rien à afficher pour le moment.",
        tabs: {
          salary: "Salaire",
          absences: "Absences",
          advances: "Avances",
          contracts: "Contrats",
          documents: "Documents",
          attendance: "Présence",
        },
      },
    },
    workSchedule: { shiftType: "Type d'horaire", continuous: "Journée continue", split: "Journée coupée (pause de midi)", continuousHint: "Les employés pointent une fois à l'arrivée et une fois au départ, ex. 09:00 → 16:00. Tout temps travaillé au-delà des heures prévues compte en heures supplémentaires.", splitHint: "Les employés pointent deux fois à l'arrivée et deux fois au départ, ex. 08:00 → 12:00 et 14:00 → 18:00. La pause de midi n'est pas comptée ; les heures supplémentaires sont calculées au-delà des heures prévues, et le retard est vérifié aux deux arrivées.", morningIn: "Arrivée", middayOut: "Sortie midi", middayIn: "Retour midi", finalOut: "Départ", scheduledHours: "Heures", applyToAll: "Copier les horaires de ce jour sur tous les jours travaillés", applyToAllShort: "Appliquer à tous", invalidTimes: "les heures doivent se suivre (arrivée, sortie midi, retour midi, puis départ).", invalidShort: "Vérifier les heures",
      title: "Horaires de travail",
      subtitle: "Définissez les heures d'arrivée attendues, les heures de travail et les tolérances par jour — utilisées pour calculer les retards et les heures supplémentaires.",
      fields: { day: "Jour", workingDay: "Jour travaillé", startTime: "Heure de début", workHours: "Heures de travail", grace: "Tolérance (min)" },
      days: {
        monday: "Lundi", tuesday: "Mardi", wednesday: "Mercredi", thursday: "Jeudi",
        friday: "Vendredi", saturday: "Samedi", sunday: "Dimanche",
      },
      working: "Jour travaillé",
      dayOff: "Jour de repos",
      hoursUnit: "h",
      minutesUnit: "min",
      footnote: "Pointer après l'heure de début plus la tolérance marque la journée comme « en retard ». Les heures supplémentaires correspondent à tout ce qui est travaillé au-delà des heures configurées.",
      savedTitle: "Horaires enregistrés",
      savedMessage: "Les horaires de travail ont été mis à jour avec succès.",
      saveFailed: "Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.",
      hoursManagement: {
        title: "Gestion des heures",
        subtitle: "Contrôlez comment la présence affecte la paie — chaque option ci-dessous est indépendante.",
        payOvertime: "Payer les heures supplémentaires",
        payOvertimeHint: "Ajoute une rémunération pour les heures travaillées au-delà des heures prévues.",
        deductLateArrival: "Déduire pour retard",
        deductLateArrivalHint: "Réduit la rémunération pour le temps perdu à cause des retards.",
        deductEarlyLeave: "Déduire pour départ anticipé",
        deductEarlyLeaveHint: "Réduit la rémunération pour le temps perdu en partant avant l'heure de fin prévue.",
        deductionRate: "Taux de déduction",
        deductionRateHint: "Multiplicateur appliqué au taux horaire pour les déductions de retard/départ anticipé — 1× correspond à une déduction directe du temps non travaillé.",
        monthlyStandardHours: "Heures mensuelles standard",
        monthlyStandardHoursHint: "Utilisé pour calculer le taux horaire à partir du salaire de base (salaire de base ÷ ce nombre).",
        rateSuffix: "×",
      },
    },


    production: {
      title: "Production",
    },

    inventory: {
      title: "Inventaire",
      subtitle: "Suivez le stock, les seuils et les prix fournisseurs.",
      addProduct: "Ajouter un produit",
      editProduct: "Modifier le produit",
      searchPlaceholder: "Rechercher par nom ou référence...",
      lowStockOnly: "Stock faible uniquement",
      lowStock: "Stock faible",
      asOfDate: "À la date du",
      viewingAsOf: "Affichage de l'inventaire au {date}.",
      deleteTitle: "Supprimer le produit",
      deleteSureMessage: "Voulez-vous vraiment supprimer ce produit ? Son historique de mouvements sera également supprimé. Cette action est irréversible.",
      emptyTitle: "Aucun produit",
      emptyMessage: "Ajoutez votre premier produit pour commencer à suivre l'inventaire.",
      purchaseRequestSuccess: "Demande d'achat soumise avec succès.",
      fields: {
        category: "Rubrique", selectCategory: "Sélectionner une rubrique", name: "Nom",
        internalReference: "Référence interne", quantity: "Quantité", unit: "Unité",
        threshold: "Seuil", sellingPrice: "Prix de vente", image: "Image",
        prices: "Prix fournisseurs", supplierName: "Fournisseur", price: "Prix",
        supplierReference: "Référence fournisseur", reason: "Motif", notes: "Notes",
        search: "Recherche", orderedQuantity: "Quantité commandée",
      },
      actions: {
        add: "Ajouter au stock", remove: "Retirer du stock", requestPurchase: "Demander l'achat",
        submitRequest: "Envoyer la demande",
      },
      errors: {
        fetchFailed: "Échec du chargement de l'inventaire", saveFailed: "Une erreur est survenue lors de l'enregistrement.",
        deleteFailed: "Une erreur est survenue lors de la suppression.", adjustFailed: "Une erreur est survenue lors de la mise à jour de la quantité.",
        missingFields: "Veuillez renseigner la rubrique, le nom et la référence interne.",
        invalidQuantity: "Veuillez saisir une quantité valide.", purchaseRequestFailed: "Une erreur est survenue lors de l'envoi de la demande.",
      },
    },

    inventorySettings: {
      title: "Paramètres de l'inventaire",
      subtitle: "Définissez les rubriques utilisées dans votre inventaire.",
      addCategory: "Ajouter une rubrique",
      editCategory: "Modifier la rubrique",
      deleteTitle: "Supprimer la rubrique",
      deleteSureMessage: "Voulez-vous vraiment supprimer cette rubrique ? Les produits qui l'utilisent encore doivent d'abord être réaffectés ou supprimés.",
      emptyTitle: "Aucune rubrique",
      emptyMessage: "Ajoutez votre première rubrique d'inventaire (ex. « Matière première », « Produit fini »).",
      fields: { fixedAssetOff: "Non — TVA en 34552", fixedAssetOn: "Oui — TVA en 34551", fixedAsset: "Immobilisation", accountingAccountHint: "Compte des achats de cette catégorie dans l'export comptable — ex. 6121 matières premières, 6122 matières consommables, 2332 matériel. Vide : compte par défaut de l'entreprise.", accountingAccount: "Compte comptable (achats)",
        name: "Nom", namePlaceholder: "ex. Matière première",
        icon: "Icône", description: "Description", descriptionPlaceholder: "Facultatif",
      },
      errors: {
        nameRequired: "Le nom de la rubrique est requis", saveFailed: "Une erreur est survenue lors de l'enregistrement.",
        deleteFailed: "Une erreur est survenue lors de la suppression.",
      },
    },

    purchaseRequests: {
      title: "Demandes d'achat",
      subtitle: "Les demandes de réapprovisionnement envoyées aux Achats, et leur réponse.",
      emptyTitle: "Aucune demande d'achat",
      emptyMessage: "Aucune demande d'achat ne correspond à vos filtres.",
      markReceived: "Marquer comme reçue",
      fields: { product: "Produit", quantity: "Quantité", requestedBy: "Demandé par" },
      status: { received: "Reçue" },
    },

    departments: { noManagerBadge: "Sans responsable", managerLabel: "Responsable", moduleAccessBadge: "Accès module",
      title: "Départements",
      subtitle: "Définissez les départements de votre organisation et les postes qui les composent.",
      addDepartment: "Ajouter un département",
      addDefaults: "Ajouter des départements par défaut",
      defaultsModal: {
        title: "Ajouter des départements par défaut",
        helpText: "Choisissez les départements à ajouter — chacun est créé avec un nom, une description standard et (pour RH/Production) l'accès au module déjà défini. Vous pourrez toujours les modifier ou en ajouter d'autres ensuite.",
        adding: "Ajout en cours...",
        addButton: "Ajouter {count} département(s)",
      },
      editDepartment: "Modifier le département",
      addPosition: "Ajouter un poste",
      editPosition: "Modifier le poste",
      deleteTitle: "Supprimer le département",
      deleteSureMessage: "Voulez-vous vraiment supprimer ce département ? Les employés et postes qui l'utilisent encore doivent d'abord être réaffectés.",
      deletePositionTitle: "Supprimer le poste",
      deletePositionSureMessage: "Voulez-vous vraiment supprimer ce poste ? Les employés qui l'occupent encore, ou les autres postes qui lui sont rattachés, doivent d'abord être réaffectés.",
      emptyTitle: "Aucun département",
      emptyMessage: "Ajoutez votre premier département pour commencer à structurer votre organisation.",
      searchPlaceholder: "Rechercher un département...",
      noSearchResults: "Aucun département ne correspond à votre recherche.",
      noPositions: "Aucun poste défini dans ce département pour l'instant.",
      fields: { purchasingAccess: "Accès au module Achats", manager: "Responsable du département", noManager: "Aucun responsable", managerHint: "Supervise tout le département : accès complet au module, valide les demandes de l'équipe et décide quels postes donnent accès au module.", grantsModuleAccess: "Donne accès au module", grantsModuleAccessHint: "Les titulaires de ce poste accèdent au module du département (ex. RH ou Inventaire). Laissez désactivé pour le personnel qui ne doit voir que Mon espace.",
        name: "Nom", description: "Description", permissionKey: "Accès au module",
        permissionKeyHint: "Facultatif — à définir sur UN SEUL département si les employés qui y travaillent (et leurs accès créés automatiquement) doivent avoir accès au module RH ou Production. La plupart des départements doivent rester sur « Aucun accès spécial ».",
        category: "Fonction",
        noCategory: "Aucune fonction spécifique",
        categoryHint: "Facultatif — permet au formulaire employé de suggérer des intitulés de poste standard pour ce département au lieu de laisser un champ libre. Une simple suggestion, sans lien avec les accès contrairement au champ Accès au module ci-dessus.",
        noSpecialAccess: "Aucun accès spécial", hrAccess: "Accès au module RH", productionAccess: "Accès au module Production",
        positionTitle: "Intitulé du poste", reportsTo: "Rattaché à", noReportsTo: "Aucun (poste de tête)",
        salaryMin: "Salaire — min", salaryMax: "Salaire — max", salaryBand: "Fourchette salariale",
        requiredSkills: "Compétences requises", requiredSkillsPlaceholder: "Séparées par des virgules, ex. Excel, Leadership",
      },
      errors: {
        nameRequired: "Le nom du département est requis", titleRequired: "L'intitulé du poste est requis",
        saveFailed: "Une erreur est survenue lors de l'enregistrement.", deleteFailed: "Une erreur est survenue lors de la suppression.",
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

      history: { deleteRecord: "Supprimer cet historique de salaire",
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
        reviewComment: "Commentaire de révision",
        status: "Statut",
      },

      types: {
        paid_leave: "Congé payé",
        unpaid_leave: "Congé sans solde",
        sick_leave: "Congé maladie",
        absence: "Absence",
        other: "Autre",
      },

      status: { manager_approved: "Validée par le manager",
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
        reviewComment: "Commentaire de révision",
        status: "Statut",
      },

      status: { manager_approved: "Validée par le manager",
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
    payroll: {
      title: "Paie",
      subtitle: "Générez la paie mensuelle et gérez les bulletins de salaire.",
      generateRun: "Générer la paie",
      createTitle: "Générer un cycle de paie",
      createSureMessage: "Générer la paie pour cette période ? Un bulletin sera créé pour chaque employé actif ayant un salaire enregistré.",
      createSuccessTitle: "Cycle de paie créé",
      createSuccessMessage: "Le cycle de paie a été généré avec succès.",
      completeTitle: "Clôturer le cycle de paie",
      completeSureMessage: "Clôturer ce cycle de paie ? Une fois clôturés, les bulletins sont verrouillés et les employés sont notifiés.",
      deleteTitle: "Supprimer le cycle de paie",
      deleteSureMessage: "Supprimer ce cycle de paie (brouillon) et tous ses bulletins ? Cette action est irréversible.",
      emptyTitle: "Aucun cycle de paie",
      emptyMessage: "Générez le premier cycle de paie pour cette entreprise.",
      noPayslips: "Aucun bulletin dans ce cycle.",
      fields: { month: "Mois", year: "Année", status: "Statut" },
      table: { period: "Période", employees: "Employés", gross: "Brut", net: "Net", searchPlaceholder: "Rechercher des employés..." },
      status: { draft: "Brouillon", completed: "Clôturé", voided: "Annulé" },
      payslipStatus: { draft: "Brouillon", validated: "Validé", paid: "Payé" },
      actions: { view: "Voir", complete: "Clôturer", regenerate: "Régénérer", markPaid: "Marquer comme payé", downloadPdf: "Télécharger le bulletin" },
      exports: {
        cnss: "Export CNSS",
        cnssHint: "Feuille de déclaration — à vérifier avec le format Damancom actuel avant téléversement",
        register: "État de paie",
        bankTransfer: "Fichier de virement",
      },
      buttons: { generate: "Générer", saving: "Enregistrement..." },
      breadcrumbs: { hr: "RH", payroll: "Paie" },
      months: ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
      errors: { fetchFailed: "Échec du chargement des cycles de paie", actionFailed: "Une erreur est survenue. Veuillez réessayer." },
    },

    contracts: {
      title: "Contrats",
      subtitle: "Suivez les contrats de travail, leurs renouvellements et leurs échéances.",
      addContract: "Nouveau contrat",
      createTitle: "Nouveau contrat",
      createSureMessage: "Voulez-vous vraiment créer ce contrat ?",
      createSuccessTitle: "Contrat créé",
      createSuccessMessage: "Le contrat a été créé avec succès.",
      renewTitle: "Renouveler le contrat",
      renewSureMessage: "Renouveler ce contrat ? Le contrat actuel sera clôturé et un nouveau démarrera.",
      deleteTitle: "Supprimer le contrat",
      deleteSureMessage: "Voulez-vous vraiment supprimer ce contrat ? Cette action est irréversible.",
      emptyTitle: "Aucun contrat",
      emptyMessage: "Cette entreprise n'a pas encore de contrat enregistré.",
      expiringBanner: "{count} contrat(s) arrivant à échéance dans les 30 jours.",
      fields: { employee: "Employé", type: "Type de contrat", startDate: "Date de début", endDate: "Date de fin" },
      status: { active: "Actif", expired: "Expiré", terminated: "Résilié", renewed: "Renouvelé" },
      actions: { renew: "Renouveler" },
      buttons: { create: "Enregistrer le contrat" },
      breadcrumbs: { hr: "RH", contracts: "Contrats" },
      errors: { fetchFailed: "Échec du chargement des contrats", actionFailed: "Une erreur est survenue. Veuillez réessayer." },
    },

    documents: {
      title: "Documents",
      subtitle: "Stockez les documents des employés et suivez leurs échéances.",
      uploadDocument: "Téléverser un document",
      editDocument: "Modifier le document",
      deleteTitle: "Supprimer le document",
      deleteSureMessage: "Voulez-vous vraiment supprimer ce document ? Cette action est irréversible.",
      emptyTitle: "Aucun document",
      emptyMessage: "Cette entreprise n'a pas encore de document enregistré.",
      expiringBanner: "{count} document(s) arrivant à échéance dans les 30 jours.",
      fields: { employee: "Employé", type: "Type", label: "Libellé", labelPlaceholder: "ex. Carte d'identité nationale", expiryDate: "Date d'expiration", file: "Fichier", replaceFile: "Remplacer le fichier (facultatif)" },
      table: { file: "Fichier" },
      types: {
        cin: "CIN", passport: "Passeport", work_permit: "Permis de travail",
        residence_permit: "Titre de séjour", contract: "Contrat", diploma: "Diplôme",
        cv: "CV", medical_certificate: "Certificat médical", other: "Autre",
      },
      actions: { view: "Voir", loadMore: "Charger plus", loadMoreCount: "{loaded} sur {total} affichés" },
      buttons: { upload: "Téléverser" },
      breadcrumbs: { hr: "RH", documents: "Documents" },
      errors: {
        fetchFailed: "Échec du chargement des documents", actionFailed: "Une erreur est survenue. Veuillez réessayer.",
        missingFields: "Veuillez choisir un employé et un fichier.", uploadFailed: "Échec du téléversement du document.",
      },
    },

    attendance: {
      title: "Présence",
      subtitle: "Consultez les pointages d'entrée et de sortie.",
      emptyTitle: "Aucun pointage",
      emptyMessage: "Aucun pointage ne correspond à vos filtres.",
      filterAllEmployees: "Tous les employés",
      fields: { employee: "Employé", date: "Date", clockIn: "Entrée", clockOut: "Sortie", notes: "Notes" },
      status: { present: "Présent", late: "En retard", absent: "Absent", half_day: "Demi-journée", holiday: "Jour férié" },
      breadcrumbs: { hr: "RH", attendance: "Présence" },
      errors: { fetchFailed: "Échec du chargement des présences" },
    },

    reports: { chart: { zoomHint: "Faites glisser les poignées sous le graphique pour zoomer", yearly: "Annuel", monthly: "Mensuel", view: "Affichage", lastMonths: "{n} derniers mois", range: "Période", },
      title: "Rapports",
      subtitle: "Effectif, turnover, absentéisme et évolution de la masse salariale.",
      stats: { totalHeadcount: "Effectif total", activeEmployees: "Employés actifs", currentGross: "Brut mensuel actuel (est.)", currentNet: "Net mensuel actuel (est.)", missingSalaryNote: "{count} employé(s) actif(s) n'ont pas encore de salaire enregistré — non inclus dans cette estimation." },
      expand: "Agrandir",
      charts: {
        headcountByDepartment: "Effectif par département", turnover: "Turnover (12 derniers mois)",
        hires: "Embauches", terminations: "Départs", absenteeism: "Taux d'absentéisme (6 derniers mois)",
        absenteeismRate: "Taux d'absentéisme", payrollCost: "Masse salariale (12 derniers mois)",
        estimatedFootnote: "* Le mois en cours, marqué d'un astérisque, est une estimation en direct basée sur les salaires actuels — la paie n'a pas encore été exécutée pour cette période.",
      },
      breadcrumbs: { hr: "RH", reports: "Rapports" },
      loadError: "Certaines données du rapport n'ont pas pu être chargées. Veuillez réessayer, ou consulter la console pour plus de détails.",
      rankings: {
        title: "Classement des employés",
        last30Days: "30 derniers jours",
        last90Days: "90 derniers jours",
        last365Days: "12 derniers mois",
        mostAbsenceDays: "Le plus de jours d'absence",
        bestAttendanceRate: "Meilleur taux de présence",
        mostOvertimeHours: "Le plus d'heures supplémentaires",
        mostLateDays: "Le plus de retards",
        noData: "Aucune donnée pour cette période.",
        days: "jours",
      },
    },

    auditLog: {
      title: "Journal d'audit",
      subtitle: "Qui a changé quoi, et quand.",
      deleteTitle: "Supprimer l'entrée du journal",
      deleteSureMessage: "Voulez-vous vraiment supprimer cette entrée du journal d'audit ? Cette action est irréversible.",
      emptyTitle: "Aucune activité",
      emptyMessage: "Aucune modification n'a encore été enregistrée pour ce filtre.",
      fields: { action: "Action", resourceType: "Type", resource: "Enregistrement", actor: "Par", date: "Date" },
      resourceTypes: {
        Employee: "Employé", Salary: "Salaire", Absence: "Absence", Advance: "Avance",
        Contract: "Contrat", EmployeeDocument: "Document", PayrollRun: "Cycle de paie", WorkSchedule: "Horaires de travail",
      },
      actions: { create: "Créé", update: "Modifié", delete: "Supprimé", review: "Examiné" },
      breadcrumbs: { hr: "RH", auditLog: "Journal d'audit" },
      errors: { actionFailed: "Cette action a échoué. Veuillez réessayer.", fetchFailed: "Échec du chargement du journal d'audit" },
    },

    orgChart: {
      title: "Organigramme",
      subtitle: "Structure hiérarchique, construite à partir du responsable de chaque employé.",
      emptyTitle: "Aucun organigramme",
      emptyMessage: "Définissez un responsable pour les employés afin de construire la structure hiérarchique.",
      breadcrumbs: { hr: "RH", orgChart: "Organigramme" },
    },

    mySpace: {
      title: "Mon espace",
      subtitle: "Votre profil, vos bulletins de paie et vos demandes.",
      tabs: { profile: "Profil", payslips: "Bulletins de paie", absences: "Absences", advances: "Avances", attendance: "Présence", records: "Dossier" },
      records: {
        performanceReviews: "Évaluations de performance",
        disciplinaryActions: "Dossier disciplinaire",
        noReviews: "Vous n'avez encore aucune évaluation de performance.",
        noDisciplinaryActions: "Vous n'avez aucune action disciplinaire enregistrée.",
        reviewedBy: "Évalué par",
        acknowledge: "Accuser réception",
        acknowledgeTitle: "Accuser réception",
        acknowledgeReviewMessage: "Ceci confirme que vous avez lu cette évaluation de performance. Continuer ?",
        acknowledgeDisciplineMessage: "Ceci confirme que vous avez lu cette fiche. Continuer ?",
        loadError: "Échec du chargement de votre dossier.",
        acknowledgeError: "Erreur lors de l'accusé de réception.",
      },
      leaveBalance: { title: "Solde de congés payés", accrued: "Acquis", used: "Utilisé", remaining: "Restant" },
      teamRequests: { advance: "Avance sur salaire", days: "{count} jour(s)", reviewFailed: "Impossible d'enregistrer cette décision. Veuillez réessayer.", title: "Demandes en attente de votre équipe" },
      payslips: { emptyTitle: "Aucun bulletin de paie", emptyMessage: "Vos bulletins de paie apparaîtront ici une fois la paie effectuée." },
      absences: { cancelTitle: "Annuler la demande", cancelSureMessage: "Annuler cette demande d'absence ?" },
      attendance: { holidayToday: "Jour férié aujourd'hui : {name}", holidayDouble: "heures travaillées payées double", clockOutLunch: "Pointer la pause", clockInAfternoon: "Pointer le retour", dayComplete: "Journée terminée ✓", scheduleToday: "Aujourd'hui", restDay: "Jour de repos", morning: "Matin", afternoon: "Après-midi", punchFailed: "Impossible d'enregistrer ce pointage. Veuillez réessayer.", todayStatus: "Aujourd'hui", clockIn: "Entrée", clockOut: "Sortie" },
    },

    notifications: {
      title: "Notifications",
      empty: "Aucune notification.",
      markAllRead: "Tout marquer comme lu",
      now: "à l'instant",
      minutesShort: "min",
      hoursShort: "h",
      daysShort: "j",
    },

    units: {
      unit: "Unité",
      piece: "Pièce",
      pair: "Paire",
      dozen: "Douzaine",
      set: "Ensemble",
      kg: "Kilogramme (kg)",
      g: "Gramme (g)",
      t: "Tonne (t)",
      lb: "Livre (lb)",
      oz: "Once (oz)",
      quintal: "Quintal (q)",
      l: "Litre (L)",
      ml: "Millilitre (mL)",
      m3: "Mètre cube (m³)",
      gal: "Gallon (gal)",
      m: "Mètre (m)",
      cm: "Centimètre (cm)",
      mm: "Millimètre (mm)",
      km: "Kilomètre (km)",
      ft: "Pied (ft)",
      in: "Pouce (in)",
      yd: "Yard (yd)",
      m2: "Mètre carré (m²)",
      ft2: "Pied carré (ft²)",
      ha: "Hectare (ha)",
      box: "Boîte",
      carton: "Carton",
      pallet: "Palette",
      bag: "Sac",
      sack: "Sac",
      bottle: "Bouteille",
      can: "Boîte de conserve",
      roll: "Rouleau",
      sheet: "Feuille",
      bundle: "Faisceau",
      case: "Caisse",
      drum: "Fût",
      barrel: "Baril",
      container: "Conteneur",
      hour: "Heure",
      day: "Jour",
      month: "Mois",
    },

    contentTranslation: {
      title: "Traductions",
      editButton: "Traductions",
      original: "Original",
      auto: "Traduit automatiquement",
      manual: "Modifié manuellement",
      missing: "Pas encore traduit",
      regenerate: "Régénérer",
      originalHint: "Ceci est le texte original — modifiez le champ lui-même pour le changer.",
      save: "Enregistrer",
      saving: "Enregistrement…",
      close: "Fermer",
      placeholder: "Saisissez la traduction…",
      errors: {
        loadFailed: "Échec du chargement des traductions.",
        saveFailed: "Échec de l'enregistrement de la traduction.",
        regenerateFailed: "Échec de la régénération de la traduction.",
      },
    },
  twoFactor: { qrAlt: "QR code 2FA",
    title: "Authentification à deux facteurs",
    disabledHint: "Ajoutez une couche de sécurité supplémentaire à votre compte — après votre mot de passe, un code provenant d'une application d'authentification sera aussi requis pour vous connecter.",
    enabledHint: "L'authentification à deux facteurs est activée sur votre compte. Un code de votre application d'authentification vous sera demandé à chaque connexion.",
    enableButton: "Activer l'authentification à deux facteurs",
    disableButton: "Désactiver l'authentification à deux facteurs",
    disabling: "Désactivation...",
    scanTitle: "Scannez le code QR",
    scanHint: "Scannez-le avec une application d'authentification (Google Authenticator, Authy, etc.), puis saisissez le code à 6 chiffres affiché pour confirmer.",
    manualEntryLabel: "Impossible de scanner ? Saisissez ce code manuellement :",
    confirmAndEnable: "Confirmer et activer",
    verifying: "Vérification...",
    backupCodesTitle: "Enregistrez vos codes de secours",
    backupCodesHint: "Chaque code peut être utilisé une fois pour vous connecter si vous perdez l'accès à votre application d'authentification. Conservez-les en lieu sûr — ils ne seront plus jamais affichés.",
    copyBackupCodes: "Copier les codes",
    copied: "Copié",
    iSavedThem: "J'ai enregistré ces codes",
    confirmPasswordLabel: "Confirmez votre mot de passe pour continuer",
    errors: {
      statusFailed: "Impossible de vérifier l'état de l'authentification à deux facteurs.",
      setupFailed: "Impossible de démarrer la configuration de l'authentification à deux facteurs.",
      invalidCode: "Ce code ne correspond pas — vérifiez votre application d'authentification et réessayez.",
      disableFailed: "Impossible de désactiver l'authentification à deux facteurs.",
    },
  },

  disciplinaryActions: {
    title: "Actions disciplinaires",
    subtitle: "Suivez les avertissements et mesures correctives émis aux employés.",
    addAction: "Ajouter une fiche",
    editAction: "Modifier la fiche",
    emptyTitle: "Aucune action disciplinaire",
    emptyMessage: "Cette entreprise n'a aucune action disciplinaire enregistrée.",
    deleteTitle: "Supprimer la fiche",
    deleteSureMessage: "Êtes-vous sûr de vouloir supprimer cette fiche ? Cette action est irréversible.",
    acknowledged: "Accusé de réception",
    notAcknowledged: "Non encore accusé",
    breadcrumbs: {
      hr: "RH",
      disciplinaryActions: "Actions disciplinaires",
    },
    fields: {
      employee: "Employé",
      type: "Type",
      date: "Date",
      reason: "Motif",
      description: "Description",
      suspensionDays: "Suspension (jours)",
      issuedBy: "Émis par",
      notes: "Notes",
    },
    types: {
      verbal_warning: "Avertissement verbal",
      written_warning: "Avertissement écrit",
      final_warning: "Dernier avertissement",
      suspension: "Mise à pied",
      termination_notice: "Notification de licenciement",
    },
    errors: {
      fetchFailed: "Échec du chargement des actions disciplinaires",
      saveFailed: "Erreur lors de l'enregistrement",
      deleteFailed: "Erreur lors de la suppression",
    },
  },
  performanceReviews: {
    title: "Évaluations de performance",
    subtitle: "Cycles d'évaluation, objectifs et notes pour vos employés.",
    addReview: "Nouvelle évaluation",
    editReview: "Modifier l'évaluation",
    emptyTitle: "Aucune évaluation pour l'instant",
    emptyMessage: "Cette entreprise n'a aucune évaluation enregistrée.",
    deleteTitle: "Supprimer l'évaluation",
    deleteSureMessage: "Êtes-vous sûr de vouloir supprimer cette évaluation ? Cette action est irréversible.",
    reviewedBy: "Évalué par",
    submitButton: "Envoyer à l'employé",
    breadcrumbs: {
      hr: "RH",
      performanceReviews: "Évaluations",
    },
    fields: {
      employee: "Employé",
      reviewer: "Évaluateur",
      periodLabel: "Période d'évaluation",
      periodLabelPlaceholder: "ex. Évaluation annuelle 2026",
      reviewDate: "Date d'évaluation",
      goals: "Objectifs (un par ligne)",
      goalsPlaceholder: "Améliorer le temps de réponse sur les tickets\nTerminer la certification d'intégration",
      strengths: "Points forts",
      areasForImprovement: "Axes d'amélioration",
      comments: "Commentaires",
    },
    criteria: {
      jobKnowledge: "Connaissance du poste",
      qualityOfWork: "Qualité du travail",
      communication: "Communication",
      teamwork: "Travail d'équipe",
      initiative: "Initiative",
      punctuality: "Ponctualité",
    },
    statuses: {
      draft: "Brouillon",
      submitted: "Envoyée",
      acknowledged: "Accusée réception",
    },
    errors: {
      fetchFailed: "Échec du chargement des évaluations",
      saveFailed: "Erreur lors de l'enregistrement",
      submitFailed: "Erreur lors de l'envoi",
      deleteFailed: "Erreur lors de la suppression",
    },
  },
  leaveCalendar: {
    title: "Calendrier des congés",
    subtitle: "Visualisez en un coup d'œil qui est en congé approuvé.",
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    breadcrumbs: {
      hr: "RH",
      leaveCalendar: "Calendrier des congés",
    },
    weekdays: {
      0: "Lun",
      1: "Mar",
      2: "Mer",
      3: "Jeu",
      4: "Ven",
      5: "Sam",
      6: "Dim",
    },
    errors: {
      fetchFailed: "Échec du chargement du calendrier des congés",
    },
  },
  },

  // ======================================================
  // ARABIC
  // ======================================================

  ar: { login: { useBackupCode: "استخدم رمزاً احتياطياً بدلاً من ذلك", useAuthenticator: "استخدم رمز التطبيق بدلاً من ذلك", invalidCode: "رمز غير صالح", verifying: "جارٍ التحقق...", verify: "تحقق", backupCodeHint: "أدخل أحد رموزك الاحتياطية.", authenticatorHint: "أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة.", failed: "فشل تسجيل الدخول", signingIn: "جارٍ تسجيل الدخول...", signIn: "تسجيل الدخول", password: "كلمة المرور", email: "البريد الإلكتروني", }, notifications: { daysShort: "ي", hoursShort: "س", minutesShort: "د", now: "الآن", markAllRead: "تحديد الكل كمقروء", empty: "لا توجد إشعارات بعد.", title: "الإشعارات", }, orgChart: { breadcrumbs: { orgChart: "الهيكل التنظيمي", hr: "الموارد البشرية", }, emptyMessage: "حدّد مسؤولاً للموظفين لبناء الهيكل.", emptyTitle: "لا يوجد هيكل تنظيمي بعد", subtitle: "الهيكل الإداري، مبني على المسؤول المباشر لكل موظف.", title: "الهيكل التنظيمي", }, auditLog: { errors: { fetchFailed: "تعذّر تحميل سجل التدقيق", actionFailed: "فشل هذا الإجراء. يرجى المحاولة مرة أخرى.", }, breadcrumbs: { auditLog: "سجل التدقيق", hr: "الموارد البشرية", }, actions: { review: "مراجعة", delete: "حذف", update: "تعديل", create: "إنشاء", }, resourceTypes: { WorkSchedule: "جدول العمل", PayrollRun: "دورة أجور", EmployeeDocument: "وثيقة", Contract: "عقد", Advance: "تسبيق", Absence: "غياب", Salary: "راتب", Employee: "موظف", }, fields: { date: "التاريخ", actor: "بواسطة", resource: "السجل", resourceType: "النوع", action: "الإجراء", }, emptyMessage: "لم تُسجل أي تغييرات لهذا الفلتر بعد.", emptyTitle: "لا نشاط بعد", deleteSureMessage: "هل تريد حذف هذا الإدخال؟ لا يمكن التراجع عن ذلك.", deleteTitle: "حذف إدخال من السجل", subtitle: "من غيّر ماذا ومتى.", title: "سجل التدقيق", }, purchaseRequests: { status: { received: "مستلم", }, fields: { requestedBy: "طلبه", quantity: "الكمية", product: "المادة", }, markReceived: "تحديد كمستلم", emptyMessage: "لا توجد طلبات شراء مطابقة للفلاتر.", emptyTitle: "لا توجد طلبات شراء", subtitle: "طلبات إعادة التزويد المرسلة إلى المشتريات، وردّهم عليها.", title: "طلبات الشراء", }, production: { title: "الإنتاج", }, holidays: { title: "العطل الرسمية", subtitle: "العطل الرسمية للسنة: هل تعمل الشركة، وكيف تُؤدّى ساعات العمل.", downloadTemplate: "تنزيل النموذج", import: "استيراد Excel", add: "إضافة عطلة", year: "السنة", howItWorks: "كل سنة: نزّل النموذج (العطل ذات التاريخ الثابت مُعبّأة مسبقاً)، أضف الأعياد الدينية بتواريخها الرسمية، ثم استورده. عطلة مغلقة: لا يُنتظر حضور أحد، وتُحتسب ساعات من يسجّل حضوره كساعات عطلة. الأداء «مضاعف» يضيف أجر ساعة إضافية عن كل ساعة عمل؛ «عادي» لا يضيف شيئاً.", importDone: "اكتمل الاستيراد: {created} مضافة، {updated} محدّثة.", namePlaceholder: "اسم العطلة (مثال: عيد الفطر)", previewTitle: "معاينة {file}", previewErrors: "{count} سطر(أسطر) يجب تصحيحها — صحّح الملف وأعد استيراده", previewReady: "{count} سطر(أسطر) جاهزة للاستيراد", columns: { row: "السطر", date: "التاريخ", name: "الاسم", open: "الشركة", pay: "الأداء عند العمل", check: "التحقق" }, defaultClosed: "مغلقة (افتراضي)", defaultDouble: "مضاعف (افتراضي)", open: "مفتوحة", closed: "مغلقة", payDouble: "مضاعف", payNormal: "عادي", confirmImport: "استيراد", emptyTitle: "لا توجد عطل رسمية لسنة {year}", emptyMessage: "نزّل النموذج، أكمله، ثم استورده.", deleteTitle: "حذف العطلة", deleteMessage: "حذف «{name}»؟ يتم الاحتفاظ بتسجيلات الحضور لهذا اليوم.", errors: { load: "تعذّر تحميل العطل الرسمية.", save: "تعذّر حفظ هذا التغيير.", template: "تعذّر تنزيل النموذج.", read: "تعذّرت قراءة هذا الملف.", import: "فشل الاستيراد." } }, myDepartment: { adminTitle: "الوصول حسب القسم", adminSubtitle: "جميع الأقسام التي تشرف عليها: مديرها، والمسميات الوظيفية التي تمنح الوصول إلى الوحدة، ومن لديه الوصول.", adminEmptyTitle: "لا توجد أقسام بعد.", noManagerAssigned: "لم يُعيَّن مدير", title: "قسمي", subtitle: "فريقك، والمسميات الوظيفية التي تمنح الوصول إلى وحدة القسم.", loadError: "تعذّر تحميل قسمك.", saveError: "تعذّر حفظ هذا التغيير.", saved: "تم الحفظ.", accountsUpdated: "تم الحفظ — تم تحديث {count} حساب(ات).", emptyTitle: "لا تدير أي قسم بعد.", positionsTitle: "المسميات الوظيفية والوصول", positionsHint: "فعّل مسمى وظيفياً لمنح جميع شاغليه الوصول إلى وحدة القسم. يرى الآخرون مساحتهم فقط.", noModule: "هذا القسم لا يفتح أي وحدة، لذلك لا يوجد وصول لتوزيعه.", noPositions: "لا توجد مناصب محددة لهذا القسم بعد.", holders: "{count} موظف(ين)", toggleLabel: "يمنح الوصول إلى الوحدة", teamTitle: "الفريق", noEmployees: "لا يوجد موظفون في هذا القسم.", columns: { name: "الاسم", jobTitle: "المسمى الوظيفي", access: "الوصول" }, noLogin: "بدون حساب", moduleAccess: "وصول إلى الوحدة", mySpaceOnly: "مساحتي فقط" },
    sidebar: { platform: "المنصة", clients: "العملاء", purchasingReports: "تقارير المشتريات", restock: "إعادة التزويد", inventorySettings: "الإعدادات", purchaseRequests: "طلبات الشراء", inventory: "المخزون", production: "الإنتاج", workSchedule: "جدول العمل", auditLog: "سجل التدقيق", reports: "التقارير", orgChart: "الهيكل التنظيمي", attendance: "الحضور", employeeDocuments: "الوثائق", contracts: "العقود", payroll: "الأجور", supplierInvoices: "فواتير الموردين", purchasing: "المشتريات", purchaseRequestsQueue: "طلبات الشراء", purchaseOrders: "أوامر الشراء", priceRequests: "طلبات الأسعار", suppliers: "الموردون", purchasingInventory: "المخزون", articleHistory: "سجل المادة", holidays: "العطل الرسمية", departmentAccess: "الوصول حسب القسم", myDepartment: "قسمي", mySpace: "مساحتي", myProfile: "ملفي الشخصي", myPayslips: "كشوف أجري", myAbsences: "غياباتي", myAdvances: "تسبيقاتي", myAttendance: "حضوري", myRecords: "ملفي الإداري",
      leaveCalendar: "تقويم الإجازات",
      performanceReviews: "تقييمات الأداء",
      disciplinaryActions: "الإجراءات التأديبية",
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

    common: { home: "الرئيسية", breadcrumb: "مسار التنقل", clear: "مسح", clearSearch: "مسح البحث", nextPage: "الصفحة التالية", previousPage: "الصفحة السابقة", pagination: "ترقيم الصفحات", hidePassword: "إخفاء كلمة المرور", showPassword: "إظهار كلمة المرور", somethingWentWrong: "حدث خطأ ما", confirmAction: "تأكيد الإجراء", pageNotFoundHint: "هذه الصفحة غير موجودة أو تم نقلها.", pageNotFound: "الصفحة غير موجودة", status: "الحالة", save: "حفظ", back: "رجوع", dateFrom: "من", dateTo: "إلى",
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
      chooseFile: "اختر ملفًا",
      noFileChosen: "لم يتم اختيار أي ملف",
    },

    profile: { loadFailed: "تعذّر تحميل الملف الشخصي",
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

    company: { workflow: { accountInvalid: "الحساب المحاسبي يتكون من 4 إلى 10 أرقام.", purchaseAccountHint: "يُستخدم في التصدير المحاسبي للمواد التي لا يملك صنفها حساباً خاصاً، وللأسطر المدخلة يدوياً (مثال 6111، 6121، 6125).", purchaseAccount: "حساب الشراء الافتراضي", purchaseThresholdHint: "يجب أن يوافق مسؤول أو المالك أو مدير المشتريات على أوامر الشراء التي تساوي هذا المبلغ أو تتجاوزه. 0 = بدون موافقة.", purchaseThreshold: "حد الموافقة على أوامر الشراء", title: "مسار الموافقة", sequentialApproval: "موافقة المدير قبل الموارد البشرية", sequentialApprovalHint: "عند التفعيل، يجب أن يوافق مدير الموظف أولاً على طلبات الغياب والتسبيقات، ثم تمنح الموارد البشرية الموافقة النهائية. الموظفون بدون مدير تُحال طلباتهم مباشرة إلى الموارد البشرية.", saveFailed: "تعذّر حفظ هذا الإعداد." },
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

      downloadFiche:
        "تنزيل بطاقة الشركة",

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

        ficheDownloadFailed:
          "حدث خطأ أثناء إنشاء بطاقة الشركة.",

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
      inheritedFromEmployee: "يتم توريث القسم والدور في الموارد البشرية من الموظف المرتبط {name} ({department} — {jobTitle}). لتغييرهما، حدّث قسم الموظف أو مسماه الوظيفي بدلاً من ذلك.",

      updateTitle: "تعديل المستخدم",
      updateSureMessage: "هل أنت متأكد من أنك تريد حفظ هذه التغييرات؟",

      updateSuccessTitle: "تم تحديث المستخدم",
      updateSuccessMessage: "تم تحديث المستخدم بنجاح.",

      updateFailTitle: "فشل التحديث",
      updateFailMessage: "تعذر تحديث المستخدم. يرجى المحاولة مرة أخرى.",

      hrRole: {
        label: "المنصب في الموارد البشرية",
        notApplicable: "غير قابل للتطبيق (خارج الموارد البشرية)",
        assistant: "مساعد(ة) موارد بشرية",
        officer: "مكلف(ة) بالموارد البشرية",
        manager: "مسؤول(ة) الموارد البشرية",
        director: "مدير(ة) الموارد البشرية",
      },

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
    employees: { related: { tabs: { attendance: "الحضور", documents: "الوثائق", contracts: "العقود", advances: "التسبيقات", absences: "الغيابات", salary: "الراتب", }, empty: "لا شيء هنا بعد.", }, linkedUser: { resetPasswordSureMessage: "إنشاء كلمة مرور مؤقتة جديدة لحساب هذا الموظف؟ ستتوقف كلمة المرور الحالية عن العمل.", resetPasswordTitle: "إعادة تعيين كلمة المرور", resetPassword: "إعادة تعيين كلمة المرور", loginNotCreatedTitle: "تم إنشاء الموظف، لكن بدون حساب بعد", loginCreatedMessage: "البريد: {email}\nكلمة المرور المؤقتة: {password}\n\nشاركها مع الموظف — لن تُعرض مرة أخرى.", loginCreatedTitle: "تم إنشاء الحساب", createLoginSureMessage: "إنشاء حساب خدمة ذاتية جديد لهذا الموظف؟ ستُنشأ كلمة مرور مؤقتة وتُعرض مرة واحدة.", createLoginTitle: "إنشاء حساب", createLogin: "إنشاء حساب جديد", orCreateNew: "أو", actionFailed: "حدث خطأ. يرجى المحاولة مرة أخرى.", searchPlaceholder: "ابحث عن المستخدمين بالاسم أو البريد...", unlinkSureMessage: "إلغاء ربط حساب المستخدم هذا بهذا الموظف؟ سيفقد الوصول إلى مساحتي.", unlinkTitle: "إلغاء ربط حساب المستخدم", linkSureMessage: "ربط حساب المستخدم هذا بهذا الموظف؟ سيحصل على الوصول إلى مساحتي (كشوف الأجر، طلبات الغياب والتسبيقات، الحضور).", linkTitle: "ربط حساب مستخدم", unlink: "إلغاء الربط", link: "ربط", linkedTo: "مرتبط بـ:", title: "الوصول الذاتي", },
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

      documents: {
        menuButton: "المستندات",
        attestationTravail: "شهادة عمل",
        attestationSalaire: "شهادة عمل وراتب",
        certificatTravail: "شهادة نهاية الخدمة",
        contratTravail: "عقد العمل",
        soldeToutCompte: "وصل تصفية الحساب النهائي",
        generationFailed: "حدث خطأ أثناء إنشاء المستند.",
      },

      bulkImport: {
        exportButton: "تصدير (CSV)",
        exportFailed: "تعذر تصدير الموظفين.",
        openButton: "استيراد (CSV)",
        title: "استيراد الموظفين دفعة واحدة",
        helpText: "قم برفع ملف CSV لإنشاء عدة موظفين دفعة واحدة. يتم التحقق من كل صف أولاً — لن يتم إنشاء أي شيء قبل التأكيد.",
        downloadTemplate: "تنزيل نموذج CSV",
        preview: "التحقق من الملف",
        previewing: "جارٍ التحقق...",
        previewFailed: "تعذرت قراءة هذا الملف.",
        summaryValid: "{count} جاهز للاستيراد",
        summaryErrors: "{count} به أخطاء",
        summaryWarnings: "{count} به تنبيهات",
        rowOk: "لا توجد مشاكل",
        fixErrorsFirst: "قم بتصحيح الصفوف التي بها أخطاء وأعد رفع الملف قبل الاستيراد — الصفوف التي بها تنبيهات فقط سيتم استيرادها.",
        importButton: "استيراد {count} موظف(ين)",
        committing: "جارٍ الاستيراد...",
        commitFailed: "تعذر إتمام الاستيراد.",
        commitSuccess: "تم استيراد {count} موظف(ين) بنجاح.",
      },

      fields: { createLoginCheckboxLabel: "إنشاء حساب خدمة ذاتية لهذا الموظف أيضاً (باستخدام بريده المهني)", createLogin: "حساب الخدمة الذاتية", noDepartments: "لا توجد أقسام بعد — أضف قسماً من التنظيم > الأقسام", manager: "المسؤول المباشر", noManagerCandidates: "لا يوجد موظف آخر في هذه الشركة بعد",
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

      history: { deleteRecord: "حذف سجل الراتب هذا",
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
        reviewComment: "تعليق المراجعة",
        status: "الحالة",
      },

      types: {
        paid_leave: "إجازة مدفوعة",
        unpaid_leave: "إجازة بدون أجر",
        sick_leave: "إجازة مرضية",
        absence: "غياب",
        other: "آخر",
      },

      status: { manager_approved: "وافق عليها المدير",
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
        reviewComment: "تعليق المراجعة",
        status: "الحالة",
      },

      status: { manager_approved: "وافق عليها المدير",
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

    units: {
      unit: "وحدة",
      piece: "قطعة",
      pair: "زوج",
      dozen: "دزينة",
      set: "طقم",
      kg: "كيلوغرام (kg)",
      g: "غرام (g)",
      t: "طن (t)",
      lb: "رطل (lb)",
      oz: "أونصة (oz)",
      quintal: "قنطار (q)",
      l: "لتر (L)",
      ml: "مليلتر (mL)",
      m3: "متر مكعب (m³)",
      gal: "غالون (gal)",
      m: "متر (m)",
      cm: "سنتيمتر (cm)",
      mm: "مليمتر (mm)",
      km: "كيلومتر (km)",
      ft: "قدم (ft)",
      in: "بوصة (in)",
      yd: "ياردة (yd)",
      m2: "متر مربع (m²)",
      ft2: "قدم مربع (ft²)",
      ha: "هكتار (ha)",
      box: "صندوق",
      carton: "كرتون",
      pallet: "منصة نقالة",
      bag: "كيس",
      sack: "كيس كبير",
      bottle: "زجاجة",
      can: "علبة",
      roll: "لفة",
      sheet: "ورقة",
      bundle: "حزمة",
      case: "صندوق كبير",
      drum: "برميل",
      barrel: "برميل نفط",
      container: "حاوية",
      hour: "ساعة",
      day: "يوم",
      month: "شهر",
    },

    contentTranslation: {
      title: "الترجمات",
      editButton: "الترجمات",
      original: "النص الأصلي",
      auto: "مُترجَم تلقائيًا",
      manual: "مُعدَّل يدويًا",
      missing: "لم تتم ترجمته بعد",
      regenerate: "إعادة الترجمة",
      originalHint: "هذا هو النص الأصلي — عدّل الحقل نفسه لتغييره.",
      save: "حفظ",
      saving: "جارٍ الحفظ…",
      close: "إغلاق",
      placeholder: "أدخل الترجمة…",
      errors: {
        loadFailed: "فشل تحميل الترجمات.",
        saveFailed: "فشل حفظ الترجمة.",
        regenerateFailed: "فشلت إعادة توليد الترجمة.",
      },
    },

    departments: { noManagerBadge: "بدون مدير", managerLabel: "المدير", moduleAccessBadge: "وصول إلى الوحدة",
      title: "الأقسام",
      subtitle: "حدد أقسام مؤسستك والمناصب الوظيفية ضمن كل قسم.",
      addDepartment: "إضافة قسم",
      addDefaults: "إضافة أقسام افتراضية",
      defaultsModal: {
        title: "إضافة أقسام افتراضية",
        helpText: "اختر الأقسام التي تريد إضافتها — يأتي كل قسم باسم ووصف قياسيين، وبالنسبة للموارد البشرية/الإنتاج، بصلاحية الوصول إلى الوحدة مُحددة مسبقًا. يمكنك دائمًا تعديلها أو إضافة المزيد لاحقًا.",
        adding: "جارٍ الإضافة...",
        addButton: "إضافة {count} قسم (أقسام)",
      },
      editDepartment: "تعديل القسم",
      addPosition: "إضافة منصب",
      editPosition: "تعديل المنصب",
      deleteTitle: "حذف القسم",
      deleteSureMessage: "هل أنت متأكد من حذف هذا القسم؟ يجب إعادة تعيين الموظفين والمناصب التي لا تزال تستخدمه أولاً.",
      deletePositionTitle: "حذف المنصب",
      deletePositionSureMessage: "هل أنت متأكد من حذف هذا المنصب؟ يجب أولاً إعادة تعيين الموظفين الذين يشغلونه، أو المناصب الأخرى التابعة له.",
      emptyTitle: "لا توجد أقسام بعد",
      emptyMessage: "أضف أول قسم لبدء بناء هيكلك التنظيمي.",
      searchPlaceholder: "بحث في الأقسام...",
      noSearchResults: "لا توجد أقسام مطابقة لبحثك.",
      noPositions: "لا توجد مناصب محددة في هذا القسم بعد.",
      fields: { purchasingAccess: "الوصول إلى وحدة المشتريات", manager: "مدير القسم", noManager: "بدون مدير", managerHint: "يشرف على القسم بأكمله: وصول كامل إلى الوحدة، يوافق على طلبات الفريق، ويحدد المسميات الوظيفية التي تحصل على الوصول.", grantsModuleAccess: "يمنح الوصول إلى الوحدة", grantsModuleAccessHint: "يحصل شاغلو هذا المنصب على وحدة القسم (مثل الموارد البشرية أو المخزون). اتركه غير مفعّل للموظفين الذين يجب أن يروا مساحتهم فقط.",
        name: "الاسم", description: "الوصف", permissionKey: "الوصول إلى الوحدة",
        permissionKeyHint: "اختياري — يُحدد فقط على قسم واحد إذا كان يجب أن يحصل الموظفون فيه (وحساباتهم التي تُنشأ تلقائيًا) على صلاحية الوصول إلى وحدة الموارد البشرية أو الإنتاج. يجب أن تبقى معظم الأقسام على \"بدون وصول خاص\".",
        category: "الوظيفة",
        noCategory: "لا توجد وظيفة محددة",
        categoryHint: "اختياري — يتيح لنموذج الموظف اقتراح مسميات وظيفية قياسية لهذا القسم بدلاً من ترك الحقل حرًا. مجرد اقتراح، ولا علاقة له بالصلاحيات على عكس حقل الوصول إلى الوحدة أعلاه.",
        noSpecialAccess: "بدون وصول خاص", hrAccess: "الوصول إلى وحدة الموارد البشرية", productionAccess: "الوصول إلى وحدة الإنتاج",
        positionTitle: "مسمى المنصب", reportsTo: "يخضع لإشراف", noReportsTo: "لا شيء (منصب أعلى المستويات)",
        salaryMin: "نطاق الراتب — الحد الأدنى", salaryMax: "نطاق الراتب — الحد الأقصى", salaryBand: "نطاق الراتب",
        requiredSkills: "المهارات المطلوبة", requiredSkillsPlaceholder: "مفصولة بفواصل، مثال: Excel، القيادة",
      },
      errors: {
        nameRequired: "اسم القسم مطلوب", titleRequired: "مسمى المنصب مطلوب",
        saveFailed: "حدث خطأ أثناء الحفظ.", deleteFailed: "حدث خطأ أثناء الحذف.",
      },
    },

    payroll: {
      title: "الأجور",
      subtitle: "أنشئ دورات الأجور الشهرية وأدر كشوف الرواتب.",
      generateRun: "إنشاء دورة أجور",
      createTitle: "إنشاء دورة أجور",
      createSureMessage: "هل تريد إنشاء الأجور لهذه الفترة؟ سيتم إنشاء كشف راتب لكل موظف نشط لديه راتب مسجل.",
      createSuccessTitle: "تم إنشاء دورة الأجور",
      createSuccessMessage: "تم إنشاء دورة الأجور بنجاح.",
      completeTitle: "إغلاق دورة الأجور",
      completeSureMessage: "هل تريد إغلاق دورة الأجور هذه؟ بمجرد الإغلاق، يتم قفل كشوف الرواتب وإخطار الموظفين.",
      deleteTitle: "حذف دورة الأجور",
      deleteSureMessage: "هل تريد حذف مسودة دورة الأجور هذه وجميع كشوف رواتبها؟ لا يمكن التراجع عن هذا الإجراء.",
      emptyTitle: "لا توجد دورات أجور بعد",
      emptyMessage: "أنشئ أول دورة أجور لهذه الشركة.",
      noPayslips: "لا توجد كشوف رواتب في هذه الدورة.",
      fields: { month: "الشهر", year: "السنة", status: "الحالة" },
      table: { period: "الفترة", employees: "الموظفون", gross: "الإجمالي", net: "الصافي", searchPlaceholder: "البحث عن الموظفين..." },
      status: { draft: "مسودة", completed: "مكتملة", voided: "ملغاة" },
      payslipStatus: { draft: "مسودة", validated: "مصادق عليه", paid: "مدفوع" },
      actions: { view: "عرض", complete: "إغلاق", regenerate: "إعادة إنشاء", markPaid: "تحديد كمدفوع", downloadPdf: "تنزيل كشف الراتب" },
      exports: {
        cnss: "تصدير CNSS",
        cnssHint: "ورقة التصريح — تحقق من التوافق مع صيغة Damancom الحالية قبل الرفع",
        register: "سجل الأجور",
        bankTransfer: "ملف التحويل البنكي",
      },
      buttons: { generate: "إنشاء", saving: "جارٍ الحفظ..." },
      breadcrumbs: { hr: "الموارد البشرية", payroll: "الأجور" },
      months: ["يناير","فبراير","مارس","أبريل","ماي","يونيو","يوليوز","غشت","شتنبر","أكتوبر","نونبر","دجنبر"],
      errors: { fetchFailed: "فشل تحميل دورات الأجور", actionFailed: "حدث خطأ ما. يرجى المحاولة مرة أخرى." },
    },

    contracts: {
      title: "العقود",
      subtitle: "تتبع عقود العمل والتجديدات وتواريخ الانتهاء.",
      addContract: "عقد جديد",
      createTitle: "عقد جديد",
      createSureMessage: "هل أنت متأكد من إنشاء هذا العقد؟",
      createSuccessTitle: "تم إنشاء العقد",
      createSuccessMessage: "تم إنشاء العقد بنجاح.",
      renewTitle: "تجديد العقد",
      renewSureMessage: "هل تريد تجديد هذا العقد؟ سيتم إغلاق العقد الحالي وبدء عقد جديد.",
      deleteTitle: "حذف العقد",
      deleteSureMessage: "هل أنت متأكد من حذف هذا العقد؟ لا يمكن التراجع عن هذا الإجراء.",
      emptyTitle: "لا توجد عقود بعد",
      emptyMessage: "لا تحتوي هذه الشركة على أي عقود مسجلة بعد.",
      expiringBanner: "{count} عقد (عقود) تنتهي خلال 30 يومًا.",
      fields: { employee: "الموظف", type: "نوع العقد", startDate: "تاريخ البدء", endDate: "تاريخ الانتهاء" },
      status: { active: "ساري", expired: "منتهي", terminated: "مفسوخ", renewed: "مجدد" },
      actions: { renew: "تجديد" },
      buttons: { create: "حفظ العقد" },
      breadcrumbs: { hr: "الموارد البشرية", contracts: "العقود" },
      errors: { fetchFailed: "فشل تحميل العقود", actionFailed: "حدث خطأ ما. يرجى المحاولة مرة أخرى." },
    },

    documents: {
      title: "المستندات",
      subtitle: "احفظ مستندات الموظفين وتتبع تواريخ انتهاء صلاحيتها.",
      uploadDocument: "رفع مستند",
      editDocument: "تعديل المستند",
      deleteTitle: "حذف المستند",
      deleteSureMessage: "هل أنت متأكد من حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء.",
      emptyTitle: "لا توجد مستندات بعد",
      emptyMessage: "لا تحتوي هذه الشركة على أي مستندات مسجلة بعد.",
      expiringBanner: "{count} مستند (مستندات) تنتهي صلاحيتها خلال 30 يومًا.",
      fields: { employee: "الموظف", type: "النوع", label: "التسمية", labelPlaceholder: "مثال: البطاقة الوطنية", expiryDate: "تاريخ الانتهاء", file: "الملف", replaceFile: "استبدال الملف (اختياري)" },
      table: { file: "الملف" },
      types: {
        cin: "البطاقة الوطنية (CIN)", passport: "جواز السفر", work_permit: "رخصة العمل",
        residence_permit: "بطاقة الإقامة", contract: "عقد", diploma: "شهادة",
        cv: "السيرة الذاتية", medical_certificate: "شهادة طبية", other: "أخرى",
      },
      actions: { view: "عرض", loadMore: "تحميل المزيد", loadMoreCount: "عرض {loaded} من {total}" },
      buttons: { upload: "رفع" },
      breadcrumbs: { hr: "الموارد البشرية", documents: "المستندات" },
      errors: {
        fetchFailed: "فشل تحميل المستندات", actionFailed: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
        missingFields: "يرجى اختيار موظف وملف.", uploadFailed: "فشل رفع المستند.",
      },
    },

    attendance: {
      title: "الحضور",
      subtitle: "راجع سجلات تسجيل الدخول والخروج.",
      emptyTitle: "لا توجد سجلات حضور",
      emptyMessage: "لا توجد سجلات حضور مطابقة لعوامل التصفية المحددة.",
      filterAllEmployees: "جميع الموظفين",
      fields: { employee: "الموظف", date: "التاريخ", clockIn: "الدخول", clockOut: "الخروج", notes: "ملاحظات" },
      status: { present: "حاضر", late: "متأخر", absent: "غائب", half_day: "نصف يوم", holiday: "عطلة" },
      breadcrumbs: { hr: "الموارد البشرية", attendance: "الحضور" },
      errors: { fetchFailed: "فشل تحميل سجلات الحضور" },
    },

    reports: { chart: { zoomHint: "اسحب المقابض أسفل الرسم البياني للتكبير", yearly: "سنوي", monthly: "شهري", view: "العرض", lastMonths: "آخر {n} أشهر", range: "الفترة", },
      title: "التقارير",
      subtitle: "الاتجاهات المتعلقة بعدد الموظفين ودوران العمل والغياب وتكلفة الأجور.",
      stats: { totalHeadcount: "إجمالي عدد الموظفين", activeEmployees: "الموظفون النشطون", currentGross: "الإجمالي الشهري الحالي (تقديري)", currentNet: "الصافي الشهري الحالي (تقديري)", missingSalaryNote: "{count} موظف (موظفين) نشطين ليس لديهم راتب مسجل بعد — غير مدرجين في هذا التقدير." },
      expand: "توسيع",
      charts: {
        headcountByDepartment: "عدد الموظفين حسب القسم", turnover: "دوران العمل (آخر 12 شهرًا)",
        hires: "التوظيفات", terminations: "المغادرات", absenteeism: "معدل الغياب (آخر 6 أشهر)",
        absenteeismRate: "معدل الغياب", payrollCost: "تكلفة الأجور (آخر 12 شهرًا)",
        estimatedFootnote: "* الشهر الحالي، المشار إليه بعلامة نجمية، هو تقدير مباشر بناءً على الرواتب الحالية — لم يتم تنفيذ الأجور له بعد.",
      },
      breadcrumbs: { hr: "الموارد البشرية", reports: "التقارير" },
      loadError: "فشل تحميل بعض بيانات التقرير. يرجى المحاولة مرة أخرى، أو التحقق من وحدة التحكم لمزيد من التفاصيل.",
      rankings: {
        title: "تصنيف الموظفين",
        last30Days: "آخر 30 يومًا",
        last90Days: "آخر 90 يومًا",
        last365Days: "آخر 12 شهرًا",
        mostAbsenceDays: "الأكثر أيام غياب",
        bestAttendanceRate: "أفضل معدل حضور",
        mostOvertimeHours: "الأكثر ساعات إضافية",
        mostLateDays: "الأكثر تأخرًا",
        noData: "لا توجد بيانات لهذه الفترة.",
        days: "أيام",
      },
    },  twoFactor: { qrAlt: "رمز QR للتحقق الثنائي",
    title: "المصادقة الثنائية",
    disabledHint: "أضف طبقة إضافية من الأمان إلى حسابك — بعد كلمة المرور، ستحتاج أيضًا إلى رمز من تطبيق مصادقة لتسجيل الدخول.",
    enabledHint: "المصادقة الثنائية مفعّلة على حسابك. سيُطلب منك رمز من تطبيق المصادقة في كل مرة تسجّل فيها الدخول.",
    enableButton: "تفعيل المصادقة الثنائية",
    disableButton: "إلغاء تفعيل المصادقة الثنائية",
    disabling: "جارٍ الإلغاء...",
    scanTitle: "امسح رمز الاستجابة السريعة",
    scanHint: "امسحه باستخدام تطبيق مصادقة (Google Authenticator أو Authy وغيرها)، ثم أدخل الرمز المكوّن من 6 أرقام الذي يظهر للتأكيد.",
    manualEntryLabel: "تعذّر المسح؟ أدخل هذا الرمز يدويًا:",
    confirmAndEnable: "تأكيد وتفعيل",
    verifying: "جارٍ التحقق...",
    backupCodesTitle: "احفظ رموز النسخ الاحتياطي",
    backupCodesHint: "يمكن استخدام كل رمز مرة واحدة لتسجيل الدخول إذا فقدت الوصول إلى تطبيق المصادقة. احفظها في مكان آمن — لن تُعرض مرة أخرى.",
    copyBackupCodes: "نسخ الرموز",
    copied: "تم النسخ",
    iSavedThem: "لقد حفظت هذه الرموز",
    confirmPasswordLabel: "أكّد كلمة المرور للمتابعة",
    errors: {
      statusFailed: "تعذّر التحقق من حالة المصادقة الثنائية.",
      setupFailed: "تعذّر بدء إعداد المصادقة الثنائية.",
      invalidCode: "هذا الرمز غير مطابق — تحقق من تطبيق المصادقة وحاول مرة أخرى.",
      disableFailed: "تعذّر إلغاء تفعيل المصادقة الثنائية.",
    },
  },

  disciplinaryActions: {
    title: "الإجراءات التأديبية",
    subtitle: "تتبع الإنذارات والإجراءات التصحيحية الصادرة للموظفين.",
    addAction: "إضافة سجل",
    editAction: "تعديل السجل",
    emptyTitle: "لا توجد سجلات تأديبية بعد",
    emptyMessage: "لا تحتوي هذه الشركة على أي إجراءات تأديبية مسجلة.",
    deleteTitle: "حذف السجل",
    deleteSureMessage: "هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.",
    acknowledged: "تم الاطلاع",
    notAcknowledged: "لم يتم الاطلاع بعد",
    breadcrumbs: {
      hr: "الموارد البشرية",
      disciplinaryActions: "الإجراءات التأديبية",
    },
    fields: {
      employee: "الموظف",
      type: "النوع",
      date: "التاريخ",
      reason: "السبب",
      description: "الوصف",
      suspensionDays: "مدة الإيقاف (أيام)",
      issuedBy: "صادر عن",
      notes: "ملاحظات",
    },
    types: {
      verbal_warning: "إنذار شفهي",
      written_warning: "إنذار كتابي",
      final_warning: "إنذار نهائي",
      suspension: "إيقاف عن العمل",
      termination_notice: "إشعار إنهاء الخدمة",
    },
    errors: {
      fetchFailed: "فشل تحميل الإجراءات التأديبية",
      saveFailed: "خطأ أثناء الحفظ",
      deleteFailed: "خطأ أثناء الحذف",
    },
  },
  performanceReviews: {
    title: "تقييمات الأداء",
    subtitle: "دورات التقييم والأهداف والتقييمات لموظفيك.",
    addReview: "تقييم جديد",
    editReview: "تعديل التقييم",
    emptyTitle: "لا توجد تقييمات أداء بعد",
    emptyMessage: "لا تحتوي هذه الشركة على أي تقييمات أداء مسجلة.",
    deleteTitle: "حذف التقييم",
    deleteSureMessage: "هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء.",
    reviewedBy: "قيّمه",
    submitButton: "إرسال إلى الموظف",
    breadcrumbs: {
      hr: "الموارد البشرية",
      performanceReviews: "تقييمات الأداء",
    },
    fields: {
      employee: "الموظف",
      reviewer: "المقيّم",
      periodLabel: "فترة التقييم",
      periodLabelPlaceholder: "مثال: التقييم السنوي 2026",
      reviewDate: "تاريخ التقييم",
      goals: "الأهداف (هدف في كل سطر)",
      goalsPlaceholder: "تحسين وقت الاستجابة لتذاكر الدعم\nإتمام شهادة التأهيل",
      strengths: "نقاط القوة",
      areasForImprovement: "مجالات التحسين",
      comments: "ملاحظات",
    },
    criteria: {
      jobKnowledge: "المعرفة الوظيفية",
      qualityOfWork: "جودة العمل",
      communication: "التواصل",
      teamwork: "العمل الجماعي",
      initiative: "المبادرة",
      punctuality: "الالتزام بالمواعيد",
    },
    statuses: {
      draft: "مسودة",
      submitted: "مُرسلة",
      acknowledged: "تم الاطلاع",
    },
    errors: {
      fetchFailed: "فشل تحميل تقييمات الأداء",
      saveFailed: "خطأ أثناء الحفظ",
      submitFailed: "خطأ أثناء الإرسال",
      deleteFailed: "خطأ أثناء الحذف",
    },
  },
  leaveCalendar: {
    title: "تقويم الإجازات",
    subtitle: "اطّلع بسرعة على من هو في إجازة موافق عليها.",
    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    breadcrumbs: {
      hr: "الموارد البشرية",
      leaveCalendar: "تقويم الإجازات",
    },
    weekdays: {
      0: "إثن",
      1: "ثلا",
      2: "أرب",
      3: "خمي",
      4: "جمع",
      5: "سبت",
      6: "أحد",
    },
    errors: {
      fetchFailed: "فشل تحميل تقويم الإجازات",
    },
  },
  },

  // ======================================================
  // SPANISH
  // ======================================================

  es: { login: { useBackupCode: "Usar un código de respaldo", useAuthenticator: "Usar el código de la app", invalidCode: "Código no válido", verifying: "Verificando...", verify: "Verificar", backupCodeHint: "Introduce uno de tus códigos de respaldo.", authenticatorHint: "Introduce el código de 6 dígitos de tu app de autenticación.", failed: "Error al iniciar sesión", signingIn: "Iniciando sesión...", signIn: "Iniciar sesión", password: "Contraseña", email: "Correo electrónico", }, notifications: { daysShort: "d", hoursShort: "h", minutesShort: "min", now: "ahora", markAllRead: "Marcar todo como leído", empty: "Aún no hay notificaciones.", title: "Notificaciones", }, orgChart: { breadcrumbs: { orgChart: "Organigrama", hr: "RR. HH.", }, emptyMessage: "Asigna un responsable a los empleados para construir la estructura.", emptyTitle: "Aún no hay organigrama", subtitle: "Estructura jerárquica, basada en el responsable de cada empleado.", title: "Organigrama", }, auditLog: { errors: { fetchFailed: "No se pudo cargar el registro de auditoría", actionFailed: "Esta acción ha fallado. Inténtalo de nuevo.", }, breadcrumbs: { auditLog: "Registro de auditoría", hr: "RR. HH.", }, actions: { review: "Revisado", delete: "Eliminado", update: "Modificado", create: "Creado", }, resourceTypes: { WorkSchedule: "Horario de trabajo", PayrollRun: "Ciclo de nómina", EmployeeDocument: "Documento", Contract: "Contrato", Advance: "Anticipo", Absence: "Ausencia", Salary: "Salario", Employee: "Empleado", }, fields: { date: "Fecha", actor: "Por", resource: "Registro", resourceType: "Tipo", action: "Acción", }, emptyMessage: "Aún no hay cambios registrados para este filtro.", emptyTitle: "Sin actividad todavía", deleteSureMessage: "¿Eliminar esta entrada? No se puede deshacer.", deleteTitle: "Eliminar entrada del registro", subtitle: "Quién cambió qué y cuándo.", title: "Registro de auditoría", }, purchaseRequests: { status: { received: "Recibido", }, fields: { requestedBy: "Solicitado por", quantity: "Cantidad", product: "Artículo", }, markReceived: "Marcar como recibido", emptyMessage: "Ninguna solicitud coincide con tus filtros.", emptyTitle: "No hay solicitudes de compra", subtitle: "Solicitudes de reposición enviadas a Compras, y su respuesta.", title: "Solicitudes de compra", }, production: { title: "Producción", }, holidays: { title: "Días festivos", subtitle: "Los festivos del año: si la empresa trabaja y cómo se pagan las horas trabajadas.", downloadTemplate: "Descargar plantilla", import: "Importar Excel", add: "Añadir festivo", year: "Año", howItWorks: "Cada año: descarga la plantilla (los festivos de fecha fija ya están rellenados), añade los festivos religiosos con sus fechas oficiales e impórtala. Festivo cerrado: no se espera a nadie y las horas de quien fiche cuentan como horas de festivo. Pago «doble» añade una hora extra pagada por cada hora trabajada; «normal» no añade nada.", importDone: "Importación completada: {created} añadidos, {updated} actualizados.", namePlaceholder: "Nombre del festivo (p. ej. Aïd al-Fitr)", previewTitle: "Vista previa de {file}", previewErrors: "{count} fila(s) por corregir — corrige el archivo e impórtalo de nuevo", previewReady: "{count} fila(s) listas para importar", columns: { row: "Fila", date: "Fecha", name: "Nombre", open: "Empresa", pay: "Pago si se trabaja", check: "Revisión" }, defaultClosed: "Cerrada (por defecto)", defaultDouble: "Doble (por defecto)", open: "Abierta", closed: "Cerrada", payDouble: "Doble", payNormal: "Normal", confirmImport: "Importar", emptyTitle: "Aún no hay festivos para {year}", emptyMessage: "Descarga la plantilla, complétala e impórtala.", deleteTitle: "Eliminar festivo", deleteMessage: "¿Eliminar «{name}»? Los fichajes ya registrados ese día se conservan.", errors: { load: "No se pudieron cargar los festivos.", save: "No se pudo guardar este cambio.", template: "No se pudo descargar la plantilla.", read: "No se pudo leer este archivo.", import: "La importación falló." } }, myDepartment: { adminTitle: "Acceso por departamento", adminSubtitle: "Todos los departamentos que supervisas: su responsable, qué puestos dan acceso al módulo y quién tiene acceso.", adminEmptyTitle: "Aún no hay departamentos.", noManagerAssigned: "Sin responsable asignado", title: "Mi departamento", subtitle: "Tu equipo y qué puestos dan acceso al módulo del departamento.", loadError: "No se pudo cargar tu departamento.", saveError: "No se pudo guardar este cambio.", saved: "Guardado.", accountsUpdated: "Guardado — {count} cuenta(s) actualizada(s).", emptyTitle: "Todavía no gestionas ningún departamento.", positionsTitle: "Puestos y acceso", positionsHint: "Activa un puesto para dar a todos sus titulares acceso al módulo del departamento. El resto solo ve Mi espacio.", noModule: "Este departamento no desbloquea ningún módulo, así que no hay acceso que repartir.", noPositions: "Aún no hay puestos definidos para este departamento.", holders: "{count} empleado(s)", toggleLabel: "Da acceso al módulo", teamTitle: "Equipo", noEmployees: "No hay empleados en este departamento.", columns: { name: "Nombre", jobTitle: "Puesto", access: "Acceso" }, noLogin: "Sin cuenta", moduleAccess: "Acceso al módulo", mySpaceOnly: "Solo Mi espacio" },
    sidebar: { platform: "Plataforma", clients: "Clientes", purchasingReports: "Informes de compras", restock: "Reposición", inventorySettings: "Configuración", purchaseRequests: "Solicitudes de compra", inventory: "Inventario", production: "Producción", workSchedule: "Horario de trabajo", auditLog: "Registro de auditoría", reports: "Informes", orgChart: "Organigrama", attendance: "Asistencia", employeeDocuments: "Documentos", contracts: "Contratos", payroll: "Nómina", supplierInvoices: "Facturas de proveedores", purchasing: "Compras", purchaseRequestsQueue: "Solicitudes de compra", purchaseOrders: "Órdenes de compra", priceRequests: "Solicitudes de precio", suppliers: "Proveedores", purchasingInventory: "Inventario", articleHistory: "Historial del artículo", holidays: "Días festivos", departmentAccess: "Acceso por departamento", myDepartment: "Mi departamento", mySpace: "Mi espacio", myProfile: "Mi perfil", myPayslips: "Mis nóminas", myAbsences: "Mis ausencias", myAdvances: "Mis anticipos", myAttendance: "Mi asistencia", myRecords: "Mi expediente",
      leaveCalendar: "Calendario de ausencias",
      performanceReviews: "Evaluaciones de desempeño",
      disciplinaryActions: "Acciones disciplinarias",
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

    common: { home: "Inicio", breadcrumb: "Ruta de navegación", clear: "Borrar", clearSearch: "Borrar búsqueda", nextPage: "Página siguiente", previousPage: "Página anterior", pagination: "Paginación", hidePassword: "Ocultar contraseña", showPassword: "Mostrar contraseña", somethingWentWrong: "Algo salió mal", confirmAction: "Confirmar acción", pageNotFoundHint: "Esta página no existe o se ha movido.", pageNotFound: "Página no encontrada", status: "Estado", save: "Guardar", back: "Volver", dateFrom: "Desde", dateTo: "Hasta",
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
      chooseFile: "Elegir archivo",
      noFileChosen: "Ningún archivo seleccionado",
    },

    profile: { loadFailed: "No se pudo cargar el perfil",
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

    company: { workflow: { accountInvalid: "Una cuenta contable tiene de 4 a 10 dígitos.", purchaseAccountHint: "Se usa en la exportación contable para artículos cuya categoría no tiene cuenta propia y para líneas escritas a mano (p. ej. 6111, 6121, 6125).", purchaseAccount: "Cuenta de compras por defecto", purchaseThresholdHint: "Los pedidos con un importe (IVA incl.) igual o superior deben ser aprobados por un admin, el propietario o el responsable de compras. 0 = sin aprobación.", purchaseThreshold: "Umbral de aprobación de pedidos", title: "Flujo de aprobación", sequentialApproval: "Aprobación del responsable antes de RR. HH.", sequentialApprovalHint: "Si está activado, las solicitudes de ausencia y anticipo deben ser aprobadas primero por el responsable del empleado y luego recibir la aprobación final de RR. HH. Los empleados sin responsable pasan directamente a RR. HH.", saveFailed: "No se pudo guardar este ajuste." },
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

      downloadFiche:
        "Descargar ficha",

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

        ficheDownloadFailed:
          "Error al generar la ficha de la empresa.",

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
      inheritedFromEmployee: "El departamento y el rol de RR. HH. se heredan del empleado vinculado {name} ({department} — {jobTitle}). Para cambiarlos, actualiza el Departamento o el Puesto del empleado.",

      updateTitle: "Editar usuario",
      updateSureMessage: "¿Seguro que quieres guardar estos cambios?",

      updateSuccessTitle: "Usuario actualizado",
      updateSuccessMessage: "El usuario se ha actualizado correctamente.",

      updateFailTitle: "Error al actualizar",
      updateFailMessage: "No se pudo actualizar el usuario. Inténtalo de nuevo.",

      hrRole: {
        label: "Puesto de RR. HH.",
        notApplicable: "No aplicable (fuera de RR. HH.)",
        assistant: "Asistente de RR. HH.",
        officer: "Encargado/a de RR. HH.",
        manager: "Responsable de RR. HH.",
        director: "Director/a de RR. HH.",
      },

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
    employees: { related: { tabs: { attendance: "Asistencia", documents: "Documentos", contracts: "Contratos", advances: "Anticipos", absences: "Ausencias", salary: "Salario", }, empty: "Nada por aquí todavía.", }, linkedUser: { resetPasswordSureMessage: "¿Generar una nueva contraseña temporal para este empleado? Su contraseña actual dejará de funcionar.", resetPasswordTitle: "Restablecer contraseña", resetPassword: "Restablecer contraseña", loginNotCreatedTitle: "Empleado creado, pero aún sin acceso", loginCreatedMessage: "Correo: {email}\nContraseña temporal: {password}\n\nCompártela con el empleado — no se volverá a mostrar.", loginCreatedTitle: "Acceso creado", createLoginSureMessage: "¿Crear un nuevo acceso de autoservicio para este empleado? Se generará una contraseña temporal que se mostrará una sola vez.", createLoginTitle: "Crear acceso", createLogin: "Crear un nuevo acceso", orCreateNew: "o", actionFailed: "Algo salió mal. Inténtalo de nuevo.", searchPlaceholder: "Buscar usuarios por nombre o correo...", unlinkSureMessage: "¿Desvincular esta cuenta de este empleado? Perderá el acceso a Mi espacio.", unlinkTitle: "Desvincular cuenta de usuario", linkSureMessage: "¿Vincular esta cuenta a este empleado? Tendrá acceso a Mi espacio (nóminas, solicitudes de ausencia y anticipo, asistencia).", linkTitle: "Vincular cuenta de usuario", unlink: "Desvincular", link: "Vincular", linkedTo: "Vinculado a:", title: "Acceso de autoservicio", },
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

      documents: {
        menuButton: "Documentos",
        attestationTravail: "Certificado de empleo",
        attestationSalaire: "Certificado de empleo y salario",
        certificatTravail: "Certificado de trabajo",
        contratTravail: "Contrato de trabajo",
        soldeToutCompte: "Recibo de finiquito",
        generationFailed: "Error al generar el documento.",
      },

      bulkImport: {
        exportButton: "Exportar (CSV)",
        exportFailed: "No se pudieron exportar los empleados.",
        openButton: "Importar (CSV)",
        title: "Importar empleados en masa",
        helpText: "Sube un archivo CSV para crear varios empleados a la vez. Cada fila se comprueba primero — no se crea nada hasta que confirmes.",
        downloadTemplate: "Descargar plantilla CSV",
        preview: "Comprobar archivo",
        previewing: "Comprobando...",
        previewFailed: "No se pudo leer este archivo.",
        summaryValid: "{count} listo(s) para importar",
        summaryErrors: "{count} con errores",
        summaryWarnings: "{count} con avisos",
        rowOk: "Todo correcto",
        fixErrorsFirst: "Corrige las filas con errores y vuelve a subir el archivo antes de importar — las filas con solo avisos se importarán igualmente.",
        importButton: "Importar {count} empleado(s)",
        committing: "Importando...",
        commitFailed: "No se pudo completar la importación.",
        commitSuccess: "{count} empleado(s) importado(s) correctamente.",
      },

      fields: { createLoginCheckboxLabel: "Crear también un acceso de autoservicio para este empleado (usa su correo profesional)", createLogin: "Acceso de autoservicio", noDepartments: "Aún no hay departamentos — añade uno en Organización > Departamentos", manager: "Responsable directo", noManagerCandidates: "Aún no hay otro empleado en esta empresa",
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

      history: { deleteRecord: "Eliminar este registro salarial",
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
        reviewComment: "Comentario de revisión",
        status: "Estado",
      },

      types: {
        paid_leave: "Permiso retribuido",
        unpaid_leave: "Permiso no retribuido",
        sick_leave: "Baja por enfermedad",
        absence: "Ausencia",
        other: "Otro",
      },

      status: { manager_approved: "Aprobada por el responsable",
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
        reviewComment: "Comentario de revisión",
        status: "Estado",
      },

      status: { manager_approved: "Aprobada por el responsable",
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

    units: {
      unit: "Unidad",
      piece: "Pieza",
      pair: "Par",
      dozen: "Docena",
      set: "Juego",
      kg: "Kilogramo (kg)",
      g: "Gramo (g)",
      t: "Tonelada (t)",
      lb: "Libra (lb)",
      oz: "Onza (oz)",
      quintal: "Quintal (q)",
      l: "Litro (L)",
      ml: "Mililitro (mL)",
      m3: "Metro cúbico (m³)",
      gal: "Galón (gal)",
      m: "Metro (m)",
      cm: "Centímetro (cm)",
      mm: "Milímetro (mm)",
      km: "Kilómetro (km)",
      ft: "Pie (ft)",
      in: "Pulgada (in)",
      yd: "Yarda (yd)",
      m2: "Metro cuadrado (m²)",
      ft2: "Pie cuadrado (ft²)",
      ha: "Hectárea (ha)",
      box: "Caja",
      carton: "Cartón",
      pallet: "Palé",
      bag: "Bolsa",
      sack: "Saco",
      bottle: "Botella",
      can: "Lata",
      roll: "Rollo",
      sheet: "Hoja",
      bundle: "Paquete",
      case: "Estuche",
      drum: "Tambor",
      barrel: "Barril",
      container: "Contenedor",
      hour: "Hora",
      day: "Día",
      month: "Mes",
    },

    contentTranslation: {
      title: "Traducciones",
      editButton: "Traducciones",
      original: "Original",
      auto: "Traducido automáticamente",
      manual: "Editado manualmente",
      missing: "Aún no traducido",
      regenerate: "Regenerar",
      originalHint: "Este es el texto original — edita el campo mismo para cambiarlo.",
      save: "Guardar",
      saving: "Guardando…",
      close: "Cerrar",
      placeholder: "Ingresa la traducción…",
      errors: {
        loadFailed: "No se pudieron cargar las traducciones.",
        saveFailed: "No se pudo guardar la traducción.",
        regenerateFailed: "No se pudo regenerar la traducción.",
      },
    },

    departments: { noManagerBadge: "Sin responsable", managerLabel: "Responsable", moduleAccessBadge: "Acceso al módulo",
      title: "Departamentos",
      subtitle: "Defina los departamentos de su organización y los puestos dentro de cada uno.",
      addDepartment: "Añadir departamento",
      addDefaults: "Añadir departamentos predeterminados",
      defaultsModal: {
        title: "Añadir departamentos predeterminados",
        helpText: "Elige los departamentos que quieres añadir — cada uno incluye un nombre y descripción estándar y (para RR. HH./Producción) el acceso al módulo ya configurado. Podrás editarlos o añadir más después.",
        adding: "Añadiendo...",
        addButton: "Añadir {count} departamento(s)",
      },
      editDepartment: "Editar departamento",
      addPosition: "Añadir puesto",
      editPosition: "Editar puesto",
      deleteTitle: "Eliminar departamento",
      deleteSureMessage: "¿Seguro que desea eliminar este departamento? Los empleados y puestos que aún lo usan deben reasignarse primero.",
      deletePositionTitle: "Eliminar puesto",
      deletePositionSureMessage: "¿Seguro que desea eliminar este puesto? Los empleados que lo ocupan, u otros puestos que dependen de él, deben reasignarse primero.",
      emptyTitle: "Aún no hay departamentos",
      emptyMessage: "Añada su primer departamento para empezar a construir su estructura organizativa.",
      searchPlaceholder: "Buscar departamentos...",
      noSearchResults: "Ningún departamento coincide con tu búsqueda.",
      noPositions: "Aún no hay puestos definidos en este departamento.",
      fields: { purchasingAccess: "Acceso al módulo de Compras", manager: "Responsable del departamento", noManager: "Sin responsable", managerHint: "Supervisa todo el departamento: acceso completo al módulo, aprueba las solicitudes del equipo y decide qué puestos dan acceso al módulo.", grantsModuleAccess: "Da acceso al módulo", grantsModuleAccessHint: "Quienes ocupen este puesto acceden al módulo del departamento (p. ej. RR. HH. o Inventario). Déjalo desactivado para el personal que solo debe ver Mi espacio.",
        name: "Nombre", description: "Descripción", permissionKey: "Acceso al módulo",
        permissionKeyHint: "Opcional — asígnelo solo a UN departamento si los empleados de ahí (y sus cuentas creadas automáticamente) deben tener acceso al módulo de RR. HH. o de Producción. La mayoría de los departamentos deben dejarlo en «Sin acceso especial».",
        category: "Función",
        noCategory: "Sin función específica",
        categoryHint: "Opcional — permite que el formulario de empleado sugiera puestos estándar para este departamento en lugar de dejarlo como texto libre. Es solo una sugerencia, sin relación con los accesos, a diferencia del campo Acceso al módulo anterior.",
        noSpecialAccess: "Sin acceso especial", hrAccess: "Acceso al módulo de RR. HH.", productionAccess: "Acceso al módulo de Producción",
        positionTitle: "Nombre del puesto", reportsTo: "Depende de", noReportsTo: "Ninguno (puesto de nivel superior)",
        salaryMin: "Banda salarial — mín.", salaryMax: "Banda salarial — máx.", salaryBand: "Banda salarial",
        requiredSkills: "Habilidades requeridas", requiredSkillsPlaceholder: "Separadas por comas, ej. Excel, Liderazgo",
      },
      errors: {
        nameRequired: "El nombre del departamento es obligatorio", titleRequired: "El nombre del puesto es obligatorio",
        saveFailed: "Ocurrió un error al guardar.", deleteFailed: "Ocurrió un error al eliminar.",
      },
    },

    payroll: {
      title: "Nómina",
      subtitle: "Genere ciclos de nómina mensuales y gestione los recibos de sueldo.",
      generateRun: "Generar nómina",
      createTitle: "Generar ciclo de nómina",
      createSureMessage: "¿Generar la nómina de este período? Se creará un recibo de sueldo para cada empleado activo con un salario registrado.",
      createSuccessTitle: "Ciclo de nómina creado",
      createSuccessMessage: "El ciclo de nómina se generó correctamente.",
      completeTitle: "Cerrar ciclo de nómina",
      completeSureMessage: "¿Cerrar este ciclo de nómina? Una vez cerrado, los recibos quedan bloqueados y se notifica a los empleados.",
      deleteTitle: "Eliminar ciclo de nómina",
      deleteSureMessage: "¿Eliminar este ciclo de nómina en borrador y todos sus recibos? Esta acción no se puede deshacer.",
      emptyTitle: "Aún no hay ciclos de nómina",
      emptyMessage: "Genere el primer ciclo de nómina para esta empresa.",
      noPayslips: "No hay recibos de sueldo en este ciclo.",
      fields: { month: "Mes", year: "Año", status: "Estado" },
      table: { period: "Período", employees: "Empleados", gross: "Bruto", net: "Neto", searchPlaceholder: "Buscar empleados..." },
      status: { draft: "Borrador", completed: "Cerrado", voided: "Anulado" },
      payslipStatus: { draft: "Borrador", validated: "Validado", paid: "Pagado" },
      actions: { view: "Ver", complete: "Cerrar", regenerate: "Regenerar", markPaid: "Marcar como pagado", downloadPdf: "Descargar recibo" },
      exports: {
        cnss: "Exportación CNSS",
        cnssHint: "Hoja de declaración — verifique con el formato Damancom actual antes de subirla",
        register: "Registro de nómina",
        bankTransfer: "Archivo de transferencia bancaria",
      },
      buttons: { generate: "Generar", saving: "Guardando..." },
      breadcrumbs: { hr: "RR. HH.", payroll: "Nómina" },
      months: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
      errors: { fetchFailed: "Error al cargar los ciclos de nómina", actionFailed: "Algo salió mal. Inténtalo de nuevo." },
    },

    contracts: {
      title: "Contratos",
      subtitle: "Realice el seguimiento de los contratos de trabajo, sus renovaciones y vencimientos.",
      addContract: "Nuevo contrato",
      createTitle: "Nuevo contrato",
      createSureMessage: "¿Seguro que desea crear este contrato?",
      createSuccessTitle: "Contrato creado",
      createSuccessMessage: "El contrato se creó correctamente.",
      renewTitle: "Renovar contrato",
      renewSureMessage: "¿Renovar este contrato? El contrato actual se cerrará y comenzará uno nuevo.",
      deleteTitle: "Eliminar contrato",
      deleteSureMessage: "¿Seguro que desea eliminar este contrato? Esta acción no se puede deshacer.",
      emptyTitle: "Aún no hay contratos",
      emptyMessage: "Esta empresa aún no tiene contratos registrados.",
      expiringBanner: "{count} contrato(s) vencen en los próximos 30 días.",
      fields: { employee: "Empleado", type: "Tipo de contrato", startDate: "Fecha de inicio", endDate: "Fecha de fin" },
      status: { active: "Activo", expired: "Vencido", terminated: "Rescindido", renewed: "Renovado" },
      actions: { renew: "Renovar" },
      buttons: { create: "Guardar contrato" },
      breadcrumbs: { hr: "RR. HH.", contracts: "Contratos" },
      errors: { fetchFailed: "Error al cargar los contratos", actionFailed: "Algo salió mal. Inténtalo de nuevo." },
    },

    documents: {
      title: "Documentos",
      subtitle: "Almacene los documentos de los empleados y controle sus fechas de vencimiento.",
      uploadDocument: "Subir documento",
      editDocument: "Editar documento",
      deleteTitle: "Eliminar documento",
      deleteSureMessage: "¿Seguro que desea eliminar este documento? Esta acción no se puede deshacer.",
      emptyTitle: "Aún no hay documentos",
      emptyMessage: "Esta empresa aún no tiene documentos registrados.",
      expiringBanner: "{count} documento(s) vencen en los próximos 30 días.",
      fields: { employee: "Empleado", type: "Tipo", label: "Etiqueta", labelPlaceholder: "ej. Documento de identidad", expiryDate: "Fecha de vencimiento", file: "Archivo", replaceFile: "Reemplazar archivo (opcional)" },
      table: { file: "Archivo" },
      types: {
        cin: "DNI (CIN)", passport: "Pasaporte", work_permit: "Permiso de trabajo",
        residence_permit: "Permiso de residencia", contract: "Contrato", diploma: "Diploma",
        cv: "CV", medical_certificate: "Certificado médico", other: "Otro",
      },
      actions: { view: "Ver", loadMore: "Cargar más", loadMoreCount: "Mostrando {loaded} de {total}" },
      buttons: { upload: "Subir" },
      breadcrumbs: { hr: "RR. HH.", documents: "Documentos" },
      errors: {
        fetchFailed: "Error al cargar los documentos", actionFailed: "Algo salió mal. Inténtalo de nuevo.",
        missingFields: "Seleccione un empleado y un archivo.", uploadFailed: "Error al subir el documento.",
      },
    },

    attendance: {
      title: "Asistencia",
      subtitle: "Consulte los registros de entrada y salida.",
      emptyTitle: "No hay registros de asistencia",
      emptyMessage: "Ningún registro de asistencia coincide con sus filtros.",
      filterAllEmployees: "Todos los empleados",
      fields: { employee: "Empleado", date: "Fecha", clockIn: "Entrada", clockOut: "Salida", notes: "Notas" },
      status: { present: "Presente", late: "Tarde", absent: "Ausente", half_day: "Media jornada", holiday: "Festivo" },
      breadcrumbs: { hr: "RR. HH.", attendance: "Asistencia" },
      errors: { fetchFailed: "Error al cargar la asistencia" },
    },

    reports: { chart: { zoomHint: "Arrastra los controles bajo el gráfico para ampliar", yearly: "Anual", monthly: "Mensual", view: "Vista", lastMonths: "Últimos {n} meses", range: "Periodo", },
      title: "Informes",
      subtitle: "Plantilla, rotación, absentismo y evolución del coste de la nómina.",
      stats: { totalHeadcount: "Plantilla total", activeEmployees: "Empleados activos", currentGross: "Bruto mensual actual (est.)", currentNet: "Neto mensual actual (est.)", missingSalaryNote: "{count} empleado(s) activo(s) aún no tienen un salario registrado — no incluidos en esta estimación." },
      expand: "Ampliar",
      charts: {
        headcountByDepartment: "Plantilla por departamento", turnover: "Rotación (últimos 12 meses)",
        hires: "Contrataciones", terminations: "Bajas", absenteeism: "Tasa de absentismo (últimos 6 meses)",
        absenteeismRate: "Tasa de absentismo", payrollCost: "Coste de la nómina (últimos 12 meses)",
        estimatedFootnote: "* El mes actual, marcado con un asterisco, es una estimación en tiempo real basada en los salarios actuales — la nómina aún no se ha ejecutado para este período.",
      },
      breadcrumbs: { hr: "RR. HH.", reports: "Informes" },
      loadError: "No se pudieron cargar algunos datos del informe. Inténtalo de nuevo o consulta la consola para más detalles.",
      rankings: {
        title: "Clasificación de empleados",
        last30Days: "Últimos 30 días",
        last90Days: "Últimos 90 días",
        last365Days: "Últimos 12 meses",
        mostAbsenceDays: "Más días de ausencia",
        bestAttendanceRate: "Mejor tasa de asistencia",
        mostOvertimeHours: "Más horas extra",
        mostLateDays: "Más llegadas tarde",
        noData: "No hay datos para este período.",
        days: "días",
      },
    },  twoFactor: { qrAlt: "Código QR de 2FA",
    title: "Autenticación de dos factores",
    disabledHint: "Añade una capa extra de seguridad a tu cuenta — además de tu contraseña, necesitarás un código de una aplicación de autenticación para iniciar sesión.",
    enabledHint: "La autenticación de dos factores está activada en tu cuenta. Se te pedirá un código de tu aplicación de autenticación cada vez que inicies sesión.",
    enableButton: "Activar la autenticación de dos factores",
    disableButton: "Desactivar la autenticación de dos factores",
    disabling: "Desactivando...",
    scanTitle: "Escanea el código QR",
    scanHint: "Escanéalo con una aplicación de autenticación (Google Authenticator, Authy, etc.) y luego introduce el código de 6 dígitos que muestra para confirmar.",
    manualEntryLabel: "¿No puedes escanearlo? Introduce este código manualmente:",
    confirmAndEnable: "Confirmar y activar",
    verifying: "Verificando...",
    backupCodesTitle: "Guarda tus códigos de respaldo",
    backupCodesHint: "Cada código se puede usar una vez para iniciar sesión si pierdes el acceso a tu aplicación de autenticación. Guárdalos en un lugar seguro — no se volverán a mostrar.",
    copyBackupCodes: "Copiar códigos",
    copied: "Copiado",
    iSavedThem: "He guardado estos códigos",
    confirmPasswordLabel: "Confirma tu contraseña para continuar",
    errors: {
      statusFailed: "No se pudo comprobar el estado de la autenticación de dos factores.",
      setupFailed: "No se pudo iniciar la configuración de la autenticación de dos factores.",
      invalidCode: "Ese código no coincide — revisa tu aplicación de autenticación e inténtalo de nuevo.",
      disableFailed: "No se pudo desactivar la autenticación de dos factores.",
    },
  },

  disciplinaryActions: {
    title: "Acciones disciplinarias",
    subtitle: "Registra advertencias y medidas correctivas emitidas a los empleados.",
    addAction: "Añadir registro",
    editAction: "Editar registro",
    emptyTitle: "Aún no hay registros disciplinarios",
    emptyMessage: "Esta empresa no tiene acciones disciplinarias registradas.",
    deleteTitle: "Eliminar registro",
    deleteSureMessage: "¿Seguro que deseas eliminar este registro? Esta acción no se puede deshacer.",
    acknowledged: "Confirmado",
    notAcknowledged: "Aún sin confirmar",
    breadcrumbs: {
      hr: "RR. HH.",
      disciplinaryActions: "Acciones disciplinarias",
    },
    fields: {
      employee: "Empleado",
      type: "Tipo",
      date: "Fecha",
      reason: "Motivo",
      description: "Descripción",
      suspensionDays: "Suspensión (días)",
      issuedBy: "Emitido por",
      notes: "Notas",
    },
    types: {
      verbal_warning: "Advertencia verbal",
      written_warning: "Advertencia por escrito",
      final_warning: "Última advertencia",
      suspension: "Suspensión",
      termination_notice: "Aviso de despido",
    },
    errors: {
      fetchFailed: "Error al cargar las acciones disciplinarias",
      saveFailed: "Error al guardar el registro",
      deleteFailed: "Error al eliminar el registro",
    },
  },
  performanceReviews: {
    title: "Evaluaciones de desempeño",
    subtitle: "Ciclos de evaluación, objetivos y calificaciones de tus empleados.",
    addReview: "Nueva evaluación",
    editReview: "Editar evaluación",
    emptyTitle: "Aún no hay evaluaciones",
    emptyMessage: "Esta empresa no tiene evaluaciones registradas.",
    deleteTitle: "Eliminar evaluación",
    deleteSureMessage: "¿Seguro que deseas eliminar esta evaluación? Esta acción no se puede deshacer.",
    reviewedBy: "Evaluado por",
    submitButton: "Enviar al empleado",
    breadcrumbs: {
      hr: "RR. HH.",
      performanceReviews: "Evaluaciones",
    },
    fields: {
      employee: "Empleado",
      reviewer: "Evaluador",
      periodLabel: "Período de evaluación",
      periodLabelPlaceholder: "ej. Evaluación anual 2026",
      reviewDate: "Fecha de evaluación",
      goals: "Objetivos (uno por línea)",
      goalsPlaceholder: "Mejorar el tiempo de respuesta en tickets de soporte\nCompletar la certificación de incorporación",
      strengths: "Fortalezas",
      areasForImprovement: "Áreas de mejora",
      comments: "Comentarios",
    },
    criteria: {
      jobKnowledge: "Conocimiento del puesto",
      qualityOfWork: "Calidad del trabajo",
      communication: "Comunicación",
      teamwork: "Trabajo en equipo",
      initiative: "Iniciativa",
      punctuality: "Puntualidad",
    },
    statuses: {
      draft: "Borrador",
      submitted: "Enviada",
      acknowledged: "Confirmada",
    },
    errors: {
      fetchFailed: "Error al cargar las evaluaciones",
      saveFailed: "Error al guardar la evaluación",
      submitFailed: "Error al enviar la evaluación",
      deleteFailed: "Error al eliminar la evaluación",
    },
  },
  leaveCalendar: {
    title: "Calendario de ausencias",
    subtitle: "Consulta de un vistazo quién está de baja aprobada.",
    previousMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    breadcrumbs: {
      hr: "RR. HH.",
      leaveCalendar: "Calendario de ausencias",
    },
    weekdays: {
      0: "Lun",
      1: "Mar",
      2: "Mié",
      3: "Jue",
      4: "Vie",
      5: "Sáb",
      6: "Dom",
    },
    errors: {
      fetchFailed: "Error al cargar el calendario de ausencias",
    },
  },
  },

  // ======================================================
  // PORTUGUESE
  // ======================================================

  pt: { login: { useBackupCode: "Usar um código de recuperação", useAuthenticator: "Usar o código da app", invalidCode: "Código inválido", verifying: "A verificar...", verify: "Verificar", backupCodeHint: "Introduza um dos seus códigos de recuperação.", authenticatorHint: "Introduza o código de 6 dígitos da sua app de autenticação.", failed: "Falha ao iniciar sessão", signingIn: "A iniciar sessão...", signIn: "Iniciar sessão", password: "Palavra-passe", email: "E-mail", }, notifications: { daysShort: "d", hoursShort: "h", minutesShort: "min", now: "agora", markAllRead: "Marcar tudo como lido", empty: "Ainda sem notificações.", title: "Notificações", }, orgChart: { breadcrumbs: { orgChart: "Organograma", hr: "RH", }, emptyMessage: "Defina uma chefia nos funcionários para construir a estrutura.", emptyTitle: "Ainda sem organograma", subtitle: "Estrutura hierárquica, com base na chefia de cada funcionário.", title: "Organograma", }, auditLog: { errors: { fetchFailed: "Não foi possível carregar o registo de auditoria", actionFailed: "Esta ação falhou. Tente novamente.", }, breadcrumbs: { auditLog: "Registo de auditoria", hr: "RH", }, actions: { review: "Revisto", delete: "Eliminado", update: "Alterado", create: "Criado", }, resourceTypes: { WorkSchedule: "Horário de trabalho", PayrollRun: "Processamento salarial", EmployeeDocument: "Documento", Contract: "Contrato", Advance: "Adiantamento", Absence: "Ausência", Salary: "Salário", Employee: "Funcionário", }, fields: { date: "Data", actor: "Por", resource: "Registo", resourceType: "Tipo", action: "Ação", }, emptyMessage: "Ainda não há alterações registadas para este filtro.", emptyTitle: "Ainda sem atividade", deleteSureMessage: "Eliminar esta entrada? Não é possível anular.", deleteTitle: "Eliminar entrada do registo", subtitle: "Quem alterou o quê e quando.", title: "Registo de auditoria", }, purchaseRequests: { status: { received: "Recebido", }, fields: { requestedBy: "Pedido por", quantity: "Quantidade", product: "Artigo", }, markReceived: "Marcar como recebido", emptyMessage: "Nenhum pedido corresponde aos filtros.", emptyTitle: "Sem pedidos de compra", subtitle: "Pedidos de reposição enviados às Compras, e a respetiva resposta.", title: "Pedidos de compra", }, production: { title: "Produção", }, holidays: { title: "Feriados", subtitle: "Os feriados do ano: se a empresa trabalha e como são pagas as horas trabalhadas.", downloadTemplate: "Descarregar modelo", import: "Importar Excel", add: "Adicionar feriado", year: "Ano", howItWorks: "Todos os anos: descarregue o modelo (os feriados de data fixa já estão preenchidos), acrescente os feriados religiosos com as datas oficiais e importe-o. Feriado encerrado: ninguém é esperado e as horas de quem registar ponto contam como horas de feriado. Pagamento «a dobrar» acrescenta uma hora paga por cada hora trabalhada; «normal» não acrescenta nada.", importDone: "Importação concluída: {created} adicionados, {updated} atualizados.", namePlaceholder: "Nome do feriado (ex. Aïd al-Fitr)", previewTitle: "Pré-visualização de {file}", previewErrors: "{count} linha(s) a corrigir — corrija o ficheiro e importe-o novamente", previewReady: "{count} linha(s) prontas a importar", columns: { row: "Linha", date: "Data", name: "Nome", open: "Empresa", pay: "Pagamento se trabalhado", check: "Verificação" }, defaultClosed: "Encerrada (predefinição)", defaultDouble: "A dobrar (predefinição)", open: "Aberta", closed: "Encerrada", payDouble: "A dobrar", payNormal: "Normal", confirmImport: "Importar", emptyTitle: "Ainda não há feriados para {year}", emptyMessage: "Descarregue o modelo, preencha-o e importe-o.", deleteTitle: "Eliminar feriado", deleteMessage: "Eliminar «{name}»? Os registos de ponto desse dia são mantidos.", errors: { load: "Não foi possível carregar os feriados.", save: "Não foi possível guardar esta alteração.", template: "Não foi possível descarregar o modelo.", read: "Não foi possível ler este ficheiro.", import: "A importação falhou." } }, myDepartment: { adminTitle: "Acesso por departamento", adminSubtitle: "Todos os departamentos que supervisiona: o responsável, que cargos dão acesso ao módulo e quem tem acesso.", adminEmptyTitle: "Ainda não há departamentos.", noManagerAssigned: "Sem responsável atribuído", title: "O meu departamento", subtitle: "A sua equipa e que cargos dão acesso ao módulo do departamento.", loadError: "Não foi possível carregar o seu departamento.", saveError: "Não foi possível guardar esta alteração.", saved: "Guardado.", accountsUpdated: "Guardado — {count} conta(s) atualizada(s).", emptyTitle: "Ainda não gere nenhum departamento.", positionsTitle: "Cargos e acesso", positionsHint: "Ative um cargo para dar a todos os seus titulares acesso ao módulo do departamento. Os restantes veem apenas O meu espaço.", noModule: "Este departamento não desbloqueia nenhum módulo, por isso não há acesso a distribuir.", noPositions: "Ainda não há cargos definidos para este departamento.", holders: "{count} funcionário(s)", toggleLabel: "Dá acesso ao módulo", teamTitle: "Equipa", noEmployees: "Não há funcionários neste departamento.", columns: { name: "Nome", jobTitle: "Cargo", access: "Acesso" }, noLogin: "Sem conta", moduleAccess: "Acesso ao módulo", mySpaceOnly: "Apenas O meu espaço" },
    sidebar: { platform: "Plataforma", clients: "Clientes", purchasingReports: "Relatórios de compras", restock: "Reposição", inventorySettings: "Definições", purchaseRequests: "Pedidos de compra", inventory: "Inventário", production: "Produção", workSchedule: "Horário de trabalho", auditLog: "Registo de auditoria", reports: "Relatórios", orgChart: "Organograma", attendance: "Assiduidade", employeeDocuments: "Documentos", contracts: "Contratos", payroll: "Processamento salarial", supplierInvoices: "Faturas de fornecedores", purchasing: "Compras", purchaseRequestsQueue: "Pedidos de compra", purchaseOrders: "Notas de encomenda", priceRequests: "Pedidos de cotação", suppliers: "Fornecedores", purchasingInventory: "Inventário", articleHistory: "Histórico do artigo", holidays: "Feriados", departmentAccess: "Acesso por departamento", myDepartment: "O meu departamento", mySpace: "O meu espaço", myProfile: "O meu perfil", myPayslips: "Os meus recibos", myAbsences: "As minhas ausências", myAdvances: "Os meus adiantamentos", myAttendance: "A minha assiduidade", myRecords: "O meu processo",
      leaveCalendar: "Calendário de ausências",
      performanceReviews: "Avaliações de desempenho",
      disciplinaryActions: "Ações disciplinares",
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

    common: { home: "Início", breadcrumb: "Trilho de navegação", clear: "Limpar", clearSearch: "Limpar pesquisa", nextPage: "Página seguinte", previousPage: "Página anterior", pagination: "Paginação", hidePassword: "Ocultar palavra-passe", showPassword: "Mostrar palavra-passe", somethingWentWrong: "Algo correu mal", confirmAction: "Confirmar ação", pageNotFoundHint: "Esta página não existe ou foi movida.", pageNotFound: "Página não encontrada", status: "Estado", save: "Guardar", back: "Voltar", dateFrom: "De", dateTo: "Até",
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
      chooseFile: "Escolher ficheiro",
      noFileChosen: "Nenhum ficheiro escolhido",
    },

    profile: { loadFailed: "Não foi possível carregar o perfil",
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

    company: { workflow: { accountInvalid: "Uma conta contabilística tem 4 a 10 dígitos.", purchaseAccountHint: "Usada na exportação contabilística para artigos cuja categoria não tem conta própria e para linhas escritas à mão (ex. 6111, 6121, 6125).", purchaseAccount: "Conta de compras predefinida", purchaseThresholdHint: "Encomendas com valor (IVA incl.) igual ou superior têm de ser aprovadas por um admin, o proprietário ou o responsável de compras. 0 = sem aprovação.", purchaseThreshold: "Limite de aprovação de encomendas", title: "Fluxo de aprovação", sequentialApproval: "Aprovação da chefia antes dos RH", sequentialApprovalHint: "Quando ativo, os pedidos de ausência e adiantamento têm de ser aprovados primeiro pela chefia do funcionário e depois receber a aprovação final dos RH. Funcionários sem chefia seguem diretamente para os RH.", saveFailed: "Não foi possível guardar esta definição." },
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

      downloadFiche:
        "Descarregar ficha",

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

        ficheDownloadFailed:
          "Erro ao gerar a ficha da empresa.",

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
      inheritedFromEmployee: "O departamento e a função de RH são herdados do funcionário associado {name} ({department} — {jobTitle}). Para os alterar, atualize o Departamento ou o Cargo do funcionário.",

      updateTitle: "Editar utilizador",
      updateSureMessage: "Tem a certeza de que deseja guardar estas alterações?",

      updateSuccessTitle: "Utilizador atualizado",
      updateSuccessMessage: "O utilizador foi atualizado com sucesso.",

      updateFailTitle: "Falha ao atualizar",
      updateFailMessage: "Não foi possível atualizar o utilizador. Tente novamente.",

      hrRole: {
        label: "Cargo de RH",
        notApplicable: "Não aplicável (fora de RH)",
        assistant: "Assistente de RH",
        officer: "Encarregado/a de RH",
        manager: "Responsável de RH",
        director: "Diretor/a de RH",
      },

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
    employees: { related: { tabs: { attendance: "Assiduidade", documents: "Documentos", contracts: "Contratos", advances: "Adiantamentos", absences: "Ausências", salary: "Salário", }, empty: "Ainda nada aqui.", }, linkedUser: { resetPasswordSureMessage: "Gerar uma nova palavra-passe temporária para este funcionário? A atual deixará de funcionar.", resetPasswordTitle: "Redefinir palavra-passe", resetPassword: "Redefinir palavra-passe", loginNotCreatedTitle: "Funcionário criado, mas ainda sem acesso", loginCreatedMessage: "E-mail: {email}\nPalavra-passe temporária: {password}\n\nPartilhe com o funcionário — não será mostrada novamente.", loginCreatedTitle: "Acesso criado", createLoginSureMessage: "Criar um novo acesso de autosserviço para este funcionário? Será gerada uma palavra-passe temporária, mostrada uma única vez.", createLoginTitle: "Criar acesso", createLogin: "Criar novo acesso", orCreateNew: "ou", actionFailed: "Algo correu mal. Tente novamente.", searchPlaceholder: "Pesquisar utilizadores por nome ou e-mail...", unlinkSureMessage: "Desligar esta conta deste funcionário? Perderá o acesso a O meu espaço.", unlinkTitle: "Desligar conta de utilizador", linkSureMessage: "Ligar esta conta a este funcionário? Terá acesso a O meu espaço (recibos, pedidos de ausência e adiantamento, assiduidade).", linkTitle: "Ligar conta de utilizador", unlink: "Desligar", link: "Ligar", linkedTo: "Ligado a:", title: "Acesso de autosserviço", },
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

      documents: {
        menuButton: "Documentos",
        attestationTravail: "Certificado de trabalho",
        attestationSalaire: "Certificado de trabalho e salário",
        certificatTravail: "Certificado de trabalho (fim de contrato)",
        contratTravail: "Contrato de trabalho",
        soldeToutCompte: "Recibo de saldo de contas",
        generationFailed: "Erro ao gerar o documento.",
      },

      bulkImport: {
        exportButton: "Exportar (CSV)",
        exportFailed: "Não foi possível exportar os funcionários.",
        openButton: "Importar (CSV)",
        title: "Importar funcionários em massa",
        helpText: "Carregue um ficheiro CSV para criar vários funcionários de uma vez. Cada linha é verificada primeiro — nada é criado até confirmar.",
        downloadTemplate: "Transferir modelo CSV",
        preview: "Verificar ficheiro",
        previewing: "A verificar...",
        previewFailed: "Não foi possível ler este ficheiro.",
        summaryValid: "{count} pronto(s) a importar",
        summaryErrors: "{count} com erros",
        summaryWarnings: "{count} com avisos",
        rowOk: "Tudo certo",
        fixErrorsFirst: "Corrija as linhas com erros e volte a carregar o ficheiro antes de importar — as linhas apenas com avisos serão importadas na mesma.",
        importButton: "Importar {count} funcionário(s)",
        committing: "A importar...",
        commitFailed: "Não foi possível concluir a importação.",
        commitSuccess: "{count} funcionário(s) importado(s) com sucesso.",
      },

      fields: { createLoginCheckboxLabel: "Criar também um acesso de autosserviço para este funcionário (usa o e-mail profissional)", createLogin: "Acesso de autosserviço", noDepartments: "Ainda não há departamentos — adicione um em Organização > Departamentos", manager: "Chefia direta", noManagerCandidates: "Ainda não há outro funcionário nesta empresa",
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

      history: { deleteRecord: "Eliminar este registo salarial",
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
        reviewComment: "Comentário de revisão",
        status: "Estado",
      },

      types: {
        paid_leave: "Férias pagas",
        unpaid_leave: "Licença sem vencimento",
        sick_leave: "Baixa médica",
        absence: "Ausência",
        other: "Outro",
      },

      status: { manager_approved: "Aprovada pela chefia",
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
        reviewComment: "Comentário de revisão",
        status: "Estado",
      },

      status: { manager_approved: "Aprovada pela chefia",
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

    units: {
      unit: "Unidade",
      piece: "Peça",
      pair: "Par",
      dozen: "Dúzia",
      set: "Conjunto",
      kg: "Quilograma (kg)",
      g: "Grama (g)",
      t: "Tonelada (t)",
      lb: "Libra (lb)",
      oz: "Onça (oz)",
      quintal: "Quintal (q)",
      l: "Litro (L)",
      ml: "Mililitro (mL)",
      m3: "Metro cúbico (m³)",
      gal: "Galão (gal)",
      m: "Metro (m)",
      cm: "Centímetro (cm)",
      mm: "Milímetro (mm)",
      km: "Quilómetro (km)",
      ft: "Pé (ft)",
      in: "Polegada (in)",
      yd: "Jarda (yd)",
      m2: "Metro quadrado (m²)",
      ft2: "Pé quadrado (ft²)",
      ha: "Hectare (ha)",
      box: "Caixa",
      carton: "Caixa de cartão",
      pallet: "Palete",
      bag: "Saco",
      sack: "Saco",
      bottle: "Garrafa",
      can: "Lata",
      roll: "Rolo",
      sheet: "Folha",
      bundle: "Pacote",
      case: "Caixote",
      drum: "Tambor",
      barrel: "Barril",
      container: "Contentor",
      hour: "Hora",
      day: "Dia",
      month: "Mês",
    },

    contentTranslation: {
      title: "Traduções",
      editButton: "Traduções",
      original: "Original",
      auto: "Traduzido automaticamente",
      manual: "Editado manualmente",
      missing: "Ainda não traduzido",
      regenerate: "Regenerar",
      originalHint: "Este é o texto original — edite o próprio campo para alterá-lo.",
      save: "Guardar",
      saving: "A guardar…",
      close: "Fechar",
      placeholder: "Introduza a tradução…",
      errors: {
        loadFailed: "Falha ao carregar as traduções.",
        saveFailed: "Falha ao guardar a tradução.",
        regenerateFailed: "Falha ao regenerar a tradução.",
      },
    },

    departments: { noManagerBadge: "Sem responsável", managerLabel: "Responsável", moduleAccessBadge: "Acesso ao módulo",
      title: "Departamentos",
      subtitle: "Defina os departamentos da sua organização e os cargos dentro de cada um.",
      addDepartment: "Adicionar departamento",
      addDefaults: "Adicionar departamentos predefinidos",
      defaultsModal: {
        title: "Adicionar departamentos predefinidos",
        helpText: "Escolha os departamentos que pretende adicionar — cada um vem com um nome e descrição padrão e (para RH/Produção) o acesso ao módulo já configurado. Pode sempre editá-los ou adicionar mais depois.",
        adding: "A adicionar...",
        addButton: "Adicionar {count} departamento(s)",
      },
      editDepartment: "Editar departamento",
      addPosition: "Adicionar cargo",
      editPosition: "Editar cargo",
      deleteTitle: "Eliminar departamento",
      deleteSureMessage: "Tem a certeza de que pretende eliminar este departamento? Os funcionários e cargos que ainda o utilizam devem ser reatribuídos primeiro.",
      deletePositionTitle: "Eliminar cargo",
      deletePositionSureMessage: "Tem a certeza de que pretende eliminar este cargo? Os funcionários que o ocupam, ou outros cargos subordinados a ele, devem ser reatribuídos primeiro.",
      emptyTitle: "Ainda não há departamentos",
      emptyMessage: "Adicione o seu primeiro departamento para começar a construir a sua estrutura organizacional.",
      searchPlaceholder: "Pesquisar departamentos...",
      noSearchResults: "Nenhum departamento corresponde à sua pesquisa.",
      noPositions: "Ainda não há cargos definidos neste departamento.",
      fields: { purchasingAccess: "Acesso ao módulo de Compras", manager: "Responsável do departamento", noManager: "Sem responsável", managerHint: "Supervisiona todo o departamento: acesso total ao módulo, aprova os pedidos da equipa e decide que cargos dão acesso ao módulo.", grantsModuleAccess: "Dá acesso ao módulo", grantsModuleAccessHint: "Quem ocupa este cargo acede ao módulo do departamento (ex. RH ou Inventário). Deixe desativado para funcionários que só devem ver O meu espaço.",
        name: "Nome", description: "Descrição", permissionKey: "Acesso ao módulo",
        permissionKeyHint: "Opcional — defina apenas num departamento se os funcionários aí (e as suas contas criadas automaticamente) devem ter acesso ao módulo de RH ou de Produção. A maioria dos departamentos deve manter «Sem acesso especial».",
        category: "Função",
        noCategory: "Sem função específica",
        categoryHint: "Opcional — permite que o formulário de funcionário sugira cargos padrão para este departamento em vez de deixar texto livre. É apenas uma sugestão, sem relação com acessos, ao contrário do campo Acesso ao módulo acima.",
        noSpecialAccess: "Sem acesso especial", hrAccess: "Acesso ao módulo de RH", productionAccess: "Acesso ao módulo de Produção",
        positionTitle: "Nome do cargo", reportsTo: "Reporta a", noReportsTo: "Nenhum (cargo de topo)",
        salaryMin: "Faixa salarial — mín.", salaryMax: "Faixa salarial — máx.", salaryBand: "Faixa salarial",
        requiredSkills: "Competências necessárias", requiredSkillsPlaceholder: "Separadas por vírgulas, ex. Excel, Liderança",
      },
      errors: {
        nameRequired: "O nome do departamento é obrigatório", titleRequired: "O nome do cargo é obrigatório",
        saveFailed: "Ocorreu um erro ao guardar.", deleteFailed: "Ocorreu um erro ao eliminar.",
      },
    },

    payroll: {
      title: "Folha de pagamento",
      subtitle: "Gere ciclos de folha de pagamento mensais e faça a gestão dos recibos de vencimento.",
      generateRun: "Gerar folha de pagamento",
      createTitle: "Gerar ciclo de folha de pagamento",
      createSureMessage: "Gerar a folha de pagamento para este período? Será criado um recibo de vencimento para cada funcionário ativo com um salário registado.",
      createSuccessTitle: "Ciclo de folha de pagamento criado",
      createSuccessMessage: "O ciclo de folha de pagamento foi gerado com sucesso.",
      completeTitle: "Concluir ciclo de folha de pagamento",
      completeSureMessage: "Concluir este ciclo de folha de pagamento? Uma vez concluído, os recibos ficam bloqueados e os funcionários são notificados.",
      deleteTitle: "Eliminar ciclo de folha de pagamento",
      deleteSureMessage: "Eliminar este ciclo de folha de pagamento em rascunho e todos os seus recibos? Esta ação não pode ser desfeita.",
      emptyTitle: "Ainda não há ciclos de folha de pagamento",
      emptyMessage: "Gere o primeiro ciclo de folha de pagamento para esta empresa.",
      noPayslips: "Não há recibos de vencimento neste ciclo.",
      fields: { month: "Mês", year: "Ano", status: "Estado" },
      table: { period: "Período", employees: "Funcionários", gross: "Bruto", net: "Líquido", searchPlaceholder: "Pesquisar funcionários..." },
      status: { draft: "Rascunho", completed: "Concluído", voided: "Anulado" },
      payslipStatus: { draft: "Rascunho", validated: "Validado", paid: "Pago" },
      actions: { view: "Ver", complete: "Concluir", regenerate: "Regenerar", markPaid: "Marcar como pago", downloadPdf: "Transferir recibo" },
      exports: {
        cnss: "Exportação CNSS",
        cnssHint: "Folha de declaração — verifique com o formato Damancom atual antes de carregar",
        register: "Registo de folha de pagamento",
        bankTransfer: "Ficheiro de transferência bancária",
      },
      buttons: { generate: "Gerar", saving: "A guardar..." },
      breadcrumbs: { hr: "RH", payroll: "Folha de pagamento" },
      months: ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"],
      errors: { fetchFailed: "Falha ao carregar os ciclos de folha de pagamento", actionFailed: "Ocorreu um erro. Tente novamente." },
    },

    contracts: {
      title: "Contratos",
      subtitle: "Acompanhe os contratos de trabalho, renovações e datas de vencimento.",
      addContract: "Novo contrato",
      createTitle: "Novo contrato",
      createSureMessage: "Tem a certeza de que pretende criar este contrato?",
      createSuccessTitle: "Contrato criado",
      createSuccessMessage: "O contrato foi criado com sucesso.",
      renewTitle: "Renovar contrato",
      renewSureMessage: "Renovar este contrato? O contrato atual será encerrado e um novo será iniciado.",
      deleteTitle: "Eliminar contrato",
      deleteSureMessage: "Tem a certeza de que pretende eliminar este contrato? Esta ação não pode ser desfeita.",
      emptyTitle: "Ainda não há contratos",
      emptyMessage: "Esta empresa ainda não tem contratos registados.",
      expiringBanner: "{count} contrato(s) a vencer nos próximos 30 dias.",
      fields: { employee: "Funcionário", type: "Tipo de contrato", startDate: "Data de início", endDate: "Data de fim" },
      status: { active: "Ativo", expired: "Expirado", terminated: "Rescindido", renewed: "Renovado" },
      actions: { renew: "Renovar" },
      buttons: { create: "Guardar contrato" },
      breadcrumbs: { hr: "RH", contracts: "Contratos" },
      errors: { fetchFailed: "Falha ao carregar os contratos", actionFailed: "Ocorreu um erro. Tente novamente." },
    },

    documents: {
      title: "Documentos",
      subtitle: "Armazene os documentos dos funcionários e acompanhe as datas de validade.",
      uploadDocument: "Carregar documento",
      editDocument: "Editar documento",
      deleteTitle: "Eliminar documento",
      deleteSureMessage: "Tem a certeza de que pretende eliminar este documento? Esta ação não pode ser desfeita.",
      emptyTitle: "Ainda não há documentos",
      emptyMessage: "Esta empresa ainda não tem documentos registados.",
      expiringBanner: "{count} documento(s) a expirar nos próximos 30 dias.",
      fields: { employee: "Funcionário", type: "Tipo", label: "Etiqueta", labelPlaceholder: "ex. Cartão de cidadão", expiryDate: "Data de validade", file: "Ficheiro", replaceFile: "Substituir ficheiro (opcional)" },
      table: { file: "Ficheiro" },
      types: {
        cin: "Cartão de identidade (CIN)", passport: "Passaporte", work_permit: "Autorização de trabalho",
        residence_permit: "Autorização de residência", contract: "Contrato", diploma: "Diploma",
        cv: "CV", medical_certificate: "Atestado médico", other: "Outro",
      },
      actions: { view: "Ver", loadMore: "Carregar mais", loadMoreCount: "A mostrar {loaded} de {total}" },
      buttons: { upload: "Carregar" },
      breadcrumbs: { hr: "RH", documents: "Documentos" },
      errors: {
        fetchFailed: "Falha ao carregar os documentos", actionFailed: "Ocorreu um erro. Tente novamente.",
        missingFields: "Selecione um funcionário e um ficheiro.", uploadFailed: "Falha ao carregar o documento.",
      },
    },

    attendance: {
      title: "Assiduidade",
      subtitle: "Consulte os registos de entrada e saída.",
      emptyTitle: "Não há registos de assiduidade",
      emptyMessage: "Nenhum registo de assiduidade corresponde aos seus filtros.",
      filterAllEmployees: "Todos os funcionários",
      fields: { employee: "Funcionário", date: "Data", clockIn: "Entrada", clockOut: "Saída", notes: "Notas" },
      status: { present: "Presente", late: "Atrasado", absent: "Ausente", half_day: "Meio-dia", holiday: "Feriado" },
      breadcrumbs: { hr: "RH", attendance: "Assiduidade" },
      errors: { fetchFailed: "Falha ao carregar a assiduidade" },
    },

    reports: { chart: { zoomHint: "Arraste as alças sob o gráfico para ampliar", yearly: "Anual", monthly: "Mensal", view: "Vista", lastMonths: "Últimos {n} meses", range: "Período", },
      title: "Relatórios",
      subtitle: "Efetivos, rotatividade, absentismo e evolução do custo da folha de pagamento.",
      stats: { totalHeadcount: "Efetivo total", activeEmployees: "Funcionários ativos", currentGross: "Bruto mensal atual (est.)", currentNet: "Líquido mensal atual (est.)", missingSalaryNote: "{count} funcionário(s) ativo(s) ainda não têm salário registado — não incluído nesta estimativa." },
      expand: "Expandir",
      charts: {
        headcountByDepartment: "Efetivo por departamento", turnover: "Rotatividade (últimos 12 meses)",
        hires: "Contratações", terminations: "Saídas", absenteeism: "Taxa de absentismo (últimos 6 meses)",
        absenteeismRate: "Taxa de absentismo", payrollCost: "Custo da folha de pagamento (últimos 12 meses)",
        estimatedFootnote: "* O mês atual, assinalado com um asterisco, é uma estimativa em tempo real com base nos salários atuais — a folha de pagamento ainda não foi processada para este período.",
      },
      breadcrumbs: { hr: "RH", reports: "Relatórios" },
      loadError: "Não foi possível carregar alguns dados do relatório. Tente novamente ou consulte a consola para mais detalhes.",
      rankings: {
        title: "Classificação de funcionários",
        last30Days: "Últimos 30 dias",
        last90Days: "Últimos 90 dias",
        last365Days: "Últimos 12 meses",
        mostAbsenceDays: "Mais dias de ausência",
        bestAttendanceRate: "Melhor taxa de assiduidade",
        mostOvertimeHours: "Mais horas extra",
        mostLateDays: "Mais atrasos",
        noData: "Sem dados para este período.",
        days: "dias",
      },
    },  twoFactor: { qrAlt: "Código QR 2FA",
    title: "Autenticação de dois fatores",
    disabledHint: "Adicione uma camada extra de segurança à sua conta — além da palavra-passe, também vai precisar de um código de uma aplicação de autenticação para iniciar sessão.",
    enabledHint: "A autenticação de dois fatores está ativada na sua conta. Ser-lhe-á pedido um código da sua aplicação de autenticação sempre que iniciar sessão.",
    enableButton: "Ativar a autenticação de dois fatores",
    disableButton: "Desativar a autenticação de dois fatores",
    disabling: "A desativar...",
    scanTitle: "Digitalize o código QR",
    scanHint: "Digitalize-o com uma aplicação de autenticação (Google Authenticator, Authy, etc.) e depois introduza o código de 6 dígitos apresentado para confirmar.",
    manualEntryLabel: "Não consegue digitalizar? Introduza este código manualmente:",
    confirmAndEnable: "Confirmar e ativar",
    verifying: "A verificar...",
    backupCodesTitle: "Guarde os seus códigos de reserva",
    backupCodesHint: "Cada código pode ser usado uma vez para iniciar sessão caso perca o acesso à sua aplicação de autenticação. Guarde-os num local seguro — não serão mostrados novamente.",
    copyBackupCodes: "Copiar códigos",
    copied: "Copiado",
    iSavedThem: "Guardei estes códigos",
    confirmPasswordLabel: "Confirme a sua palavra-passe para continuar",
    errors: {
      statusFailed: "Não foi possível verificar o estado da autenticação de dois fatores.",
      setupFailed: "Não foi possível iniciar a configuração da autenticação de dois fatores.",
      invalidCode: "Esse código não corresponde — verifique a sua aplicação de autenticação e tente novamente.",
      disableFailed: "Não foi possível desativar a autenticação de dois fatores.",
    },
  },

  disciplinaryActions: {
    title: "Ações disciplinares",
    subtitle: "Registe avisos e medidas corretivas emitidas aos funcionários.",
    addAction: "Adicionar registo",
    editAction: "Editar registo",
    emptyTitle: "Ainda não há registos disciplinares",
    emptyMessage: "Esta empresa não tem ações disciplinares registadas.",
    deleteTitle: "Eliminar registo",
    deleteSureMessage: "Tem a certeza de que pretende eliminar este registo? Esta ação não pode ser desfeita.",
    acknowledged: "Confirmado",
    notAcknowledged: "Ainda não confirmado",
    breadcrumbs: {
      hr: "RH",
      disciplinaryActions: "Ações disciplinares",
    },
    fields: {
      employee: "Funcionário",
      type: "Tipo",
      date: "Data",
      reason: "Motivo",
      description: "Descrição",
      suspensionDays: "Suspensão (dias)",
      issuedBy: "Emitido por",
      notes: "Notas",
    },
    types: {
      verbal_warning: "Advertência verbal",
      written_warning: "Advertência escrita",
      final_warning: "Última advertência",
      suspension: "Suspensão",
      termination_notice: "Aviso de rescisão",
    },
    errors: {
      fetchFailed: "Falha ao carregar as ações disciplinares",
      saveFailed: "Erro ao guardar o registo",
      deleteFailed: "Erro ao eliminar o registo",
    },
  },
  performanceReviews: {
    title: "Avaliações de desempenho",
    subtitle: "Ciclos de avaliação, objetivos e classificações dos seus funcionários.",
    addReview: "Nova avaliação",
    editReview: "Editar avaliação",
    emptyTitle: "Ainda não há avaliações",
    emptyMessage: "Esta empresa não tem avaliações registadas.",
    deleteTitle: "Eliminar avaliação",
    deleteSureMessage: "Tem a certeza de que pretende eliminar esta avaliação? Esta ação não pode ser desfeita.",
    reviewedBy: "Avaliado por",
    submitButton: "Enviar ao funcionário",
    breadcrumbs: {
      hr: "RH",
      performanceReviews: "Avaliações",
    },
    fields: {
      employee: "Funcionário",
      reviewer: "Avaliador",
      periodLabel: "Período de avaliação",
      periodLabelPlaceholder: "ex. Avaliação anual 2026",
      reviewDate: "Data de avaliação",
      goals: "Objetivos (um por linha)",
      goalsPlaceholder: "Melhorar o tempo de resposta nos tickets de suporte\nConcluir a certificação de integração",
      strengths: "Pontos fortes",
      areasForImprovement: "Áreas de melhoria",
      comments: "Comentários",
    },
    criteria: {
      jobKnowledge: "Conhecimento da função",
      qualityOfWork: "Qualidade do trabalho",
      communication: "Comunicação",
      teamwork: "Trabalho em equipa",
      initiative: "Iniciativa",
      punctuality: "Pontualidade",
    },
    statuses: {
      draft: "Rascunho",
      submitted: "Enviada",
      acknowledged: "Confirmada",
    },
    errors: {
      fetchFailed: "Falha ao carregar as avaliações",
      saveFailed: "Erro ao guardar a avaliação",
      submitFailed: "Erro ao enviar a avaliação",
      deleteFailed: "Erro ao eliminar a avaliação",
    },
  },
  leaveCalendar: {
    title: "Calendário de ausências",
    subtitle: "Veja rapidamente quem está de licença aprovada.",
    previousMonth: "Mês anterior",
    nextMonth: "Mês seguinte",
    breadcrumbs: {
      hr: "RH",
      leaveCalendar: "Calendário de ausências",
    },
    weekdays: {
      0: "Seg",
      1: "Ter",
      2: "Qua",
      3: "Qui",
      4: "Sex",
      5: "Sáb",
      6: "Dom",
    },
    errors: {
      fetchFailed: "Falha ao carregar o calendário de ausências",
    },
  },
  },

  // ======================================================
  // GERMAN
  // ======================================================

  de: { login: { useBackupCode: "Stattdessen Backup-Code verwenden", useAuthenticator: "Stattdessen App-Code verwenden", invalidCode: "Ungültiger Code", verifying: "Wird geprüft...", verify: "Bestätigen", backupCodeHint: "Gib einen deiner Backup-Codes ein.", authenticatorHint: "Gib den 6-stelligen Code aus deiner Authenticator-App ein.", failed: "Anmeldung fehlgeschlagen", signingIn: "Anmeldung...", signIn: "Anmelden", password: "Passwort", email: "E-Mail", }, notifications: { daysShort: "T.", hoursShort: "Std.", minutesShort: "Min.", now: "jetzt", markAllRead: "Alle als gelesen markieren", empty: "Noch keine Benachrichtigungen.", title: "Benachrichtigungen", }, orgChart: { breadcrumbs: { orgChart: "Organigramm", hr: "HR", }, emptyMessage: "Lege bei Mitarbeitern Vorgesetzte fest, um die Struktur aufzubauen.", emptyTitle: "Noch kein Organigramm", subtitle: "Berichtsstruktur, aufgebaut aus den Vorgesetzten der Mitarbeiter.", title: "Organigramm", }, auditLog: { errors: { fetchFailed: "Prüfprotokoll konnte nicht geladen werden", actionFailed: "Diese Aktion ist fehlgeschlagen. Bitte erneut versuchen.", }, breadcrumbs: { auditLog: "Prüfprotokoll", hr: "HR", }, actions: { review: "Geprüft", delete: "Gelöscht", update: "Geändert", create: "Erstellt", }, resourceTypes: { WorkSchedule: "Arbeitszeitplan", PayrollRun: "Lohnlauf", EmployeeDocument: "Dokument", Contract: "Vertrag", Advance: "Vorschuss", Absence: "Abwesenheit", Salary: "Gehalt", Employee: "Mitarbeiter", }, fields: { date: "Datum", actor: "Von", resource: "Datensatz", resourceType: "Typ", action: "Aktion", }, emptyMessage: "Für diesen Filter wurden noch keine Änderungen protokolliert.", emptyTitle: "Noch keine Aktivität", deleteSureMessage: "Diesen Eintrag löschen? Dies kann nicht rückgängig gemacht werden.", deleteTitle: "Protokolleintrag löschen", subtitle: "Wer hat was wann geändert.", title: "Prüfprotokoll", }, purchaseRequests: { status: { received: "Erhalten", }, fields: { requestedBy: "Angefordert von", quantity: "Menge", product: "Artikel", }, markReceived: "Als erhalten markieren", emptyMessage: "Keine Anforderungen entsprechen den Filtern.", emptyTitle: "Keine Bestellanforderungen", subtitle: "An den Einkauf gesendete Nachbestellungen und deren Antwort.", title: "Bestellanforderungen", }, production: { title: "Produktion", }, holidays: { title: "Feiertage", subtitle: "Die Feiertage des Jahres: ob das Unternehmen arbeitet und wie gearbeitete Stunden bezahlt werden.", downloadTemplate: "Vorlage herunterladen", import: "Excel importieren", add: "Feiertag hinzufügen", year: "Jahr", howItWorks: "Jedes Jahr: Vorlage herunterladen (Feiertage mit festem Datum sind bereits eingetragen), die religiösen Feiertage mit ihren offiziellen Daten ergänzen und importieren. Geschlossener Feiertag: niemand wird erwartet, und Stunden von Mitarbeitenden, die sich einstempeln, zählen als Feiertagsstunden. Bezahlung „doppelt“ fügt pro gearbeiteter Stunde einen weiteren Stundenlohn hinzu; „normal“ fügt nichts hinzu.", importDone: "Import abgeschlossen: {created} hinzugefügt, {updated} aktualisiert.", namePlaceholder: "Name des Feiertags (z. B. Aïd al-Fitr)", previewTitle: "Vorschau von {file}", previewErrors: "{count} Zeile(n) zu korrigieren — Datei korrigieren und erneut importieren", previewReady: "{count} Zeile(n) bereit zum Import", columns: { row: "Zeile", date: "Datum", name: "Name", open: "Unternehmen", pay: "Bezahlung bei Arbeit", check: "Prüfung" }, defaultClosed: "Geschlossen (Standard)", defaultDouble: "Doppelt (Standard)", open: "Geöffnet", closed: "Geschlossen", payDouble: "Doppelt", payNormal: "Normal", confirmImport: "Importieren", emptyTitle: "Noch keine Feiertage für {year}", emptyMessage: "Vorlage herunterladen, ausfüllen und importieren.", deleteTitle: "Feiertag löschen", deleteMessage: "„{name}“ löschen? Bereits erfasste Zeiten für diesen Tag bleiben erhalten.", errors: { load: "Feiertage konnten nicht geladen werden.", save: "Diese Änderung konnte nicht gespeichert werden.", template: "Die Vorlage konnte nicht heruntergeladen werden.", read: "Diese Datei konnte nicht gelesen werden.", import: "Der Import ist fehlgeschlagen." } }, myDepartment: { adminTitle: "Abteilungszugriff", adminSubtitle: "Alle Abteilungen, die Sie verantworten: Leitung, welche Positionen Modulzugriff haben und wer Zugriff hat.", adminEmptyTitle: "Noch keine Abteilungen.", noManagerAssigned: "Keine Leitung zugewiesen", title: "Meine Abteilung", subtitle: "Ihr Team und welche Positionen Zugriff auf das Modul der Abteilung haben.", loadError: "Ihre Abteilung konnte nicht geladen werden.", saveError: "Diese Änderung konnte nicht gespeichert werden.", saved: "Gespeichert.", accountsUpdated: "Gespeichert — {count} Konto/Konten aktualisiert.", emptyTitle: "Sie leiten noch keine Abteilung.", positionsTitle: "Positionen & Zugriff", positionsHint: "Aktivieren Sie eine Position, um allen Inhabern Zugriff auf das Modul der Abteilung zu geben. Alle anderen sehen nur „Mein Bereich“.", noModule: "Diese Abteilung schaltet kein Modul frei – es gibt keinen Zugriff zu verteilen.", noPositions: "Für diese Abteilung sind noch keine Positionen angelegt.", holders: "{count} Mitarbeiter", toggleLabel: "Gewährt Modulzugriff", teamTitle: "Team", noEmployees: "Keine Mitarbeiter in dieser Abteilung.", columns: { name: "Name", jobTitle: "Position", access: "Zugriff" }, noLogin: "Kein Konto", moduleAccess: "Modulzugriff", mySpaceOnly: "Nur Mein Bereich" },
    sidebar: { platform: "Plattform", clients: "Kunden", purchasingReports: "Einkaufsberichte", restock: "Nachbestellung", inventorySettings: "Einstellungen", purchaseRequests: "Bestellanforderungen", inventory: "Inventar", production: "Produktion", workSchedule: "Arbeitszeitplan", auditLog: "Prüfprotokoll", reports: "Berichte", orgChart: "Organigramm", attendance: "Anwesenheit", employeeDocuments: "Dokumente", contracts: "Verträge", payroll: "Lohnabrechnung", supplierInvoices: "Lieferantenrechnungen", purchasing: "Einkauf", purchaseRequestsQueue: "Bestellanforderungen", purchaseOrders: "Bestellungen", priceRequests: "Preisanfragen", suppliers: "Lieferanten", purchasingInventory: "Inventar", articleHistory: "Artikelhistorie", holidays: "Feiertage", departmentAccess: "Abteilungszugriff", myDepartment: "Meine Abteilung", mySpace: "Mein Bereich", myProfile: "Mein Profil", myPayslips: "Meine Gehaltsabrechnungen", myAbsences: "Meine Abwesenheiten", myAdvances: "Meine Vorschüsse", myAttendance: "Meine Anwesenheit", myRecords: "Meine Akte",
      leaveCalendar: "Abwesenheitskalender",
      performanceReviews: "Leistungsbeurteilungen",
      disciplinaryActions: "Disziplinarmaßnahmen",
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

    common: { home: "Startseite", breadcrumb: "Brotkrümelnavigation", clear: "Leeren", clearSearch: "Suche löschen", nextPage: "Nächste Seite", previousPage: "Vorherige Seite", pagination: "Seitennavigation", hidePassword: "Passwort verbergen", showPassword: "Passwort anzeigen", somethingWentWrong: "Etwas ist schiefgelaufen", confirmAction: "Aktion bestätigen", pageNotFoundHint: "Diese Seite existiert nicht oder wurde verschoben.", pageNotFound: "Seite nicht gefunden", status: "Status", save: "Speichern", back: "Zurück", dateFrom: "Von", dateTo: "Bis",
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
      chooseFile: "Datei auswählen",
      noFileChosen: "Keine Datei ausgewählt",
    },

    profile: { loadFailed: "Profil konnte nicht geladen werden",
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

    company: { workflow: { accountInvalid: "Ein Buchhaltungskonto hat 4 bis 10 Ziffern.", purchaseAccountHint: "Wird im Buchhaltungsexport für Artikel ohne eigenes Kategoriekonto und für frei eingegebene Positionen verwendet (z. B. 6111, 6121, 6125).", purchaseAccount: "Standard-Einkaufskonto", purchaseThresholdHint: "Bestellungen ab diesem Betrag (inkl. MwSt.) müssen von einem Admin, dem Inhaber oder der Einkaufsleitung freigegeben werden. 0 = keine Freigabe.", purchaseThreshold: "Freigabegrenze für Bestellungen", title: "Genehmigungsablauf", sequentialApproval: "Genehmigung durch Vorgesetzte vor HR", sequentialApprovalHint: "Wenn aktiviert, müssen Abwesenheits- und Vorschussanträge zuerst vom Vorgesetzten genehmigt werden und erhalten danach die endgültige Freigabe durch HR. Mitarbeiter ohne Vorgesetzten gehen direkt an HR.", saveFailed: "Diese Einstellung konnte nicht gespeichert werden." },
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

      downloadFiche:
        "Datenblatt herunterladen",

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

        ficheDownloadFailed:
          "Fehler beim Erstellen des Unternehmensdatenblatts.",

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
      inheritedFromEmployee: "Abteilung und HR-Rolle werden vom verknüpften Mitarbeiter {name} ({department} — {jobTitle}) übernommen. Ändern Sie stattdessen die Abteilung oder Stellenbezeichnung des Mitarbeiters.",

      updateTitle: "Benutzer bearbeiten",
      updateSureMessage: "Möchten Sie diese Änderungen wirklich speichern?",

      updateSuccessTitle: "Benutzer aktualisiert",
      updateSuccessMessage: "Der Benutzer wurde erfolgreich aktualisiert.",

      updateFailTitle: "Aktualisierung fehlgeschlagen",
      updateFailMessage: "Der Benutzer konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",

      hrRole: {
        label: "HR-Position",
        notApplicable: "Nicht zutreffend (kein HR)",
        assistant: "HR-Assistent(in)",
        officer: "HR-Sachbearbeiter(in)",
        manager: "HR-Verantwortliche(r)",
        director: "HR-Direktor(in)",
      },

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
    employees: { related: { tabs: { attendance: "Anwesenheit", documents: "Dokumente", contracts: "Verträge", advances: "Vorschüsse", absences: "Abwesenheiten", salary: "Gehalt", }, empty: "Noch nichts vorhanden.", }, linkedUser: { resetPasswordSureMessage: "Neues temporäres Passwort erzeugen? Das aktuelle Passwort funktioniert dann nicht mehr.", resetPasswordTitle: "Passwort zurücksetzen", resetPassword: "Passwort zurücksetzen", loginNotCreatedTitle: "Mitarbeiter angelegt, aber noch ohne Zugang", loginCreatedMessage: "E-Mail: {email}\nTemporäres Passwort: {password}\n\nGib es dem Mitarbeiter — es wird nicht erneut angezeigt.", loginCreatedTitle: "Zugang angelegt", createLoginSureMessage: "Neuen Self-Service-Zugang anlegen? Ein temporäres Passwort wird erzeugt und nur einmal angezeigt.", createLoginTitle: "Zugang anlegen", createLogin: "Neuen Zugang anlegen", orCreateNew: "oder", actionFailed: "Etwas ist schiefgelaufen. Bitte erneut versuchen.", searchPlaceholder: "Benutzer nach Name oder E-Mail suchen...", unlinkSureMessage: "Verknüpfung lösen? Der Mitarbeiter verliert den Zugriff auf „Mein Bereich“.", unlinkTitle: "Verknüpfung des Benutzerkontos lösen", linkSureMessage: "Dieses Benutzerkonto mit dem Mitarbeiter verknüpfen? Er erhält Zugriff auf „Mein Bereich“ (Abrechnungen, Abwesenheits- und Vorschussanträge, Anwesenheit).", linkTitle: "Benutzerkonto verknüpfen", unlink: "Verknüpfung lösen", link: "Verknüpfen", linkedTo: "Verknüpft mit:", title: "Self-Service-Zugang", },
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

      documents: {
        menuButton: "Dokumente",
        attestationTravail: "Arbeitsbescheinigung",
        attestationSalaire: "Arbeits- und Gehaltsbescheinigung",
        certificatTravail: "Arbeitszeugnis",
        contratTravail: "Arbeitsvertrag",
        soldeToutCompte: "Restschuldbescheinigung (Endabrechnung)",
        generationFailed: "Fehler beim Erstellen des Dokuments.",
      },

      bulkImport: {
        exportButton: "Exportieren (CSV)",
        exportFailed: "Mitarbeiter konnten nicht exportiert werden.",
        openButton: "Importieren (CSV)",
        title: "Mitarbeiter im Massenimport anlegen",
        helpText: "Laden Sie eine CSV-Datei hoch, um mehrere Mitarbeiter gleichzeitig anzulegen. Jede Zeile wird zuerst geprüft — es wird erst nach Ihrer Bestätigung etwas erstellt.",
        downloadTemplate: "CSV-Vorlage herunterladen",
        preview: "Datei prüfen",
        previewing: "Wird geprüft...",
        previewFailed: "Diese Datei konnte nicht gelesen werden.",
        summaryValid: "{count} importbereit",
        summaryErrors: "{count} mit Fehlern",
        summaryWarnings: "{count} mit Warnungen",
        rowOk: "Sieht gut aus",
        fixErrorsFirst: "Beheben Sie die fehlerhaften Zeilen und laden Sie die Datei erneut hoch, bevor Sie importieren — Zeilen mit nur Warnungen werden trotzdem importiert.",
        importButton: "{count} Mitarbeiter importieren",
        committing: "Wird importiert...",
        commitFailed: "Der Import konnte nicht abgeschlossen werden.",
        commitSuccess: "{count} Mitarbeiter erfolgreich importiert.",
      },

      fields: { createLoginCheckboxLabel: "Auch einen Self-Service-Zugang für diesen Mitarbeiter anlegen (mit seiner Arbeits-E-Mail)", createLogin: "Self-Service-Zugang", noDepartments: "Noch keine Abteilungen — lege eine unter Organisation > Abteilungen an", manager: "Vorgesetzte(r)", noManagerCandidates: "Noch keine weiteren Mitarbeiter in diesem Unternehmen",
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

      history: { deleteRecord: "Diesen Gehaltseintrag löschen",
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
        reviewComment: "Prüfkommentar",
        status: "Status",
      },

      types: {
        paid_leave: "Bezahlter Urlaub",
        unpaid_leave: "Unbezahlter Urlaub",
        sick_leave: "Krankheitsurlaub",
        absence: "Abwesenheit",
        other: "Sonstiges",
      },

      status: { manager_approved: "Vom Vorgesetzten genehmigt",
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
        reviewComment: "Prüfkommentar",
        status: "Status",
      },

      status: { manager_approved: "Vom Vorgesetzten genehmigt",
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

    units: {
      unit: "Einheit",
      piece: "Stück",
      pair: "Paar",
      dozen: "Dutzend",
      set: "Set",
      kg: "Kilogramm (kg)",
      g: "Gramm (g)",
      t: "Tonne (t)",
      lb: "Pfund (lb)",
      oz: "Unze (oz)",
      quintal: "Zentner (q)",
      l: "Liter (L)",
      ml: "Milliliter (mL)",
      m3: "Kubikmeter (m³)",
      gal: "Gallone (gal)",
      m: "Meter (m)",
      cm: "Zentimeter (cm)",
      mm: "Millimeter (mm)",
      km: "Kilometer (km)",
      ft: "Fuß (ft)",
      in: "Zoll (in)",
      yd: "Yard (yd)",
      m2: "Quadratmeter (m²)",
      ft2: "Quadratfuß (ft²)",
      ha: "Hektar (ha)",
      box: "Box",
      carton: "Karton",
      pallet: "Palette",
      bag: "Sack (Beutel)",
      sack: "Sack",
      bottle: "Flasche",
      can: "Dose",
      roll: "Rolle",
      sheet: "Blatt",
      bundle: "Bündel",
      case: "Kiste",
      drum: "Fass",
      barrel: "Ölfass",
      container: "Container",
      hour: "Stunde",
      day: "Tag",
      month: "Monat",
    },

    contentTranslation: {
      title: "Übersetzungen",
      editButton: "Übersetzungen",
      original: "Original",
      auto: "Automatisch übersetzt",
      manual: "Manuell bearbeitet",
      missing: "Noch nicht übersetzt",
      regenerate: "Neu generieren",
      originalHint: "Dies ist der Originaltext — bearbeiten Sie das Feld selbst, um ihn zu ändern.",
      save: "Speichern",
      saving: "Wird gespeichert…",
      close: "Schließen",
      placeholder: "Übersetzung eingeben…",
      errors: {
        loadFailed: "Übersetzungen konnten nicht geladen werden.",
        saveFailed: "Übersetzung konnte nicht gespeichert werden.",
        regenerateFailed: "Übersetzung konnte nicht neu generiert werden.",
      },
    },

    departments: { noManagerBadge: "Keine Leitung", managerLabel: "Leitung", moduleAccessBadge: "Modulzugriff",
      title: "Abteilungen",
      subtitle: "Definieren Sie die Abteilungen Ihres Unternehmens und die Stellen innerhalb jeder Abteilung.",
      addDepartment: "Abteilung hinzufügen",
      addDefaults: "Standardabteilungen hinzufügen",
      defaultsModal: {
        title: "Standardabteilungen hinzufügen",
        helpText: "Wählen Sie die Abteilungen aus, die Sie hinzufügen möchten — jede erhält einen Standardnamen, eine Beschreibung und (für HR/Produktion) bereits festgelegten Modulzugriff. Sie können sie später weiterhin bearbeiten oder weitere hinzufügen.",
        adding: "Wird hinzugefügt...",
        addButton: "{count} Abteilung(en) hinzufügen",
      },
      editDepartment: "Abteilung bearbeiten",
      addPosition: "Stelle hinzufügen",
      editPosition: "Stelle bearbeiten",
      deleteTitle: "Abteilung löschen",
      deleteSureMessage: "Möchten Sie diese Abteilung wirklich löschen? Mitarbeiter und Stellen, die sie noch nutzen, müssen zuerst neu zugewiesen werden.",
      deletePositionTitle: "Stelle löschen",
      deletePositionSureMessage: "Möchten Sie diese Stelle wirklich löschen? Mitarbeiter, die sie noch innehaben, oder andere ihr unterstellte Stellen, müssen zuerst neu zugewiesen werden.",
      emptyTitle: "Noch keine Abteilungen",
      emptyMessage: "Fügen Sie Ihre erste Abteilung hinzu, um Ihre Organisationsstruktur aufzubauen.",
      searchPlaceholder: "Abteilungen durchsuchen...",
      noSearchResults: "Keine Abteilung entspricht Ihrer Suche.",
      noPositions: "In dieser Abteilung sind noch keine Stellen definiert.",
      fields: { purchasingAccess: "Zugriff auf das Einkaufsmodul", manager: "Abteilungsleitung", noManager: "Keine Leitung", managerHint: "Verantwortet die ganze Abteilung: voller Modulzugriff, genehmigt die Anträge des Teams und legt fest, welche Positionen Modulzugriff erhalten.", grantsModuleAccess: "Gewährt Modulzugriff", grantsModuleAccessHint: "Inhaber dieser Position erhalten das Modul der Abteilung (z. B. HR oder Inventar). Deaktiviert lassen für Mitarbeiter, die nur „Mein Bereich“ sehen sollen.",
        name: "Name", description: "Beschreibung", permissionKey: "Modulzugriff",
        permissionKeyHint: "Optional — nur bei EINER Abteilung festlegen, wenn Mitarbeiter dort (und ihre automatisch erstellten Konten) Zugriff auf das HR- oder Produktionsmodul erhalten sollen. Die meisten Abteilungen sollten bei „Kein spezieller Zugriff“ bleiben.",
        category: "Funktion",
        noCategory: "Keine bestimmte Funktion",
        categoryHint: "Optional — lässt das Mitarbeiterformular Standard-Stellenbezeichnungen für diese Abteilung vorschlagen, statt Freitext zu belassen. Nur ein Vorschlag, ohne Bezug zu Zugriffsrechten, im Gegensatz zum Feld Modulzugriff oben.",
        noSpecialAccess: "Kein spezieller Zugriff", hrAccess: "Zugriff auf HR-Modul", productionAccess: "Zugriff auf Produktionsmodul",
        positionTitle: "Stellenbezeichnung", reportsTo: "Berichtet an", noReportsTo: "Keine (oberste Stelle)",
        salaryMin: "Gehaltsspanne — Min.", salaryMax: "Gehaltsspanne — Max.", salaryBand: "Gehaltsspanne",
        requiredSkills: "Erforderliche Fähigkeiten", requiredSkillsPlaceholder: "Durch Kommas getrennt, z. B. Excel, Führung",
      },
      errors: {
        nameRequired: "Der Abteilungsname ist erforderlich", titleRequired: "Die Stellenbezeichnung ist erforderlich",
        saveFailed: "Beim Speichern ist ein Fehler aufgetreten.", deleteFailed: "Beim Löschen ist ein Fehler aufgetreten.",
      },
    },

    payroll: {
      title: "Gehaltsabrechnung",
      subtitle: "Erstellen Sie monatliche Abrechnungsläufe und verwalten Sie Gehaltsabrechnungen.",
      generateRun: "Abrechnung erstellen",
      createTitle: "Abrechnungslauf erstellen",
      createSureMessage: "Abrechnung für diesen Zeitraum erstellen? Für jeden aktiven Mitarbeiter mit hinterlegtem Gehalt wird eine Gehaltsabrechnung erstellt.",
      createSuccessTitle: "Abrechnungslauf erstellt",
      createSuccessMessage: "Der Abrechnungslauf wurde erfolgreich erstellt.",
      completeTitle: "Abrechnungslauf abschließen",
      completeSureMessage: "Diesen Abrechnungslauf abschließen? Nach dem Abschluss werden die Gehaltsabrechnungen gesperrt und die Mitarbeiter benachrichtigt.",
      deleteTitle: "Abrechnungslauf löschen",
      deleteSureMessage: "Diesen Entwurf des Abrechnungslaufs und alle zugehörigen Gehaltsabrechnungen löschen? Dies kann nicht rückgängig gemacht werden.",
      emptyTitle: "Noch keine Abrechnungsläufe",
      emptyMessage: "Erstellen Sie den ersten Abrechnungslauf für dieses Unternehmen.",
      noPayslips: "Keine Gehaltsabrechnungen in diesem Lauf.",
      fields: { month: "Monat", year: "Jahr", status: "Status" },
      table: { period: "Zeitraum", employees: "Mitarbeiter", gross: "Brutto", net: "Netto", searchPlaceholder: "Mitarbeiter suchen..." },
      status: { draft: "Entwurf", completed: "Abgeschlossen", voided: "Storniert" },
      payslipStatus: { draft: "Entwurf", validated: "Bestätigt", paid: "Bezahlt" },
      actions: { view: "Ansehen", complete: "Abschließen", regenerate: "Neu erstellen", markPaid: "Als bezahlt markieren", downloadPdf: "Abrechnung herunterladen" },
      exports: {
        cnss: "CNSS-Export",
        cnssHint: "Meldeformular — vor dem Hochladen mit dem aktuellen Damancom-Format abgleichen",
        register: "Lohnjournal",
        bankTransfer: "Überweisungsdatei",
      },
      buttons: { generate: "Erstellen", saving: "Wird gespeichert..." },
      breadcrumbs: { hr: "Personalwesen", payroll: "Gehaltsabrechnung" },
      months: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
      errors: { fetchFailed: "Abrechnungsläufe konnten nicht geladen werden", actionFailed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut." },
    },

    contracts: {
      title: "Verträge",
      subtitle: "Behalten Sie Arbeitsverträge, Verlängerungen und Ablaufdaten im Blick.",
      addContract: "Neuer Vertrag",
      createTitle: "Neuer Vertrag",
      createSureMessage: "Möchten Sie diesen Vertrag wirklich erstellen?",
      createSuccessTitle: "Vertrag erstellt",
      createSuccessMessage: "Der Vertrag wurde erfolgreich erstellt.",
      renewTitle: "Vertrag verlängern",
      renewSureMessage: "Diesen Vertrag verlängern? Der aktuelle Vertrag wird geschlossen und ein neuer beginnt.",
      deleteTitle: "Vertrag löschen",
      deleteSureMessage: "Möchten Sie diesen Vertrag wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
      emptyTitle: "Noch keine Verträge",
      emptyMessage: "Für dieses Unternehmen sind noch keine Verträge hinterlegt.",
      expiringBanner: "{count} Vertrag/Verträge laufen innerhalb von 30 Tagen ab.",
      fields: { employee: "Mitarbeiter", type: "Vertragsart", startDate: "Startdatum", endDate: "Enddatum" },
      status: { active: "Aktiv", expired: "Abgelaufen", terminated: "Gekündigt", renewed: "Verlängert" },
      actions: { renew: "Verlängern" },
      buttons: { create: "Vertrag speichern" },
      breadcrumbs: { hr: "Personalwesen", contracts: "Verträge" },
      errors: { fetchFailed: "Verträge konnten nicht geladen werden", actionFailed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut." },
    },

    documents: {
      title: "Dokumente",
      subtitle: "Speichern Sie Mitarbeiterdokumente und behalten Sie Ablaufdaten im Blick.",
      uploadDocument: "Dokument hochladen",
      editDocument: "Dokument bearbeiten",
      deleteTitle: "Dokument löschen",
      deleteSureMessage: "Möchten Sie dieses Dokument wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
      emptyTitle: "Noch keine Dokumente",
      emptyMessage: "Für dieses Unternehmen sind noch keine Dokumente hinterlegt.",
      expiringBanner: "{count} Dokument(e) laufen innerhalb von 30 Tagen ab.",
      fields: { employee: "Mitarbeiter", type: "Typ", label: "Bezeichnung", labelPlaceholder: "z. B. Personalausweis", expiryDate: "Ablaufdatum", file: "Datei", replaceFile: "Datei ersetzen (optional)" },
      table: { file: "Datei" },
      types: {
        cin: "Personalausweis (CIN)", passport: "Reisepass", work_permit: "Arbeitserlaubnis",
        residence_permit: "Aufenthaltserlaubnis", contract: "Vertrag", diploma: "Diplom",
        cv: "Lebenslauf", medical_certificate: "Ärztliches Attest", other: "Sonstiges",
      },
      actions: { view: "Ansehen", loadMore: "Mehr laden", loadMoreCount: "{loaded} von {total} angezeigt" },
      buttons: { upload: "Hochladen" },
      breadcrumbs: { hr: "Personalwesen", documents: "Dokumente" },
      errors: {
        fetchFailed: "Dokumente konnten nicht geladen werden", actionFailed: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
        missingFields: "Bitte wählen Sie einen Mitarbeiter und eine Datei aus.", uploadFailed: "Hochladen des Dokuments fehlgeschlagen.",
      },
    },

    attendance: {
      title: "Anwesenheit",
      subtitle: "Kommen- und Gehen-Zeiten einsehen.",
      emptyTitle: "Keine Anwesenheitsdaten",
      emptyMessage: "Keine Anwesenheitsdaten entsprechen Ihren Filtern.",
      filterAllEmployees: "Alle Mitarbeiter",
      fields: { employee: "Mitarbeiter", date: "Datum", clockIn: "Kommen", clockOut: "Gehen", notes: "Notizen" },
      status: { present: "Anwesend", late: "Verspätet", absent: "Abwesend", half_day: "Halber Tag", holiday: "Feiertag" },
      breadcrumbs: { hr: "Personalwesen", attendance: "Anwesenheit" },
      errors: { fetchFailed: "Anwesenheitsdaten konnten nicht geladen werden" },
    },

    reports: { chart: { zoomHint: "Ziehe die Regler unter dem Diagramm zum Zoomen", yearly: "Jährlich", monthly: "Monatlich", view: "Ansicht", lastMonths: "Letzte {n} Monate", range: "Zeitraum", },
      title: "Berichte",
      subtitle: "Mitarbeiterzahl, Fluktuation, Abwesenheit und Entwicklung der Lohnkosten.",
      stats: { totalHeadcount: "Gesamtbelegschaft", activeEmployees: "Aktive Mitarbeiter", currentGross: "Aktuelles monatliches Brutto (geschätzt)", currentNet: "Aktuelles monatliches Netto (geschätzt)", missingSalaryNote: "{count} aktive(r) Mitarbeiter haben noch kein hinterlegtes Gehalt — in dieser Schätzung nicht enthalten." },
      expand: "Erweitern",
      charts: {
        headcountByDepartment: "Mitarbeiterzahl nach Abteilung", turnover: "Fluktuation (letzte 12 Monate)",
        hires: "Neueinstellungen", terminations: "Austritte", absenteeism: "Abwesenheitsquote (letzte 6 Monate)",
        absenteeismRate: "Abwesenheitsquote", payrollCost: "Lohnkosten (letzte 12 Monate)",
        estimatedFootnote: "* Der aktuelle Monat, mit einem Sternchen markiert, ist eine Live-Schätzung auf Basis der aktuellen Gehälter — die Abrechnung wurde dafür noch nicht durchgeführt.",
      },
      breadcrumbs: { hr: "Personalwesen", reports: "Berichte" },
      loadError: "Einige Berichtsdaten konnten nicht geladen werden. Bitte versuchen Sie es erneut oder prüfen Sie die Konsole für Details.",
      rankings: {
        title: "Mitarbeiter-Rangliste",
        last30Days: "Letzte 30 Tage",
        last90Days: "Letzte 90 Tage",
        last365Days: "Letzte 12 Monate",
        mostAbsenceDays: "Die meisten Abwesenheitstage",
        bestAttendanceRate: "Beste Anwesenheitsquote",
        mostOvertimeHours: "Die meisten Überstunden",
        mostLateDays: "Die meisten Verspätungen",
        noData: "Keine Daten für diesen Zeitraum.",
        days: "Tage",
      },
    },  twoFactor: { qrAlt: "2FA-QR-Code",
    title: "Zwei-Faktor-Authentifizierung",
    disabledHint: "Fügen Sie Ihrem Konto eine zusätzliche Sicherheitsebene hinzu — nach Ihrem Passwort benötigen Sie zum Anmelden auch einen Code aus einer Authentifizierungs-App.",
    enabledHint: "Die Zwei-Faktor-Authentifizierung ist für Ihr Konto aktiviert. Sie werden bei jeder Anmeldung nach einem Code aus Ihrer Authentifizierungs-App gefragt.",
    enableButton: "Zwei-Faktor-Authentifizierung aktivieren",
    disableButton: "Zwei-Faktor-Authentifizierung deaktivieren",
    disabling: "Wird deaktiviert...",
    scanTitle: "QR-Code scannen",
    scanHint: "Scannen Sie diesen mit einer Authentifizierungs-App (Google Authenticator, Authy usw.) und geben Sie dann den angezeigten 6-stelligen Code zur Bestätigung ein.",
    manualEntryLabel: "Können Sie nicht scannen? Geben Sie diesen Code manuell ein:",
    confirmAndEnable: "Bestätigen und aktivieren",
    verifying: "Wird überprüft...",
    backupCodesTitle: "Speichern Sie Ihre Backup-Codes",
    backupCodesHint: "Jeder Code kann einmal zur Anmeldung verwendet werden, falls Sie den Zugriff auf Ihre Authentifizierungs-App verlieren. Bewahren Sie sie an einem sicheren Ort auf — sie werden nicht erneut angezeigt.",
    copyBackupCodes: "Codes kopieren",
    copied: "Kopiert",
    iSavedThem: "Ich habe diese Codes gespeichert",
    confirmPasswordLabel: "Bestätigen Sie Ihr Passwort, um fortzufahren",
    errors: {
      statusFailed: "Der Status der Zwei-Faktor-Authentifizierung konnte nicht geprüft werden.",
      setupFailed: "Die Einrichtung der Zwei-Faktor-Authentifizierung konnte nicht gestartet werden.",
      invalidCode: "Dieser Code stimmt nicht überein — prüfen Sie Ihre Authentifizierungs-App und versuchen Sie es erneut.",
      disableFailed: "Die Zwei-Faktor-Authentifizierung konnte nicht deaktiviert werden.",
    },
  },

  disciplinaryActions: {
    title: "Disziplinarmaßnahmen",
    subtitle: "Verwarnungen und Korrekturmaßnahmen gegenüber Mitarbeitern nachverfolgen.",
    addAction: "Eintrag hinzufügen",
    editAction: "Eintrag bearbeiten",
    emptyTitle: "Noch keine Disziplinareinträge",
    emptyMessage: "Für dieses Unternehmen sind keine Disziplinarmaßnahmen hinterlegt.",
    deleteTitle: "Eintrag löschen",
    deleteSureMessage: "Möchten Sie diesen Eintrag wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
    acknowledged: "Bestätigt",
    notAcknowledged: "Noch nicht bestätigt",
    breadcrumbs: {
      hr: "Personalwesen",
      disciplinaryActions: "Disziplinarmaßnahmen",
    },
    fields: {
      employee: "Mitarbeiter",
      type: "Art",
      date: "Datum",
      reason: "Grund",
      description: "Beschreibung",
      suspensionDays: "Suspendierung (Tage)",
      issuedBy: "Ausgestellt von",
      notes: "Notizen",
    },
    types: {
      verbal_warning: "Mündliche Verwarnung",
      written_warning: "Schriftliche Verwarnung",
      final_warning: "Letzte Verwarnung",
      suspension: "Suspendierung",
      termination_notice: "Kündigungsschreiben",
    },
    errors: {
      fetchFailed: "Disziplinarmaßnahmen konnten nicht geladen werden",
      saveFailed: "Fehler beim Speichern des Eintrags",
      deleteFailed: "Fehler beim Löschen des Eintrags",
    },
  },
  performanceReviews: {
    title: "Leistungsbeurteilungen",
    subtitle: "Beurteilungszyklen, Ziele und Bewertungen für Ihre Mitarbeiter.",
    addReview: "Neue Beurteilung",
    editReview: "Beurteilung bearbeiten",
    emptyTitle: "Noch keine Leistungsbeurteilungen",
    emptyMessage: "Für dieses Unternehmen sind keine Beurteilungen hinterlegt.",
    deleteTitle: "Beurteilung löschen",
    deleteSureMessage: "Möchten Sie diese Beurteilung wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
    reviewedBy: "Beurteilt von",
    submitButton: "An Mitarbeiter senden",
    breadcrumbs: {
      hr: "Personalwesen",
      performanceReviews: "Beurteilungen",
    },
    fields: {
      employee: "Mitarbeiter",
      reviewer: "Beurteiler",
      periodLabel: "Beurteilungszeitraum",
      periodLabelPlaceholder: "z. B. Jahresbeurteilung 2026",
      reviewDate: "Beurteilungsdatum",
      goals: "Ziele (eines pro Zeile)",
      goalsPlaceholder: "Reaktionszeit bei Support-Tickets verbessern\nOnboarding-Zertifizierung abschließen",
      strengths: "Stärken",
      areasForImprovement: "Verbesserungsbereiche",
      comments: "Kommentare",
    },
    criteria: {
      jobKnowledge: "Fachwissen",
      qualityOfWork: "Arbeitsqualität",
      communication: "Kommunikation",
      teamwork: "Teamarbeit",
      initiative: "Eigeninitiative",
      punctuality: "Pünktlichkeit",
    },
    statuses: {
      draft: "Entwurf",
      submitted: "Gesendet",
      acknowledged: "Bestätigt",
    },
    errors: {
      fetchFailed: "Beurteilungen konnten nicht geladen werden",
      saveFailed: "Fehler beim Speichern der Beurteilung",
      submitFailed: "Fehler beim Senden der Beurteilung",
      deleteFailed: "Fehler beim Löschen der Beurteilung",
    },
  },
  leaveCalendar: {
    title: "Abwesenheitskalender",
    subtitle: "Sehen Sie auf einen Blick, wer genehmigten Urlaub hat.",
    previousMonth: "Vorheriger Monat",
    nextMonth: "Nächster Monat",
    breadcrumbs: {
      hr: "Personalwesen",
      leaveCalendar: "Abwesenheitskalender",
    },
    weekdays: {
      0: "Mo",
      1: "Di",
      2: "Mi",
      3: "Do",
      4: "Fr",
      5: "Sa",
      6: "So",
    },
    errors: {
      fetchFailed: "Abwesenheitskalender konnte nicht geladen werden",
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
