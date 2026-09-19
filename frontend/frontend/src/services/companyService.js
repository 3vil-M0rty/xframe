import api from "./api";

// ======================================================
// GET ALL COMPANIES
// ======================================================

export const getCompanies = async () => {
  const response = await api.get("/companies");

  return response.data.data;
};

// ======================================================
// GET SINGLE COMPANY
// ======================================================

export const getCompanyById = async (id) => {
  const response = await api.get(`/companies/${id}`);

  return response.data.data;
};

// ======================================================
// CREATE COMPANY
// ======================================================

export const createCompany = async (companyData) => {
  const response = await api.post(
    "/companies",
    companyData
  );

  return response.data.data;
};

// ======================================================
// UPDATE COMPANY
// ======================================================

export const updateCompany = async (id, companyData) => {
  const response = await api.put(
    `/companies/${id}`,
    companyData
  );

  return response.data.data;
};

// ======================================================
// DELETE COMPANY
// ======================================================

export const deleteCompany = async (id) => {
  const response = await api.delete(
    `/companies/${id}`
  );

  return response.data;
};

// ======================================================
// UPLOAD COMPANY LOGO
// ======================================================

export const uploadCompanyLogo = async (id, file) => {
  const formData = new FormData();

  formData.append("logo", file);

  const response = await api.post(
    `/companies/${id}/logo`,
    formData
  );

  return response.data;
};

// ======================================================
// DELETE COMPANY LOGO
// ======================================================

export const deleteCompanyLogo = async (id) => {
  const response = await api.delete(
    `/companies/${id}/logo`
  );

  return response.data;
};