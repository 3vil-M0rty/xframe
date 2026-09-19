import api from "./api";

// ======================================================
// CONTENT TRANSLATION SERVICE
// ======================================================
// One generic client for the three translation endpoints every
// translatable resource's router exposes (see
// backend/utils/translationRoutes.js). `resourceType` picks the
// base path — add an entry here whenever a new model is made
// translatable on the backend, and every screen that uses
// <TranslationEditorModal resourceType="..."> automatically gets
// working save/regenerate buttons, with no other frontend changes.
// ======================================================

const RESOURCE_BASE_PATHS = {
  product: "/products",
  jobPosition: "/job-positions",
  department: "/departments",
  inventoryCategory: "/inventory-categories",
  company: "/companies",
  absence: "/absences",
  advance: "/advances",
  attendance: "/attendance",
  contract: "/contracts",
  employee: "/employees",
  employeeDocument: "/documents",
  purchaseRequest: "/purchase-requests",
};

function basePathFor(resourceType) {
  const base = RESOURCE_BASE_PATHS[resourceType];
  if (!base) {
    throw new Error(`Unknown translatable resourceType "${resourceType}" — add it to RESOURCE_BASE_PATHS.`);
  }
  return base;
}

/** Fetches the full translations object (all configured fields x all content languages) for one record. */
export const getContentTranslations = async (resourceType, id) => {
  const response = await api.get(`${basePathFor(resourceType)}/${id}/translations`);
  return response.data.data; // { fields: [...], translations: { <field>: {...} } }
};

/** Manually sets/corrects one field's translation in one language. */
export const updateContentTranslation = async (resourceType, id, field, lang, text) => {
  const response = await api.put(`${basePathFor(resourceType)}/${id}/translations/${field}/${lang}`, { text });
  return response.data.data; // updated bucket for that field
};

/** Forces a fresh machine translation of one field/language, overwriting whatever was there. */
export const regenerateContentTranslation = async (resourceType, id, field, lang) => {
  const response = await api.post(`${basePathFor(resourceType)}/${id}/translations/${field}/${lang}/regenerate`);
  return response.data.data; // updated bucket for that field
};
