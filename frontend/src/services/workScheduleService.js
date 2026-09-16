import api from "./api";

export const getWorkSchedule = async (companyId) => {
  const response = await api.get(`/work-schedule?companyId=${companyId}`);
  return response.data.data;
};

export const updateWorkSchedule = async (companyId, days) => {
  const response = await api.put("/work-schedule", { companyId, ...days });
  return response.data.data;
};
