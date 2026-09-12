import api from "./api";

// ======================================================
// GET ALL ABSENCES
// ======================================================

export const getAbsences = async ({
  companyId,
  employeeId,
  status,
  type,
  page = 1,
  limit = 20,
} = {}) => {
  const params = new URLSearchParams();

  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  if (status) params.append("status", status);
  if (type) params.append("type", type);

  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/absences?${params.toString()}`);

  return {
    absences: response.data.data || [],
    pagination: response.data.pagination || {
      total: (response.data.data || []).length,
      page: 1,
      limit,
      pages: 1,
    },
  };
};

// ======================================================
// GET SINGLE ABSENCE
// ======================================================

export const getAbsenceById = async (id) => {
  const response = await api.get(`/absences/${id}`);
  return response.data.data;
};

// ======================================================
// CREATE ABSENCE REQUEST
// ======================================================

export const createAbsence = async (absenceData) => {
  const response = await api.post("/absences", absenceData);
  return response.data.data;
};

// ======================================================
// UPDATE ABSENCE
// ======================================================

export const updateAbsence = async (id, absenceData) => {
  const response = await api.put(`/absences/${id}`, absenceData);
  return response.data.data;
};

// ======================================================
// REVIEW ABSENCE (accept / reject)
// ======================================================

export const reviewAbsence = async (id, { status, reviewComment }) => {
  const response = await api.patch(`/absences/${id}/review`, {
    status,
    reviewComment,
  });
  return response.data.data;
};

// ======================================================
// DELETE ABSENCE
// ======================================================

export const deleteAbsence = async (id) => {
  const response = await api.delete(`/absences/${id}`);
  return response.data;
};
