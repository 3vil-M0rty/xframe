// ======================================================
// JOB TITLES BY DEPARTMENT CATEGORY
// ======================================================
// A department's `category` field (a broader business-function tag
// than `permissionKey` — see models/Department.js's comment for the
// distinction: category carries NO access-control meaning, it only
// drives which job titles get suggested here) picks which list of
// titles the Employees create/edit form offers, once that
// department is selected. A department with no category set (most
// custom-named departments a company hasn't tagged) leaves Job
// Title as plain free text, same as before this feature existed —
// there's no data-driven way to guess titles for an arbitrary
// custom department name.
//
// The "hr" category is the one exception with real teeth behind
// it: those 4 titles map to a User.hrRole permission tier when a
// login is created/linked for that employee — see
// backend/config/hrJobTitles.js and services/employeeAccountService.js.
// Every other category's titles are purely descriptive/
// standardizing, matching how this app has no tiered permission
// system for any function besides HR.
//
// Titles are canonical French strings used as both the stored
// value AND (for every category except "hr") the picker's display
// label — deliberately NOT translated per-language: the sheer
// volume across ~20 categories made that impractical to do well for
// every language here, and it matters less than it sounds, because
// Employee.jobTitle is itself a UGC-translatable field (see
// backend/plugins/translatable.js) — once saved, whoever views that
// employee's profile in another language sees it auto-translated
// regardless of what language the picker itself was shown in. Only
// "hr" reuses proper translated labels (via users.hrRole.*), since
// those exact 4 tiers already needed translating for the Users page.
// ======================================================

export const HR_JOB_TITLES = ["Assistant RH", "Chargé RH", "Responsable RH", "Directeur RH"];

const HR_LABEL_KEY_BY_TITLE = {
  "Assistant RH": "users.hrRole.assistant",
  "Chargé RH": "users.hrRole.officer",
  "Responsable RH": "users.hrRole.manager",
  "Directeur RH": "users.hrRole.director",
};

/**
 * Every OTHER category's title list, keyed by the exact `category`
 * enum value from models/Department.js (minus "hr", handled
 * separately above since it needs translated labels + the
 * hrRole-inheritance relationship).
 */
const TITLES_BY_CATEGORY = {
  management: ["Directeur Général", "Directeur Général Adjoint", "Chef de Département"],
  administration: ["Responsable Administratif", "Assistant(e) Administratif(ve)", "Secrétaire"],
  finance: ["Directeur Financier", "Responsable Financier", "Analyste Financier", "Contrôleur de Gestion"],
  accounting: ["Chef Comptable", "Comptable", "Aide-Comptable"],
  sales: ["Directeur Commercial", "Responsable des Ventes", "Commercial(e)", "Représentant(e) Commercial(e)"],
  purchasing: ["Responsable des Achats", "Acheteur(se)", "Assistant(e) Achats"],
  marketing: ["Directeur Marketing", "Responsable Marketing", "Chargé(e) de Marketing", "Community Manager"],
  production: ["Directeur de Production", "Responsable de Production", "Chef d'Équipe", "Technicien de Production", "Opérateur de Production"],
  production_planning: ["Responsable Planification", "Planificateur(trice) de Production"],
  quality_control: ["Responsable Qualité", "Contrôleur(se) Qualité", "Technicien(ne) Qualité"],
  maintenance: ["Responsable Maintenance", "Technicien(ne) de Maintenance", "Agent de Maintenance"],
  warehouse: ["Responsable d'Entrepôt", "Magasinier(ère)", "Agent de Stock"],
  logistics: ["Responsable Logistique", "Coordinateur(trice) Logistique", "Agent Logistique"],
  procurement: ["Responsable Approvisionnement", "Agent d'Approvisionnement"],
  engineering: ["Directeur Technique", "Ingénieur(e) Senior", "Ingénieur(e)", "Technicien(ne)"],
  design: ["Chef de Projet Design", "Designer", "Graphiste"],
  research_development: ["Directeur R&D", "Ingénieur(e) R&D", "Chercheur(se)"],
  it: ["Directeur des Systèmes d'Information", "Responsable IT", "Développeur(se)", "Technicien(ne) Informatique"],
  customer_service: ["Responsable Service Client", "Conseiller(ère) Client", "Agent Service Client"],
  health_safety_environment: ["Responsable HSE", "Technicien(ne) HSE", "Agent HSE"],
  security: ["Responsable Sécurité", "Agent de Sécurité"],
};

/**
 * If `currentValue` isn't one of the list's canonical titles (a
 * custom/legacy title typed before this list existed, or before
 * this department had a category set), it's appended as its own
 * option — same defensive pattern as the product unit picker — so
 * editing that employee doesn't make their existing title appear to
 * vanish.
 */
function withCurrentValuePreserved(options, titles, currentValue) {
  if (currentValue && !titles.includes(currentValue)) {
    options.push({ value: currentValue, label: currentValue });
  }
  return options;
}

export function buildHrJobTitleOptions(t, currentValue) {
  const options = HR_JOB_TITLES.map((title) => ({ value: title, label: t(HR_LABEL_KEY_BY_TITLE[title]) }));
  return withCurrentValuePreserved(options, HR_JOB_TITLES, currentValue);
}

/**
 * Single entry point Employees.jsx uses: given the `category` of
 * the department currently selected in the form, returns the right
 * options list, or null if that department has no category set (or
 * a category this list doesn't cover) — in which case the caller
 * falls back to a plain free-text Job Title field, same as before
 * this feature existed.
 */
export function buildJobTitleOptionsForDepartment(t, category, currentValue) {
  if (!category) return null;
  if (category === "hr") return buildHrJobTitleOptions(t, currentValue);

  const titles = TITLES_BY_CATEGORY[category];
  if (!titles) return null;

  const options = titles.map((title) => ({ value: title, label: title }));
  return withCurrentValuePreserved(options, titles, currentValue);
}
