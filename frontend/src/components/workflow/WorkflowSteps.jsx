import { Check } from "lucide-react";
import styles from "./WorkflowSteps.module.css";

/**
 * The single path of a job, shown on the devis and on the project:
 *   Devis → Validé → Projet lancé → Ouvrages → Fabrication lancée → Ateliers → Terminé
 * steps = [{ key, label, detail?, state: "done" | "current" | "todo", onClick? }]
 */
export default function WorkflowSteps({ steps }) {
  return (
    <ol className={styles.steps}>
      {steps.map((st, i) => {
        const Tag = st.onClick ? "button" : "div";
        return (
          <li key={st.key} className={`${styles.step} ${styles[st.state] || ""}`}>
            <Tag type={st.onClick ? "button" : undefined} className={styles.inner} onClick={st.onClick}>
              <span className={styles.badge}>{st.state === "done" ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
              <span className={styles.text}>
                <strong>{st.label}</strong>
                {st.detail && <small>{st.detail}</small>}
              </span>
            </Tag>
          </li>
        );
      })}
    </ol>
  );
}

/** Steps of a devis (the project part is only known once launched). */
export function quoteSteps(quote, t, navigate) {
  const accepted = quote.status === "accepted";
  return [
    { key: "quote", label: t("flow.steps.quote"), detail: t(`sales.quoteStatus.${quote.status}`), state: "done" },
    { key: "validated", label: t("flow.steps.validated"), state: accepted ? "done" : ["draft", "sent"].includes(quote.status) ? "current" : "todo" },
    { key: "launched", label: t("flow.steps.launched"), detail: quote.project ? quote.project.number : undefined, state: quote.project ? "done" : accepted ? "current" : "todo", onClick: quote.project ? () => navigate(`/production/projects/${quote.project._id}`) : undefined },
    { key: "production", label: t("flow.steps.production"), detail: quote.project ? t("flow.seeProject") : undefined, state: "todo", onClick: quote.project ? () => navigate(`/production/projects/${quote.project._id}`, { state: { tab: "fabrication" } }) : undefined },
  ];
}

/** Steps of a project, from its devis to the workshops. */
export function projectSteps(project, t, { navigate, onTab } = {}) {
  const orders = (project.productionOrders || []).filter((o) => o.status !== "cancelled");
  const done = orders.filter((o) => o.status === "done").length;
  const started = orders.some((o) => ["in_progress", "done"].includes(o.status));
  const items = (project.items || []).reduce((a, i) => a + (i.quantity || 0), 0);
  const finished = project.status === "completed";
  return [
    { key: "quote", label: t("flow.steps.quote"), detail: project.quote?.number || t("flow.noQuote"), state: "done", onClick: project.quote && navigate ? () => navigate(`/sales/quotes/${project.quote._id}`) : undefined },
    { key: "launched", label: t("flow.steps.launched"), detail: project.number, state: "done" },
    { key: "items", label: t("flow.steps.items"), detail: t("flow.chassisCount").replace("{n}", items), state: orders.length ? "done" : "current", onClick: onTab ? () => onTab("ouvrages") : undefined },
    { key: "production", label: t("flow.steps.production"), detail: orders.length ? t("flow.ordersCount").replace("{n}", orders.length) : undefined, state: orders.length ? "done" : items ? "current" : "todo", onClick: onTab ? () => onTab("fabrication") : undefined },
    { key: "workshops", label: t("flow.steps.workshops"), detail: orders.length ? `${done} / ${orders.length}` : undefined, state: orders.length && done === orders.length ? "done" : started || orders.length ? "current" : "todo", onClick: onTab ? () => onTab("fabrication") : undefined },
    { key: "done", label: t("flow.steps.done"), state: finished ? "done" : "todo" },
  ];
}
