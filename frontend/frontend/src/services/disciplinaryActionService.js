import api from "./api";

export const getMyDisciplinaryActions = async () => {
  const response = await api.get("/disciplinary-actions/mine");
  return response.data.data;
};

export const getDisciplinaryActions = async ({ companyId, employeeId, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/disciplinary-actions?${params.toString()}`);
  return { actions: response.data.data, pagination: response.data.pagination };
};

export const getDisciplinaryAction = async (id) => {
  const response = await api.get(`/disciplinary-actions/${id}`);
  return response.data.data;
};

export const createDisciplinaryAction = async (data) => {
  const response = await api.post("/disciplinary-actions", data);
  return response.data.data;
};

export const updateDisciplinaryAction = async (id, data) => {
  const response = await api.put(`/disciplinary-actions/${id}`, data);
  return response.data.data;
};

export const acknowledgeDisciplinaryAction = async (id) => {
  const response = await api.patch(`/disciplinary-actions/${id}/acknowledge`);
  return response.data.data;
};

export const deleteDisciplinaryAction = async (id) => {
  const response = await api.delete(`/disciplinary-actions/${id}`);
  return response.data;
};
