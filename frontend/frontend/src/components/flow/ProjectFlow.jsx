import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, PackageCheck, PaintBucket, Layers, Factory, Package, Play, CheckCircle2, Handshake, Scissors, ArrowRight, Clock, Ban } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useDialog } from "../useful/DialogProvider";
import StatusPill from "../useful/StatusPill";
import { getProjectFlow, finishVitrage, framesDone, cancelSubcontract } from "../../services/productionFlowService";
import { startWorkOrder, completeWorkOrder } from "../../services/productionService";
import { IssueModal, ReceiveModal, FinishLaquageModal, SubcontractModal } from "./FlowModals";
import { ORDER_PILL, fmtQty, formatDate } from "../../pages/production/prodShared";
import purch from "../../pages/purchasing/Purchasing.module.css";
import s from "../../pages/sales/Sales.module.css";
import styles from "./ProjectFlow.module.css";

/**
 * The project's production, step by step, with the ONE action each
 * person has to do next:
 *   1 Sortie des barres (chargé des barres)  → Laquage / directly to Aluminium
 *   2 Laquage: réception → terminé (kg de poudre) → barres laquées à l'aluminium
 *   3 Aluminium: réception → lancé → fabriqué sans vitrage → réception vitrage → terminé
 *   4 Vitrage: lancé à tout moment → terminé → envoyé à l'aluminium
 *   5 Accessoires (magasinier)
 * Any step can be sub-contracted.
 */
export default function ProjectFlow({ project, onChanged, onShowGlassCutting }) {
  const { t } = useI18n();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [flow, setFlow] = useState(null);
  const [modal, setModal] = useState(null); // { type, ... }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setFlow(await getProjectFlow(project._id)); } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
  }, [project._id, t]);
  useEffect(() => { load(); }, [load]);

  if (!flow) return error ? <div className="errorMessage">{error}</div> : null;
  if (!flow.orders.length) return null;

  const done = async (msg) => { setModal(null); if (msg) setNotice(msg); await load(); onChanged?.(); };
  const run = async (fn, msg) => {
    setBusy(true);
    setError("");
    setNotice("");
    try { await fn(); await done(msg); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); } finally { setBusy(false); }
  };
  const start = async (o) => {
    setBusy(true);
    setError("");
    try { await startWorkOrder(o._id); await done(t("prod.order.started")); } catch (err) {
      const d = err.response?.data;
      if (err.response?.status === 409 && (await dialog.confirm({ title: t("prod.order.start"), message: `${d?.message}\n\n${t("prod.order.startAnyway")}` }))) {
        try { await startWorkOrder(o._id, true); await done(t("prod.order.started")); } catch (e2) { setError(e2.response?.data?.message || t("prod.errors.save")); }
      } else if (err.response?.status !== 409) setError(d?.message || t("prod.errors.save"));
    } finally { setBusy(false); }
  };

  const can = flow.can;
  const pendingFor = (o) => flow.transfers.filter((tr) => String(tr.toOrder) === String(o._id) && tr.status === "sent");
  const outOf = (o) => flow.transfers.filter((tr) => String(tr.toOrder) === String(o._id));
  const laq = flow.orders.filter((o) => o.kind === "laquage");
  const alu = flow.orders.filter((o) => o.kind === "aluminium");
  const vit = flow.orders.filter((o) => o.kind === "vitrage");
  const others = flow.orders.filter((o) => !["laquage", "aluminium", "vitrage"].includes(o.kind));
  const barsLeft = flow.bars.reduce((a, b) => a + b.toIssue, 0);
  const accLeft = flow.accessories.filter((a) => a.toIssue > 0).length;
  const barTransfers = flow.transfers.filter((tr) => tr.category === "bars");
  const accTransfers = flow.transfers.filter((tr) => tr.category === "accessories");
  const active = (o) => ["planned", "in_progress", "draft"].includes(o.status);

  const ReceiveButtons = ({ o, label }) => (o.canWork && can.receive ? pendingFor(o).map((tr) => (
    <button key={tr._id} type="button" className="btnPrimary" disabled={busy} onClick={() => setModal({ type: "receive", transfer: { ...tr, toWorkshop: o.workshop } })}>
      <PackageCheck size={14} /> {label || t(`flowUi.receiveCat.${tr.category}`)} · {tr.number}
    </button>
  )) : pendingFor(o).length ? <span className={s.muted}><Clock size={13} /> {t("flowUi.waitingReception").replace("{n}", pendingFor(o).length)}</span> : null);

  const Subcontract = ({ o }) => {
    if (!can.subcontract || !active(o)) return null;
    if (o.subcontract) {
      return (
        <span className={styles.sub}>
          <Handshake size={13} /> {t("flowUi.subcontractedTo")} {o.subcontract.supplier?.name} · <button type="button" className={purch.linkButton} onClick={() => navigate(`/purchasing/orders/${o.subcontract.purchaseOrder?._id}`)}>{o.subcontract.purchaseOrder?.number}</button>
          <button type="button" className="tableActionBtn" title={t("flowUi.cancelSubcontract")} onClick={async () => { if (await dialog.confirm(t("flowUi.cancelSubcontractConfirm"))) run(() => cancelSubcontract(o._id)); }}><Ban size={12} /></button>
        </span>
      );
    }
    return <button type="button" className="btnEdit" onClick={() => setModal({ type: "subcontract", order: o })}><Handshake size={14} /> {t("flowUi.subcontract")}</button>;
  };

  const Step = ({ n, icon: Icon, title, who, o, state, children, color }) => (
    <li className={`${styles.step} ${styles[state] || ""}`}>
      <span className={styles.num} style={color ? { borderColor: color } : undefined}>{state === "done" ? <CheckCircle2 size={16} /> : n}</span>
      <div className={styles.body}>
        <div className={styles.head}>
          <h3><Icon size={15} /> {title}</h3>
          {o && <button type="button" className={styles.orderLink} onClick={() => navigate(`/production/orders/${o._id}`)}>{o.number} <StatusPill status={ORDER_PILL[o.status]} label={t(`prod.orderStatus.${o.status}`)} /></button>}
        </div>
        {who && <p className={styles.who}>{who}</p>}
        <div className={styles.actions}>{children}</div>
      </div>
    </li>
  );

  const transferList = (list) => list.length > 0 && (
    <div className={styles.transfers}>
      {list.map((tr) => (
        <span key={tr._id} className={`${styles.chip} ${tr.status === "received" ? styles.ok : ""}`} title={tr.lines.map((l) => `${l.label} × ${fmtQty(l.quantity)}${(l.offcuts || []).length ? ` + ${l.offcuts.reduce((a, x) => a + x.quantity, 0)} chute(s)` : ""}`).join("\n")}>
          {tr.number} → {tr.toWorkshop?.name} · {tr.status === "received" ? `${t("flowUi.receivedOn")} ${formatDate(tr.receivedAt)}` : t("flowUi.sentNotReceived")}
        </span>
      ))}
    </div>
  );

  let n = 0;
  return (
    <section className={purch.section}>
      <h2><Factory size={16} /> {t("flowUi.title")}</h2>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      <ol className={styles.steps}>
        {/* 1. Bars out of stock */}
        {(flow.bars.length > 0 || barTransfers.length > 0) && (
          <Step n={++n} icon={Truck} title={t("flowUi.steps.bars")} who={t("flowUi.who.bars")} state={barsLeft <= 0 && barTransfers.length ? "done" : "current"}>
            <span className={s.muted}>{barsLeft > 0 ? t("flowUi.barsLeft").replace("{n}", fmtQty(barsLeft)) : t("flowUi.barsAllIssued")}</span>
            {can.issueBars && <button type="button" className={barsLeft > 0 ? "btnPrimary" : "btnEdit"} onClick={() => setModal({ type: "issue", category: "bars" })}><Truck size={14} /> {t("flowUi.issueBars")}</button>}
            {transferList(barTransfers)}
          </Step>
        )}

        {/* 2. Laquage */}
        {laq.map((o) => (
          <Step key={o._id} n={++n} icon={PaintBucket} title={`${t("flowUi.steps.laquage")}${laq.length > 1 ? ` · ${o.number}` : ""}`} who={t("flowUi.who.laquage")} o={o} color={o.workshop?.color}
            state={o.status === "done" ? "done" : o.status === "in_progress" || pendingFor(o).length ? "current" : "todo"}>
            {o.status === "done" && <span className={s.good}>{t("flowUi.laquageDone")}</span>}
            <ReceiveButtons o={o} label={t("flowUi.receiveBars")} />
            {o.status === "in_progress" && o.canWork && can.complete && !pendingFor(o).length && (
              <button type="button" className="btnPrimary" disabled={busy} onClick={() => setModal({ type: "laquage", order: o })}><CheckCircle2 size={14} /> {t("flowUi.finishLaquage")}</button>
            )}
            {o.status === "planned" && !pendingFor(o).length && !outOf(o).length && <span className={s.muted}>{t("flowUi.waitingBars")}</span>}
            <Subcontract o={o} />
          </Step>
        ))}

        {/* 3. Vitrage (any time) */}
        {vit.map((o) => (
          <Step key={o._id} n={++n} icon={Layers} title={t("flowUi.steps.vitrage")} who={t("flowUi.who.vitrage")} o={o} color={o.workshop?.color}
            state={o.status === "done" ? "done" : o.status === "in_progress" ? "current" : "todo"}>
            <ReceiveButtons o={o} />
            {o.status === "planned" && o.canWork && can.start && <button type="button" className="btnEdit" disabled={busy} onClick={() => start(o)}><Play size={14} /> {t("flowUi.launchVitrage")}</button>}
            {o.status === "in_progress" && o.canWork && can.complete && (
              <button type="button" className="btnPrimary" disabled={busy} onClick={async () => { if (await dialog.confirm(t("flowUi.finishVitrageConfirm"))) run(() => finishVitrage(o._id), t("flowUi.vitrageSent")); }}><CheckCircle2 size={14} /> {t("flowUi.finishVitrage")}</button>
            )}
            {onShowGlassCutting && <button type="button" className="btnEdit" onClick={onShowGlassCutting}><Scissors size={14} /> {t("flowUi.glassCutting")}</button>}
            <Subcontract o={o} />
          </Step>
        ))}

        {/* 4. Aluminium */}
        {alu.map((o) => {
          const waitingGlass = vit.length > 0 && !o.glassReceivedAt;
          return (
            <Step key={o._id} n={++n} icon={Factory} title={t("flowUi.steps.aluminium")} who={t("flowUi.who.aluminium")} o={o} color={o.workshop?.color}
              state={o.status === "done" ? "done" : o.status === "in_progress" || pendingFor(o).length ? "current" : "todo"}>
              <ReceiveButtons o={o} />
              {o.status === "planned" && o.canWork && can.start && !pendingFor(o).filter((tr) => tr.category !== "glass").length && (
                <button type="button" className="btnPrimary" disabled={busy} onClick={() => start(o)}><Play size={14} /> {t("flowUi.launchAluminium")}</button>
              )}
              {o.status === "in_progress" && !o.framesDoneAt && vit.length > 0 && o.canWork && can.complete && (
                <button type="button" className="btnPrimary" disabled={busy} onClick={() => run(() => framesDone(o._id), t("flowUi.framesDoneNotice"))}><CheckCircle2 size={14} /> {t("flowUi.framesDone")}</button>
              )}
              {o.framesDoneAt && o.status !== "done" && <span className={styles.badge}>{t("flowUi.madeWithoutGlass").replace("{n}", fmtQty(o.items.reduce((a, i) => a + (i.quantity || 0), 0), 0))}{waitingGlass ? ` — ${t("flowUi.waitingGlass")}` : ""}</span>}
              {o.status === "in_progress" && (!waitingGlass) && (o.framesDoneAt || !vit.length) && o.canWork && can.complete && (
                <button type="button" className="btnPrimary" disabled={busy} onClick={async () => { if (await dialog.confirm(t(vit.length ? "flowUi.finishGlazedConfirm" : "flowUi.finishAluConfirm"))) run(() => completeWorkOrder(o._id, { force: true }), t("prod.order.completed")); }}>
                  <CheckCircle2 size={14} /> {vit.length ? t("flowUi.finishGlazed") : t("prod.order.complete")}
                </button>
              )}
              <Subcontract o={o} />
            </Step>
          );
        })}

        {others.map((o) => (
          <Step key={o._id} n={++n} icon={Factory} title={o.workshop?.name} o={o} color={o.workshop?.color} state={o.status === "done" ? "done" : o.status === "in_progress" ? "current" : "todo"}>
            <ReceiveButtons o={o} />
            {o.status === "planned" && o.canWork && can.start && <button type="button" className="btnEdit" disabled={busy} onClick={() => start(o)}><Play size={14} /> {t("prod.order.start")}</button>}
            <Subcontract o={o} />
          </Step>
        ))}

        {/* 5. Accessories, gaskets, glass sheets */}
        {(flow.accessories.length > 0 || accTransfers.length > 0) && (
          <Step n={++n} icon={Package} title={t("flowUi.steps.accessories")} who={t("flowUi.who.accessories")} state={accLeft === 0 && accTransfers.length ? "done" : accTransfers.length ? "current" : "todo"}>
            <span className={s.muted}>{accLeft > 0 ? t("flowUi.accLeft").replace("{n}", accLeft) : t("flowUi.accAllIssued")}</span>
            {can.issueAccessories && <button type="button" className={accLeft > 0 ? "btnPrimary" : "btnEdit"} onClick={() => setModal({ type: "issue", category: "accessories" })}><Package size={14} /> {t("flowUi.issueAccessories")}</button>}
            {transferList(accTransfers)}
          </Step>
        )}
      </ol>
      <p className={s.muted} style={{ fontSize: "0.76rem" }}><ArrowRight size={12} /> {t("flowUi.footer")}</p>

      {modal?.type === "issue" && <IssueModal project={project} flow={flow} category={modal.category} onClose={() => setModal(null)} onDone={() => done(t("flowUi.issued"))} />}
      {modal?.type === "receive" && <ReceiveModal transfer={modal.transfer} onClose={() => setModal(null)} onDone={() => done(t("flowUi.receivedNotice"))} />}
      {modal?.type === "laquage" && <FinishLaquageModal order={modal.order} onClose={() => setModal(null)} onDone={() => done(t("flowUi.laquageSent"))} />}
      {modal?.type === "subcontract" && <SubcontractModal order={modal.order} companyId={project.company} onClose={() => setModal(null)} onDone={(r) => done(t("flowUi.subcontracted").replace("{po}", r.purchaseOrder.number))} />}
    </section>
  );
}
