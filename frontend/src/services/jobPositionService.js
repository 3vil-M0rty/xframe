import api from "./api";

export const getJobPositions = async (companyId, department) => {
  const params = new URLSearchParams({ companyId });
  if (department) params.append("department", department);
  const response = await api.get(`/job-positions?${params.toString()}`);
  return response.data.data || [];
};

export const createJobPosition = async (data) => {
  const response = await api.post("/job-positions", data);
  return response.data.data;
};

export const updateJobPosition = async (id, data) => {
  const response = await api.put(`/job-positions/${id}`, data);
  return response.data.data;
};

export const deleteJobPosition = async (id) => {
  const response = await api.delete(`/job-positions/${id}`);
  return response.data;
};
