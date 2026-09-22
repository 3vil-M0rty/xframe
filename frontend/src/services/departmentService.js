import api from "./api";

export const getDepartments = async (companyId) => {
  const response = await api.get(`/departments?companyId=${companyId}`);
  return response.data.data || [];
};

export const createDepartment = async (data) => {
  const response = await api.post("/departments", data);
  return response.data.data;
};

export const updateDepartment = async (id, data) => {
  const response = await api.put(`/departments/${id}`, data);
  return response.data.data;
};

export const deleteDepartment = async (id) => {
  const response = await api.delete(`/departments/${id}`);
  return response.data;
};

export const seedDefaultDepartments = async (companyId, categories) => {
  const response = await api.post("/departments/seed-defaults", { company: companyId, categories });
  return response.data;
};
