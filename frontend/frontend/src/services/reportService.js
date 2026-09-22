import api from "./api";

export const getHeadcountReport = async (companyId) => {
  const response = await api.get(`/reports/headcount?companyId=${companyId}`);
  return response.data.data;
};

export const getTurnoverReport = async (companyId, months = 12) => {
  const response = await api.get(
    `/reports/turnover?companyId=${companyId}&months=${months}`
  );
  return response.data.data;
};

export const getAbsenteeismReport = async (companyId, months = 6) => {
  const response = await api.get(
    `/reports/absenteeism?companyId=${companyId}&months=${months}`
  );
  return response.data.data;
};

export const getPayrollCostReport = async (companyId, months = 12) => {
  const response = await api.get(
    `/reports/payroll-cost?companyId=${companyId}&months=${months}`
  );
  return response.data.data;
};

export const getCurrentPayrollEstimate = async (companyId) => {
  const response = await api.get(
    `/reports/current-payroll-estimate?companyId=${companyId}`
  );
  return response.data.data;
};

export const getEmployeeRankings = async (companyId, days = 30) => {
  const response = await api.get(
    `/reports/employee-rankings?companyId=${companyId}&days=${days}`
  );
  return response.data.data;
};
