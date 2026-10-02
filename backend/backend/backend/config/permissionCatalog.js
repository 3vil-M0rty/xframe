/**
 * ============================================================
 * PERMISSION CATALOGUE — every action a login can be allowed to do
 * ============================================================
 * Keys are "module.resource.action" (e.g. "sales.quotes.create").
 * Admins and owners have them all. Everyone else gets:
 *   - their department's default profile (while nobody customised
 *     them — see services/permissionService.js → legacyDefaults), or
 *   - exactly the permissions their manager ticked for them
 *     (User.permissionsMode = "custom", User.permissions), plus
 *   - every permission of the modules of the departments they manage.
 *
 * A manager can only hand out permissions they have themselves, to
 * the people under them (their departments + everyone reporting to
 * them). "team.permissions.manage" lets a sub-manager do the same for
 * their own team.
 *
 * Labels are French / English; the UI falls back to them for the
 * other languages.
 * ============================================================
 */

const A = {
  view: { fr: "Voir", en: "View" },
  create: { fr: "Créer", en: "Create" },
  edit: { fr: "Modifier", en: "Edit" },
  delete: { fr: "Supprimer", en: "Delete" },
  export: { fr: "Exporter", en: "Export" },
  approve: { fr: "Approuver / refuser", en: "Approve / reject" },
  print: { fr: "Imprimer / PDF", en: "Print / PDF" },
};
const crud = () => ({ view: A.view, create: A.create, edit: A.edit, delete: A.delete });

const MODULES = [
  {
    key: "hr",
    label: { fr: "Ressources humaines", en: "Human resources" },
    department: "hr",
    resources: [
      { key: "employees", label: { fr: "Employés", en: "Employees" }, actions: { ...crud(), export: A.export, import: { fr: "Import en masse", en: "Bulk import" }, print: { fr: "Attestations / fiches PDF", en: "Certificates / PDF" } } },
      { key: "accounts", label: { fr: "Comptes de connexion des employés", en: "Employee logins" }, actions: { manage: { fr: "Créer / désactiver / réinitialiser", en: "Create / disable / reset" } } },
      { key: "contracts", label: { fr: "Contrats", en: "Contracts" }, actions: { ...crud(), renew: { fr: "Renouveler", en: "Renew" } } },
      { key: "documents", label: { fr: "Documents du personnel", en: "Staff documents" }, actions: crud() },
      { key: "salaries", label: { fr: "Salaires", en: "Salaries" }, actions: crud() },
      { key: "payroll", label: { fr: "Paie", en: "Payroll" }, actions: { view: A.view, run: { fr: "Calculer / recalculer", en: "Run / regenerate" }, validate: { fr: "Clôturer", en: "Close" }, delete: A.delete, export: A.export, markPaid: { fr: "Marquer payé", en: "Mark paid" } } },
      { key: "declarations", label: { fr: "Déclarations (CNSS, IR, virements)", en: "Declarations (CNSS, tax, transfers)" }, actions: { view: A.view, export: { fr: "Générer les fichiers", en: "Generate files" } } },
      { key: "absences", label: { fr: "Absences & congés", en: "Absences & leave" }, actions: { ...crud(), approve: A.approve } },
      { key: "advances", label: { fr: "Avances sur salaire", en: "Salary advances" }, actions: { ...crud(), approve: A.approve } },
      { key: "attendance", label: { fr: "Pointage", en: "Attendance" }, actions: { view: A.view, edit: A.edit } },
      { key: "leave", label: { fr: "Soldes de congés", en: "Leave balances" }, actions: { view: A.view, edit: { fr: "Soldes d'ouverture", en: "Opening balances" }, export: A.export } },
      { key: "holidays", label: { fr: "Jours fériés", en: "Public holidays" }, actions: { ...crud(), import: { fr: "Importer", en: "Import" } } },
      { key: "reviews", label: { fr: "Évaluations", en: "Performance reviews" }, actions: { ...crud(), submit: { fr: "Soumettre", en: "Submit" } } },
      { key: "discipline", label: { fr: "Sanctions disciplinaires", en: "Disciplinary actions" }, actions: crud() },
      { key: "reports", label: { fr: "Rapports RH", en: "HR reports" }, actions: { view: A.view } },
      { key: "auditLogs", label: { fr: "Journal d'audit", en: "Audit log" }, actions: { view: A.view } },
      { key: "staffRoles", label: { fr: "Niveaux du personnel RH", en: "HR staff levels" }, actions: { manage: { fr: "Attribuer", en: "Assign" } } },
    ],
  },
  {
    key: "sales",
    label: { fr: "Ventes", en: "Sales" },
    department: "sales",
    resources: [
      { key: "customers", label: { fr: "Clients", en: "Customers" }, actions: crud() },
      { key: "quotes", label: { fr: "Devis", en: "Quotes" }, actions: { ...crud(), send: { fr: "Envoyer / marquer envoyé", en: "Send / mark sent" }, decide: { fr: "Accepter / refuser", en: "Accept / refuse" }, toProject: { fr: "Créer le projet", en: "Create the project" }, invoice: { fr: "Facturer (acompte / finale)", en: "Invoice (deposit / final)" } } },
      { key: "invoices", label: { fr: "Factures", en: "Invoices" }, actions: { ...crud(), issue: { fr: "Émettre", en: "Issue" }, send: { fr: "Envoyer par e-mail", en: "Email" }, creditNote: { fr: "Avoirs", en: "Credit notes" } } },
      { key: "payments", label: { fr: "Encaissements", en: "Payments received" }, actions: { create: { fr: "Enregistrer", en: "Record" }, delete: A.delete } },
      { key: "reports", label: { fr: "Rapports (créances, TVA)", en: "Reports (receivables, VAT)" }, actions: { view: A.view } },
    ],
  },
  {
    key: "purchasing",
    label: { fr: "Achats", en: "Purchasing" },
    department: "purchasing",
    resources: [
      { key: "suppliers", label: { fr: "Fournisseurs", en: "Suppliers" }, actions: { ...crud(), documents: { fr: "Documents", en: "Documents" } } },
      { key: "priceRequests", label: { fr: "Demandes de prix", en: "Price requests" }, actions: { ...crud(), send: { fr: "Envoyer", en: "Send" }, convert: { fr: "Convertir en commande", en: "Convert to order" } } },
      { key: "orders", label: { fr: "Bons de commande", en: "Purchase orders" }, actions: { ...crud(), send: { fr: "Envoyer / changer le statut", en: "Send / change status" }, approve: A.approve, receive: { fr: "Réceptionner", en: "Receive" } } },
      { key: "invoices", label: { fr: "Factures fournisseurs", en: "Supplier invoices" }, actions: { view: A.view, create: { fr: "Enregistrer", en: "Record" }, delete: A.delete } },
      { key: "payments", label: { fr: "Règlements fournisseurs", en: "Supplier payments" }, actions: { create: { fr: "Enregistrer", en: "Record" }, delete: A.delete } },
      { key: "requests", label: { fr: "Demandes d'achat reçues", en: "Purchase requests received" }, actions: { view: A.view, process: { fr: "Traiter", en: "Process" } } },
      { key: "reports", label: { fr: "Rapports achats", en: "Purchasing reports" }, actions: { view: A.view } },
    ],
  },
  {
    key: "inventory",
    label: { fr: "Inventaire", en: "Inventory" },
    department: "production",
    resources: [
      { key: "articles", label: { fr: "Articles", en: "Articles" }, actions: { ...crud(), adjust: { fr: "Entrées / sorties de stock", en: "Stock in / out" } } },
      { key: "categories", label: { fr: "Rubriques", en: "Categories" }, actions: crud() },
      { key: "requests", label: { fr: "Demandes d'achat", en: "Purchase requests" }, actions: { view: A.view, create: A.create, delete: { fr: "Annuler", en: "Cancel" } } },
    ],
  },
  {
    key: "production",
    label: { fr: "Production", en: "Production" },
    department: "production",
    resources: [
      { key: "orders", label: { fr: "Ordres de fabrication", en: "Work orders" }, actions: { view: A.view, create: { fr: "Créer (manuel)", en: "Create (manual)" }, edit: A.edit, start: { fr: "Démarrer", en: "Start" }, consume: { fr: "Sorties de stock", en: "Book consumption" }, complete: { fr: "Terminer", en: "Complete" }, cancel: { fr: "Annuler", en: "Cancel" }, print: A.print } },
      { key: "flow", label: { fr: "Flux atelier (sorties, réceptions, chutes)", en: "Workshop flow (issues, receptions, offcuts)" }, actions: { issueBars: { fr: "Sortir les barres et les chutes", en: "Issue bars and offcuts" }, issueAccessories: { fr: "Sortir les accessoires, joints, verres…", en: "Issue accessories, gaskets, glass…" }, receive: { fr: "Réceptionner dans son atelier", en: "Receive in one's workshop" }, offcuts: { fr: "Gérer le stock de chutes", en: "Manage the offcut stock" }, subcontract: { fr: "Sous-traiter une étape", en: "Sub-contract a step" } } },
      { key: "workshops", label: { fr: "Ateliers & chefs d'atelier", en: "Workshops & workshop managers" }, actions: { all: { fr: "Tous les ateliers (responsable de production)", en: "Every workshop (production manager)" }, assign: { fr: "Nommer les chefs d'atelier et les équipes", en: "Appoint workshop managers and teams" } } },
      { key: "catalog", label: { fr: "Catalogue châssis", en: "Chassis catalogue" }, actions: { view: A.view, create: A.create, edit: A.edit, delete: A.delete } },
      { key: "config", label: { fr: "Configuration (ateliers, couleurs, séries, paramètres)", en: "Set-up (workshops, colours, series, settings)" }, actions: { view: A.view, edit: A.edit } },
      { key: "tracking", label: { fr: "Suivi de fabrication des châssis", en: "Chassis production tracking" }, actions: { view: A.view, update: { fr: "Démarré / fabriqué / prêt", en: "Started / made / ready" }, parts: { fr: "Découpage des éléments", en: "Element breakdown" }, cancel: { fr: "Annuler un châssis", en: "Cancel a chassis" } } },
    ],
  },
  {
    key: "projects",
    label: { fr: "Projets", en: "Projects" },
    department: "production",
    resources: [
      { key: "projects", label: { fr: "Projets", en: "Projects" }, actions: { ...crud(), status: { fr: "Changer le statut", en: "Change status" } } },
      { key: "items", label: { fr: "Ouvrages (châssis du projet)", en: "Project chassis" }, actions: { manage: { fr: "Ajouter / modifier / supprimer", en: "Add / edit / delete" } } },
      { key: "production", label: { fr: "Lancer la fabrication", en: "Launch production" }, actions: { plan: { fr: "Générer les ordres", en: "Generate work orders" } } },
      { key: "tasks", label: { fr: "Tâches", en: "Tasks" }, actions: { manage: { fr: "Gérer", en: "Manage" } } },
      { key: "time", label: { fr: "Heures passées", en: "Time spent" }, actions: { manage: { fr: "Saisir / supprimer", en: "Enter / delete" } } },
      { key: "materials", label: { fr: "Matières du projet", en: "Project materials" }, actions: { manage: { fr: "Sorties / retours", en: "Issue / return" } } },
      { key: "expenses", label: { fr: "Frais du projet", en: "Project expenses" }, actions: { manage: { fr: "Saisir / supprimer", en: "Enter / delete" } } },
    ],
  },
  {
    key: "logistics",
    label: { fr: "Logistique", en: "Logistics" },
    department: "logistics",
    resources: [
      { key: "toDeliver", label: { fr: "À livrer", en: "To deliver" }, actions: { view: A.view } },
      { key: "notes", label: { fr: "Bons de livraison", en: "Delivery notes" }, actions: { ...crud(), ship: { fr: "Planifier / marquer parti", en: "Plan / mark shipped" }, deliver: { fr: "Marquer livré", en: "Mark delivered" }, cancel: { fr: "Annuler / retour", en: "Cancel / return" }, print: A.print } },
      { key: "tracking", label: { fr: "Suivi chantier", en: "Site tracking" }, actions: { view: A.view, update: { fr: "Posé / réceptionné", en: "Installed / accepted" } } },
    ],
  },
  {
    key: "organization",
    label: { fr: "Organisation", en: "Organisation" },
    department: null,
    resources: [
      { key: "departments", label: { fr: "Départements", en: "Departments" }, actions: crud() },
      { key: "positions", label: { fr: "Postes", en: "Job positions" }, actions: crud() },
      { key: "schedule", label: { fr: "Horaires de travail", en: "Work schedule" }, actions: { edit: A.edit } },
    ],
  },
  {
    key: "finance",
    label: { fr: "Montants", en: "Amounts" },
    department: null,
    resources: [
      { key: "amounts", label: { fr: "Prix, coûts, marges, budgets", en: "Prices, costs, margins, budgets" }, actions: { view: A.view } },
    ],
  },
  {
    key: "team",
    label: { fr: "Équipe", en: "Team" },
    department: null,
    resources: [
      { key: "permissions", label: { fr: "Droits de son équipe", en: "Team permissions" }, actions: { manage: { fr: "Distribuer (ce qu'on a soi-même)", en: "Hand out (what one has)" } } },
    ],
  },
];

const ALL_KEYS = [];
for (const m of MODULES) for (const r of m.resources) for (const a of Object.keys(r.actions)) ALL_KEYS.push(`${m.key}.${r.key}.${a}`);
const KEY_SET = new Set(ALL_KEYS);

const keysOf = (prefix) => ALL_KEYS.filter((k) => k === prefix || k.startsWith(`${prefix}.`));
const without = (list, removed) => { const r = new Set(removed); return list.filter((k) => !r.has(k)); };

/**
 * What the manager of a department with this permissionKey gets —
 * and the default profile of its staff (see legacyDefaults).
 */
const DEPARTMENT_MODULES = {
  hr: () => [...keysOf("hr"), "organization.positions.view", "organization.departments.view"],
  production: () => [
    ...keysOf("production"), ...keysOf("inventory"), ...keysOf("projects"),
  ],
  sales: () => [...keysOf("sales"), "projects.projects.view", "production.catalog.view", "inventory.articles.view", "finance.amounts.view"],
  purchasing: () => [...keysOf("purchasing"), "inventory.articles.view", "inventory.categories.view", "inventory.requests.view", "projects.projects.view"],
  logistics: () => [...keysOf("logistics"), "projects.projects.view", "production.tracking.view"],
};

/**
 * A workshop manager (chef d'atelier, Workshop.manager) gets everything
 * needed to run HIS workshop — work orders (create, edit, start, consume,
 * complete, cancel, print), chassis tracking, catalogue / articles to
 * read, purchase requests — and can hand these out to his team. The work
 * order routes scope it to his workshop(s) (canWorkInWorkshop), so none
 * of this reaches the other workshops.
 */
const WORKSHOP_MANAGER_KEYS = () => [
  ...keysOf("production.orders"), ...keysOf("production.tracking"),
  "production.flow.receive", "production.flow.offcuts", "production.flow.subcontract",
  "production.catalog.view", "production.config.view",
  "inventory.articles.view", "inventory.categories.view", "inventory.requests.view", "inventory.requests.create",
  "projects.projects.view", "team.permissions.manage",
];

// HR levels (User.hrRole) = ready-made HR profiles.
const HR_EMPLOYEE_RECORDS = ["hr.employees.create", "hr.employees.edit", "hr.employees.import", "hr.holidays.create", "hr.holidays.edit", "hr.holidays.delete", "hr.holidays.import", "hr.leave.edit", "hr.reviews.create", "hr.reviews.edit", "hr.reviews.delete"];
const HR_MANAGER_ONLY = ["hr.absences.approve", "hr.advances.approve", "hr.reviews.submit", "hr.reviews.delete", "hr.discipline.create", "hr.discipline.edit", "hr.discipline.delete", "hr.salaries.create", "hr.salaries.edit", "hr.salaries.delete", "hr.employees.delete"];
const HR_DIRECTOR_ONLY = ["hr.staffRoles.manage"];
function hrProfile(hrRole) {
  const all = DEPARTMENT_MODULES.hr();
  switch (hrRole) {
    case "hr_assistant": return without(all, [...HR_EMPLOYEE_RECORDS, ...HR_MANAGER_ONLY, ...HR_DIRECTOR_ONLY]);
    case "hr_officer": return without(all, [...HR_MANAGER_ONLY, ...HR_DIRECTOR_ONLY]);
    case "hr_director": return all;
    default: return without(all, HR_DIRECTOR_ONLY); // hr_manager (and unset)
  }
}

/** Ready-made profiles offered on the Permissions page (applied, then fine-tuned). */
const PRESETS = [
  { key: "hr_assistant", label: { fr: "Assistant(e) RH", en: "HR assistant" }, keys: () => hrProfile("hr_assistant") },
  { key: "hr_officer", label: { fr: "Chargé(e) RH", en: "HR officer" }, keys: () => hrProfile("hr_officer") },
  { key: "hr_manager", label: { fr: "Responsable RH", en: "HR manager" }, keys: () => hrProfile("hr_manager") },
  { key: "sales_rep", label: { fr: "Commercial(e)", en: "Sales rep" }, keys: () => ["sales.customers.view", "sales.customers.create", "sales.customers.edit", "sales.quotes.view", "sales.quotes.create", "sales.quotes.edit", "sales.quotes.send", "sales.quotes.decide", "sales.invoices.view", "production.catalog.view", "inventory.articles.view", "projects.projects.view", "finance.amounts.view"] },
  { key: "sales_manager", label: { fr: "Responsable commercial", en: "Sales manager" }, keys: () => DEPARTMENT_MODULES.sales() },
  { key: "buyer", label: { fr: "Acheteur", en: "Buyer" }, keys: () => without(DEPARTMENT_MODULES.purchasing(), ["purchasing.orders.approve", "purchasing.payments.create", "purchasing.payments.delete", "purchasing.suppliers.delete", "purchasing.orders.delete"]) },
  { key: "production_manager", label: { fr: "Responsable production", en: "Production manager" }, keys: () => DEPARTMENT_MODULES.production() },
  { key: "workshop_manager", label: { fr: "Chef d'atelier", en: "Workshop manager" }, keys: () => without(WORKSHOP_MANAGER_KEYS(), ["team.permissions.manage"]) },
  { key: "chef_laquage", label: { fr: "Chef d'atelier Laquage", en: "Lacquering manager" }, keys: () => without(WORKSHOP_MANAGER_KEYS(), ["team.permissions.manage"]) },
  { key: "chef_aluminium", label: { fr: "Chef d'atelier Aluminium", en: "Aluminium manager" }, keys: () => without(WORKSHOP_MANAGER_KEYS(), ["team.permissions.manage"]) },
  { key: "chef_vitrage", label: { fr: "Chef d'atelier Vitrage", en: "Glazing manager" }, keys: () => without(WORKSHOP_MANAGER_KEYS(), ["team.permissions.manage"]) },
  { key: "bar_keeper", label: { fr: "Chargé des barres (sortie barres & chutes)", en: "Bar keeper (bars & offcuts)" }, keys: () => ["production.flow.issueBars", "production.flow.offcuts", "production.orders.view", "production.orders.print", "production.catalog.view", "inventory.articles.view", "inventory.requests.view", "inventory.requests.create", "projects.projects.view"] },
  { key: "accessory_keeper", label: { fr: "Magasinier accessoires (sortie accessoires, joints, verres)", en: "Stores (accessories, gaskets, glass)" }, keys: () => ["production.flow.issueAccessories", "production.orders.view", "production.orders.print", "production.catalog.view", "inventory.articles.view", "inventory.requests.view", "inventory.requests.create", "projects.projects.view"] },
  { key: "workshop_operator", label: { fr: "Opérateur d'atelier", en: "Workshop operator" }, keys: () => ["production.orders.view", "production.orders.start", "production.orders.consume", "production.orders.complete", "production.orders.print", "production.tracking.view", "production.tracking.update", "production.catalog.view", "inventory.articles.view", "inventory.requests.view", "inventory.requests.create"] },
  { key: "storekeeper", label: { fr: "Magasinier", en: "Storekeeper" }, keys: () => [...keysOf("inventory"), "production.orders.view", "production.orders.consume", "purchasing.suppliers.view"] },
  { key: "logistics_manager", label: { fr: "Responsable logistique", en: "Logistics manager" }, keys: () => DEPARTMENT_MODULES.logistics() },
  { key: "driver", label: { fr: "Chauffeur / livreur", en: "Driver" }, keys: () => ["logistics.notes.view", "logistics.notes.print", "logistics.notes.ship", "logistics.notes.deliver", "logistics.tracking.view", "logistics.tracking.update"] },
];

function catalogForClient() {
  return {
    modules: MODULES.map((m) => ({
      key: m.key,
      label: m.label,
      department: m.department,
      resources: m.resources.map((r) => ({
        key: r.key,
        label: r.label,
        actions: Object.entries(r.actions).map(([k, label]) => ({ key: k, perm: `${m.key}.${r.key}.${k}`, label })),
      })),
    })),
    presets: PRESETS.map((p) => ({ key: p.key, label: p.label, keys: p.keys().filter((k) => KEY_SET.has(k)) })),
  };
}

module.exports = { MODULES, ALL_KEYS, KEY_SET, keysOf, without, DEPARTMENT_MODULES, WORKSHOP_MANAGER_KEYS, hrProfile, PRESETS, catalogForClient };
