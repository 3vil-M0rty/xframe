import api from "./api";

// ======================================================
// GET ALL EMPLOYEES
// ======================================================

export const getEmployees = async ({
  companyId,
  status,
  department,
  search,
  page = 1,
  limit = 20,
} = {}) => {
  const params = new URLSearchParams();

  if (companyId) params.append("companyId", companyId);
  if (status) params.append("status", status);
  if (department) params.append("department", department);
  if (search) params.append("search", search);

  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/employees?${params.toString()}`);

  // Backend responds { success, data: [...employees], pagination }.
  // Previously this unwrapped straight to `response.data.data`, which
  // silently threw away `pagination` — meaning callers had no way to
  // know how many pages/employees existed and always had to fetch
  // everything (limit: 100) and render it all in one grid. Returning
  // both lets the UI paginate instead.
  return {
    employees: response.data.data || [],
    pagination: response.data.pagination || {
      total: (response.data.data || []).length,
      page: 1,
      limit,
      pages: 1,
    },
  };
};

// ======================================================
// GET SINGLE EMPLOYEE
// ======================================================

export const getEmployeeById = async (id) => {
  const response = await api.get(`/employees/${id}`);

  // Backend responds { success, data: employee, linkedUser }.
  return {
    employee: response.data.data,
    linkedUser: response.data.linkedUser || null,
  };
};

// ======================================================
// CREATE EMPLOYEE
// ======================================================

export const createEmployee = async (employeeData) => {
  const response = await api.post(
    "/employees",
    employeeData
  );

  // Backend responds { success, data: employee, generatedLogin,
  // loginError, message }. Callers that only need the employee can
  // keep destructuring `.employee`; the login info is there for
  // whoever needs to show the temporary password.
  return {
    employee: response.data.data,
    generatedLogin: response.data.generatedLogin || null,
    loginError: response.data.loginError || null,
  };
};

// ======================================================
// UPDATE EMPLOYEE
// ======================================================

export const updateEmployee = async (id, employeeData) => {
  const response = await api.put(
    `/employees/${id}`,
    employeeData
  );

  // Backend responds { success, data: employee, message }.
  return response.data.data;
};

// ======================================================
// DELETE EMPLOYEE
// ======================================================

export const deleteEmployee = async (id) => {
  const response = await api.delete(
    `/employees/${id}`
  );

  // Backend responds { success, message, employeeId } — no `data` to unwrap.
  return response.data;
};

// ======================================================
// UPLOAD EMPLOYEE PHOTO
// ======================================================

export const uploadEmployeePhoto = async (id, file) => {
  const formData = new FormData();

  formData.append("photo", file);

  const response = await api.post(
    `/employees/${id}/photo`,
    formData
  );

  // Backend responds { success, data: employee, message }.
  return response.data.data;
};

// ======================================================
// DELETE EMPLOYEE PHOTO
// ======================================================

export const deleteEmployeePhoto = async (id) => {
  const response = await api.delete(
    `/employees/${id}/photo`
  );

  // Backend responds { success, data: employee, message }.
  return response.data.data;
};

// ======================================================
// LINK / UNLINK USER ACCOUNT (self-service access)
// ======================================================

export const linkEmployeeUser = async (employeeId, userId) => {
  const response = await api.patch(
    `/employees/${employeeId}/link-user`,
    { userId }
  );
  return response.data;
};

export const createEmployeeLogin = async (employeeId) => {
  const response = await api.post(
    `/employees/${employeeId}/create-login`
  );
  // Backend responds { success, message, data: { email, temporaryPassword } }.
  return response.data.data;
};

export const resetEmployeePassword = async (employeeId) => {
  const response = await api.post(
    `/employees/${employeeId}/reset-password`
  );
  return response.data.data;
};

export const unlinkEmployeeUser = async (employeeId) => {
  const response = await api.patch(
    `/employees/${employeeId}/unlink-user`
  );
  return response.data;
};