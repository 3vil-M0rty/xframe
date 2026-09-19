import api from "./api";

export const getWorkSchedule = async (companyId) => {
  const response = await api.get(`/work-schedule?companyId=${companyId}`);
  return response.data.data;
};

export const updateWorkSchedule = async (companyId, days, hoursManagement) => {
  const response = await api.put("/work-schedule", { companyId, ...days, hoursManagement });
  return response.data.data;
};
