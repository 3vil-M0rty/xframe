import api from "./api";

/**
 * Private documents have no permanent URL: ask the backend for a
 * link that expires after a few minutes (routes/files.js).
 *   kind: "employee-document" | "supplier-document" | "order-reception"
 *         | "order-invoice" | "price-request-quote"
 */
export const getFileLink = async ({ kind, id, sub }) => {
  const params = new URLSearchParams({ kind, id });
  if (sub) params.append("sub", sub);
  return (await api.get(`/files/link?${params.toString()}`)).data.data;
};
