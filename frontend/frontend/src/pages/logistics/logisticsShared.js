// Shared by the chassis tracking and logistics pages.
export { useCompanyPicker, formatDate, formatMoney, toInputDate } from "../purchasing/shared";

export const STAGES = ["to_make", "in_production", "made", "ready", "partially_delivered", "delivered", "installed", "received", "cancelled"];
export const STAGE_COLORS = {
  to_make: "#8b93a1",
  in_production: "#6ea8fe",
  made: "#a78bfa",
  ready: "#e8b93f",
  partially_delivered: "#5eead4",
  delivered: "#4cc38a",
  installed: "#22a06b",
  received: "#15803d",
  cancelled: "#f87171",
};
export const NOTE_PILL = { draft: "neutral", planned: "pending", shipped: "manager_approved", delivered: "accepted", cancelled: "rejected" };
export const PART_KINDS = ["complete", "frame", "sash", "glass", "module", "screen", "panel", "accessory", "other"];
export const fmtQty = (n) => (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
