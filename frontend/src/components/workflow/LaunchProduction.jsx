import { useEffect, useState } from "react";
import { Rocket, AlertTriangle, Factory } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import { getProjectProduction, planProjectProduction } from "../../services/productionService";
import MissingGlassFix from "./MissingGlassFix";
import purch from "../../pages/purchasing/Purchasing.module.css";
import s from "../../pages/sales/Sales.module.css";

/**
 * "Lancer la fabrication" for a project: shows which workshop will receive
 * which tasks (and the stock shortages), then creates the work orders —
 * each workshop finds its own in Ateliers, in the right order
 * (Laquage / Vitrage before Aluminium).
 */
export default function LaunchProduction({ project, onClose, onLaunched, onChanged, canEditItems = true }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => getProjectProduction(project._id).then(setData).catch((err) => setError(err.response?.data?.message || t("prod.errors.load")));
  useEffect(() => { refresh(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project._id]);
  const active = (data?.orders || []).filter((o) => o.status !== "cancelled");
  const replan = active.length > 0;
  const started = active.some((o) => ["in_progress", "done"].includes(o.status));
  // Already running: only the workshops that have no order yet can be added (e.g. Vitrage once the glass is chosen).
  const haveOrder = new Set(active.map((o) => o.workshop?.code));
  const missingWorkshops = (data?.plan.workshops || []).filter((w) => !haveOrder.has(w.workshop.code));
  const launch = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await planProjectProduction(project._id, started ? { onlyMissing: true } : {});
      onLaunched(r);
    } catch (err) {
      const d = err.response?.data?.details;
      setError(`${err.response?.data?.message || t("prod.errors.save")}${d?.length ? ` — ${d.slice(0, 3).map((x) => `${x.where}: ${x.message}`).join(" · ")}` : ""}`);
    } finally { setBusy(false); }
  };
  return (
    <div className={purch.modalOverlay} role="dialog" aria-modal="true">
      <div className={purch.modalCard} style={{ maxWidth: 620 }}>
        <h3><Rocket size={16} /> {started ? t("flow.complete") : replan ? t("prod.project.replan") : t("prod.project.launch")} — {project.number}</h3>
        {!data && !error && <p className={s.muted}>{t("common.loading")}</p>}
        {data && (
          <>
            <MissingGlassFix project={project} missing={data.missingGlass} canEdit={canEditItems} onFixed={async () => { await onChanged?.(); refresh(); }} />
            <p className={s.muted}>{started ? t("flow.completeHint") : t("flow.launchHint")}</p>
            {data.plan.errors.length > 0 && <div className="errorMessage">{t("flow.planErrors")}: {data.plan.errors.slice(0, 3).map((e) => `${e.where} — ${e.message}`).join(" · ")}</div>}
            <table className={s.compareTable || undefined} style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
              <thead><tr><th style={{ textAlign: "left", padding: 6 }}>{t("prod.workshop")}</th><th style={{ textAlign: "right", padding: 6 }}>{t("flow.tasks")}</th><th style={{ textAlign: "right", padding: 6 }}>{t("flow.materials")}</th><th style={{ textAlign: "left", padding: 6 }}>{t("flow.after")}</th></tr></thead>
              <tbody>
                {data.plan.workshops.map((w) => (
                  <tr key={w.workshop.code} style={{ borderTop: "1px solid var(--color-border)", opacity: started && haveOrder.has(w.workshop.code) ? 0.5 : 1 }}>
                    <td style={{ padding: 6 }}><Factory size={13} style={{ color: w.workshop.color }} /> <strong>{w.workshop.name}</strong>{started && haveOrder.has(w.workshop.code) && <small className={s.muted}> · {t("flow.hasOrder")}</small>}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{w.items.length}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>{w.needs.length}</td>
                    <td style={{ padding: 6 }} className={s.muted}>{w.dependsOnCodes.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.plan.shortages.length > 0 && <p className={s.warn} style={{ marginTop: 10 }}><AlertTriangle size={14} /> {t("flow.shortages").replace("{n}", data.plan.shortages.length)}</p>}
            {replan && !started && <p className={s.warn}>{t("prod.project.replanConfirm")}</p>}
            {started && !missingWorkshops.length && <p className={s.muted}>{t("flow.nothingToComplete")}</p>}
          </>
        )}
        {error && <div className="errorMessage" style={{ marginTop: 10 }}>{error}</div>}
        <div className={purch.modalActions}>
          <button type="button" className="btnCancel" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btnPrimary" disabled={busy || !data || (started && !missingWorkshops.length) || data.plan.errors.length > 0 || !(project.items || []).length} onClick={launch}><Rocket size={14} /> {started ? t("flow.completeButton").replace("{list}", missingWorkshops.map((w) => w.workshop.name).join(", ")) : replan ? t("prod.project.replan") : t("prod.project.launch")}</button>
        </div>
      </div>
    </div>
  );
}
