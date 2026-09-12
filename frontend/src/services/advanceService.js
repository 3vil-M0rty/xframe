import api from "./api";

// ======================================================
// GET ALL ADVANCES
// ======================================================

export const getAdvances = async ({
  companyId,
  employeeId,
  status,
  page = 1,
  limit = 20,
} = {}) => {
  const params = new URLSearchParams();

  if (companyId) params.append("companyId", companyId);
  if (employeeId) params.append("employeeId", employeeId);
  if (status) params.append("status", status);

  params.append("page", page);
  params.append("limit", limit);

  const response = await api.get(`/advances?${params.toString()}`);

  return {
    advances: response.data.data || [],
    pagination: response.data.pagination || {
      total: (response.data.data || []).length,
      page: 1,
      limit,
      pages: 1,
    },
  };
};

// ======================================================
// GET SINGLE ADVANCE
// ======================================================

export const getAdvanceById = async (id) => {
  const response = await api.get(`/advances/${id}`);
  return response.data.data;
};

// ======================================================
// CREATE ADVANCE REQUEST
// ======================================================

export const createAdvance = async (advanceData) => {
  const response = await api.post("/advances", advanceData);
  return response.data.data;
};

// ======================================================
// UPDATE ADVANCE
// ======================================================

export const updateAdvance = async (id, advanceData) => {
  const response = await api.put(`/advances/${id}`, advanceData);
  return response.data.data;
};

// ======================================================
// REVIEW ADVANCE (accept / reject)
// ======================================================

export const reviewAdvance = async (id, { status, reviewComment }) => {
  const response = await api.patch(`/advances/${id}/review`, {
    status,
    reviewComment,
  });
  return response.data.data;
};

// ======================================================
// DELETE ADVANCE
// ======================================================

export const deleteAdvance = async (id) => {
  const response = await api.delete(`/advances/${id}`);
  return response.data;
};
