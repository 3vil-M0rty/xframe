const VARIANT_CLASS = {
  pending: "statusPillPending",
  accepted: "statusPillAccepted",
  rejected: "statusPillRejected",
};

/**
 * Renders a small colored pill for a workflow status
 * ("pending" / "accepted" / "rejected"). `label` is whatever
 * translated text the caller wants shown — this component only
 * owns the color, not the wording, so it stays language-agnostic.
 */
export default function StatusPill({ status, label }) {
  const variantClass = VARIANT_CLASS[status] || "statusPillNeutral";

  return <span className={`statusPill ${variantClass}`}>{label}</span>;
}
