import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ClipboardList, Play, CheckCircle2, XCircle, FileText, Package, Lock, ArrowRight, Scissors, PackageCheck, PaintBucket, Send } from "lucide-react";
import CuttingPlans from "./CuttingPlans";
import { ReceiveModal, FinishLaquageModal } from "../../components/flow/FlowModals";
import { getTransfers, finishVitrage, framesDone, offcutsFromPlan } from "../../services/productionFlowService";

import { useI18n } from "../../hooks/useI18n";
import { useCan } from "../../hooks/useCan";
import { useAuth } from "../../hooks/useAuth";
import { canViewProjects, canSeeFinancials } from "../../utils/permissions";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import SearchSelect from "../../components/useful/SearchSelect";
import StatusPill from "../../components/useful/StatusPill";
import {
  getWorkOrder, startWorkOrder, consumeWorkOrder, completeWorkOrder, cancelWorkOrder, openWorkOrderPdf,
  updateWorkOrder, getCatalogArticles,
} from "../../services/productionService";
import { formatDate, formatMoney, ORDER_PILL, fmtQty, fmtMm, articleLabel } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";
import { useDialog } from "../../components/useful/DialogProvider";

/**
 * One work order (ordre de fabrication) as its workshop runs it:
 * what to produce and the planned materials (bars, accessories, gaskets…) to take
 * out of stock (booked line by line or all at once), completion.
 */
const MATERIAL_ORDER = ["profile", "accessory", "gasket", "glass", "panel", "powder", "consumable", "other"];

export default function WorkOrderDetail() {
  const dialog = useDialog();
  const can = useCan();
  const { id } = useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const money = canSeeFinancials(user);
  const [order, setOrder] = useState(null);
  const [qty, setQty] = useState({});
  const [extra, setExtra] = useState({ product: "", quantity: "" });
  const [articles, setArticles] = useState([]);
  const [completing, setCompleting] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [pending, setPending] = useState([]); // transfers waiting to be received here
  const [flowModal, setFlowModal] = useState(null);
  const load = useCallback(async () => {
    try {
      const o = await getWorkOrder(id);
      setOrder(o);
      getTransfers(o.company, { status: "sent" }).then((rows) => setPending(rows.filter((tr) => String(tr.toOrder?._id || tr.toOrder) === String(o._id)))).catch(() => setPending([]));
      if (!articles.length) getCatalogArticles(o.company, { variants: "true" }).then(setArticles).catch(() => {});
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.load")); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, okKey) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (okKey) setNotice(t(okKey));
      await load();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.save"));
      return err.response?.data || false;
    } finally { setBusy(false); }
  };

  const remaining = (n) => Math.max(0, (n.theoretical || 0) - (n.consumed || 0));
  const totals = useMemo(() => {
    if (!order) return {};
    const items = order.items.reduce((a, i) => a + (i.quantity || 0), 0);
    const done = order.items.reduce((a, i) => a + (i.done || 0), 0);
    return { items, done };
  }, [order]);

  // Project laquage / vitrage orders finish through the flow (kg of powder, glass sent to Aluminium).
  const flowFinish = !!order?.project && ["laquage", "vitrage"].includes(order?.kind);
  if (!order) return <div className="pageShell">{error && <div className="errorMessage">{error}</div>}</div>;
  const active = ["planned", "in_progress", "draft"].includes(order.status);

  const start = async () => {
    const r = await run(() => startWorkOrder(id), "prod.order.started");
    if (r && r.pending && (await dialog.confirm({ title: t("prod.order.start"), message: `${r.message}\n\n${t("prod.order.startAnyway")}` }))) await run(() => startWorkOrder(id, true), "prod.order.started");
  };
  const book = (lines) => run(() => consumeWorkOrder(id, { lines }), "prod.order.booked").then((ok) => { if (ok === true) setQty({}); });
  const bookAll = () => book(order.needs.filter((n) => n.product && remaining(n) > 0).map((n) => ({ need: n._id, quantity: Math.min(remaining(n), n.product.quantity ?? remaining(n)) })).filter((l) => l.quantity > 0));
  const cancel = async () => {
    const reason = await dialog.prompt({ title: t("common.cancel"), message: t("prod.order.cancelReason"), multiline: true });
    if (reason === null) return;
    await run(() => cancelWorkOrder(id, reason), "prod.order.cancelled");
  };
  const saveDone = (item, done) => run(() => updateWorkOrder(id, { items: [{ item: item._id, done }] }));

  // Planned materials grouped by type: profiles (bars), accessories,
  // gaskets, glass… Quantities only — no cutting list.
  const needGroups = MATERIAL_ORDER
    .map((type) => ({ type, needs: order.needs.filter((n) => (MATERIAL_ORDER.includes(n.materialType || n.product?.materialType) ? (n.materialType || n.product?.materialType) : "other") === type) }))
    .filter((g) => g.needs.length);
  // Which papers this order has: bars, glass, accessories, powder.
  const typeOfNeed = (n) => {
    const mt = n.materialType || n.product?.materialType;
    if (n.kind === "powder" || mt === "powder") return "powder";
    if (n.measure === "area" && (n.kind === "glass" || mt === "glass")) return "glass";
    if (n.measure === "length" && n.hasCuts && (n.kind === "profile" || mt === "profile" || n.product?.stockMode === "bar")) return "bars";
    return order.kind === "laquage" ? "powder" : "accessories";
  };
  const cutSections = [...new Set([...order.needs.map(typeOfNeed), ...(order.outputs?.length ? ["powder"] : []), ...(order.kind === "vitrage" ? ["glass"] : [])])];
  const hasCutting = cutSections.length > 0;
  const plannedUnit = (n) => (n.barLength
    ? t("prodPlan.barsOf").replace("{length}", fmtQty(n.barLength))
    : n.unit);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/workshops" }, { label: t("prod.workshops.title"), href: "/production/workshops" }, { label: order.number }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <ClipboardList size={20} /><h1>{order.number}</h1>
            <StatusPill status={ORDER_PILL[order.status]} label={t(`prod.orderStatus.${order.status}`)} />
          </div>
          <p className="pageSubtitle">
            <i className={styles.dot} style={{ background: order.workshop?.color }} /> {order.workshop?.name}
            {order.project && <> · {canViewProjects(user) ? <Link to={`/production/projects/${order.project._id}`}>{order.project.number} — {order.project.name}</Link> : `${order.project.number} — ${order.project.name}`}</>}
            {!order.project && order.customer && <> · {order.customer.name}</>}
            {order.dueDate && <> · {t("prod.due")} {formatDate(order.dueDate)}</>}
            {order.customerMaterial && <span className={s.tag}>{t("prod.order.customerMaterial")}</span>}
          </p>
        </div>
        <div className={purch.headerActions}>
          {can("production.orders.print") && <button type="button" className="btnEdit" onClick={() => openWorkOrderPdf(id).catch(() => setError(t("prod.errors.load")))}><FileText size={15} /> {t("prod.order.pdf")}</button>}
          {order.status === "planned" && can("production.orders.start") && <button type="button" className="btnEdit" disabled={busy} onClick={start}><Play size={15} /> {t("prod.order.start")}</button>}
          {can("production.flow.receive") && pending.map((tr) => <button key={tr._id} type="button" className="btnPrimary" onClick={() => setFlowModal({ type: "receive", transfer: tr })}><PackageCheck size={15} /> {t(`flowUi.receiveCat.${tr.category}`)} · {tr.number}</button>)}
          {flowFinish && order.status === "in_progress" && can("production.orders.complete") && order.kind === "laquage" && <button type="button" className="btnPrimary" disabled={busy || pending.length > 0} onClick={() => setFlowModal({ type: "laquage" })}><PaintBucket size={15} /> {t("flowUi.finishLaquage")}</button>}
          {flowFinish && order.status === "in_progress" && can("production.orders.complete") && order.kind === "vitrage" && <button type="button" className="btnPrimary" disabled={busy} onClick={async () => { if (await dialog.confirm(t("flowUi.finishVitrageConfirm"))) run(() => finishVitrage(id), "flowUi.vitrageSent"); }}><Send size={15} /> {t("flowUi.finishVitrage")}</button>}
          {order.project && order.kind === "aluminium" && order.status === "in_progress" && !order.framesDoneAt && can("production.orders.complete") && <button type="button" className="btnEdit" disabled={busy} onClick={() => run(() => framesDone(id), "flowUi.framesDoneNotice")}><CheckCircle2 size={15} /> {t("flowUi.framesDone")}</button>}
          {order.kind === "aluminium" && can("production.flow.offcuts") && <button type="button" className="btnEdit" disabled={busy} onClick={() => run(() => offcutsFromPlan(id), "flowUi.offcutsSaved")}><Scissors size={15} /> {t("flowUi.offcutsFromPlan")}</button>}
          {active && !flowFinish && can("production.orders.complete") && <button type="button" className="btnPrimary" disabled={busy} onClick={() => setCompleting({ consumeRemaining: true, outputs: Object.fromEntries(order.outputs.map((o) => [o._id, { produced: o.quantity, rejected: 0 }])), note: "" })}><CheckCircle2 size={15} /> {t("prod.order.complete")}</button>}
          {active && order.canManage && can("production.orders.cancel") && <button type="button" className="btnCancel" disabled={busy} onClick={cancel}><XCircle size={15} /> {t("common.cancel")}</button>}
        </div>
      </div>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      {order.framesDoneAt && order.status !== "done" && <div className={purch.infoBanner}><CheckCircle2 size={14} /> {t("flowUi.madeWithoutGlassShort")}{order.glassReceivedAt ? ` · ${t("flowUi.glassReceived")}` : ` — ${t("flowUi.waitingGlass")}`}</div>}
      {flowModal?.type === "receive" && <ReceiveModal transfer={flowModal.transfer} onClose={() => setFlowModal(null)} onDone={() => { setFlowModal(null); setNotice(t("flowUi.receivedNotice")); load(); }} />}
      {flowModal?.type === "laquage" && <FinishLaquageModal order={{ ...order, powder: order.needs.filter((n) => n.kind === "powder" || n.materialType === "powder").map((n) => ({ _id: n._id, label: n.label, product: n.product?.name, theoretical: n.theoretical, consumed: n.consumed })) }} onClose={() => setFlowModal(null)} onDone={() => { setFlowModal(null); setNotice(t("flowUi.laquageSent")); load(); }} />}

      {order.dependsOn?.length > 0 && (
        <div className={styles.flow}>
          {order.dependsOn.map((d) => (
            <Link key={d._id} to={`/production/orders/${d._id}`} className={styles.flowStep}>
              {d.status === "done" ? <CheckCircle2 size={13} className={s.good} /> : <Lock size={13} className={s.warn} />} {d.workshop?.name} · {d.number} · {t(`prod.orderStatus.${d.status}`)}
            </Link>
          ))}
          <ArrowRight size={14} /> <span className={styles.flowStep}><i className={styles.dot} style={{ background: order.workshop?.color }} /> {order.workshop?.name}</span>
        </div>
      )}
      {order.blocked && active && <div className={purch.infoBanner}><Lock size={14} /> {t("prod.order.blocked")}</div>}

      <div className={purch.summaryGrid}>
        <div className={purch.summaryCard}><span>{t("prod.order.produced")}</span><strong>{fmtQty(totals.done)} / {fmtQty(totals.items)}</strong></div>
        {money && <div className={purch.summaryCard}><span>{t("prod.order.consumedCost")}</span><strong>{formatMoney(order.consumedCost)}</strong></div>}
        <div className={purch.summaryCard}><span>{t("prod.order.labour")}</span><strong>{fmtQty((order.labourMinutes || 0) / 60, 1)} h</strong></div>
        <div className={purch.summaryCard}><span>{t("prod.order.started")}</span><strong>{order.startedAt ? formatDate(order.startedAt) : "—"}</strong></div>
      </div>

      {order.items.length > 0 && (
        <section className={purch.section}>
          <h2>{order.kind === "laquage" ? t("prod.order.barsToLacquer") : order.kind === "vitrage" ? t("prod.order.panes") : t("prod.order.toProduce")}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.needTable}>
              <thead><tr><th>{t("prod.ref")}</th><th>{t("prod.order.designation")}</th><th className={styles.num}>L</th><th className={styles.num}>H</th><th className={styles.num}>{t("prod.quantity")}</th><th className={styles.num}>{t("prod.order.done")}</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i._id}>
                    <td><strong>{i.ref || ""}</strong></td>
                    <td>{i.label}{i.finish && <small>{i.finish.code}{i.finish.name ? ` ${i.finish.name}` : ""}</small>}</td>
                    <td className={styles.num}>{i.L ? fmtMm(i.L) : ""}</td>
                    <td className={styles.num}>{i.H ? fmtMm(i.H) : ""}</td>
                    <td className={styles.num}>{fmtQty(i.quantity)}</td>
                    <td className={styles.num}>
                      {active ? <input type="number" min="0" max={i.quantity} defaultValue={i.done || 0} onBlur={(e) => Number(e.target.value) !== (i.done || 0) && saveDone(i, Number(e.target.value))} /> : fmtQty(i.done)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {order.outputs?.length > 0 && (
        <section className={purch.section}>
          <h2>{t("prod.order.outputs")}</h2>
          <table className={styles.needTable}>
            <thead><tr><th>{t("prod.order.raw")}</th><th>{t("prod.order.lacquered")}</th><th className={styles.num}>{t("prod.planned")}</th><th className={styles.num}>{t("prod.order.producedCol")}</th><th className={styles.num}>{t("prod.order.rejected")}</th><th className={styles.num}>m²</th></tr></thead>
            <tbody>
              {order.outputs.map((o) => (
                <tr key={o._id}>
                  <td>{o.product?.name}<small>{t("prod.stock")}: {fmtQty(o.product?.quantity)}</small></td>
                  <td>{o.variant?.name}<small>{t("prod.stock")}: {fmtQty(o.variant?.quantity)}{money && o.variant?.standardCost ? ` · ${t("prod.order.costPrice")} ${formatMoney(o.variant.standardCost)}` : ""}</small></td>
                  <td className={styles.num}>{fmtQty(o.quantity)}</td>
                  <td className={styles.num}>{fmtQty(o.produced)}</td>
                  <td className={styles.num}>{fmtQty(o.rejected)}</td>
                  <td className={styles.num}>{fmtQty(o.paintSurface, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hasCutting && (
        <section className={purch.section}>
          <h2><Scissors size={16} /> {t("cut.title")}</h2>
          <p className={s.muted}>{t("cut.orderHint")}</p>
          <CuttingPlans orderId={id} canPrint={can("production.orders.print")} sections={cutSections} initialTab={order.kind === "vitrage" ? "glass" : order.kind === "laquage" ? "powder" : "bars"} />
        </section>
      )}

      <section className={purch.section}>
        <div className={purch.sectionHeader}>
          <h2>{t("prod.order.materials")}</h2>
          {active && can("production.orders.consume") && <button type="button" className="btnEdit" disabled={busy} onClick={bookAll}><Package size={14} /> {t("prod.order.bookAll")}</button>}
        </div>
        <p className={s.muted}>{order.kind === "laquage" ? t("prod.order.laqCostHint") : t("prod.order.materialsHint")}</p>
        <div className={styles.tableWrap}>
          <table className={styles.needTable}>
            <thead><tr><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.planned")}</th><th className={styles.num}>{t("prod.order.consumed")}</th><th className={styles.num}>{t("prod.order.remaining")}</th><th className={styles.num}>{t("prod.stock")}</th>{active && <th>{t("prod.order.book")}</th>}</tr></thead>
            <tbody>
              {needGroups.map((g) => [
                <tr key={`g-${g.type}`} className={styles.groupRow}><td colSpan={active ? 6 : 5}>{t(`prod.materialTypes.${g.type}`)} <span className={s.muted}>· {g.needs.length}</span></td></tr>,
                ...g.needs.map((n) => {
                const rem = remaining(n);
                const short = n.product && rem > (n.product.quantity || 0);
                return (
                  <tr key={n._id}>
                    <td>
                      {n.product ? <>{n.product.name}{n.product.internalReference ? <small>{n.product.internalReference}</small> : null}</> : <span className={styles.unmapped}>{n.label}</span>}
                      {n.finish && <small>{t("prod.finish")} {n.finish.code}</small>}
                      {n.warning && <small className={styles.unmapped}>{n.warning}</small>}
                      {n.extra && <small>{t("prod.order.extraLine")}</small>}
                    </td>
                    <td className={styles.num}><strong>{fmtQty(n.theoretical)}</strong> {plannedUnit(n)}</td>
                    <td className={styles.num}>{fmtQty(n.consumed)}</td>
                    <td className={styles.num}>{fmtQty(rem)}</td>
                    <td className={`${styles.num} ${short ? s.bad : ""}`}>{n.product ? fmtQty(n.product.quantity) : "—"}</td>
                    {active && (
                      <td>
                        {n.product && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <input type="number" step="any" placeholder={fmtQty(rem)} value={qty[n._id] ?? ""} onChange={(e) => setQty({ ...qty, [n._id]: e.target.value })} title={t("prod.order.negativeReturn")} />
                            <button type="button" className="btnEdit" disabled={busy || !Number(qty[n._id])} onClick={() => book([{ need: n._id, quantity: Number(qty[n._id]) }])}>{t("prod.order.bookShort")}</button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              }),
              ])}
            </tbody>
          </table>
        </div>
        {active && (
          <div className={s.inlineForm} style={{ marginTop: 10 }}>
            <label className={s.grow}>{t("prod.order.extra")}
              <SearchSelect value={extra.product} onSelect={(v) => setExtra({ ...extra, product: v })} options={articles.map((a) => ({ value: a._id, label: articleLabel(a) }))} icon={Package} placeholder={t("prod.pickArticle")} noResultsLabel={t("common.noResults")} />
            </label>
            <label>{t("prod.quantity")}<input type="number" step="any" value={extra.quantity} onChange={(e) => setExtra({ ...extra, quantity: e.target.value })} /></label>
            <button type="button" className="btnEdit" disabled={busy || !extra.product || !Number(extra.quantity)} onClick={async () => { const ok = await run(() => consumeWorkOrder(id, { extra: [{ product: extra.product, quantity: Number(extra.quantity) }] }), "prod.order.booked"); if (ok === true) setExtra({ product: "", quantity: "" }); }}>{t("prod.order.bookShort")}</button>
          </div>
        )}
      </section>

      {order.movements?.length > 0 && (
        <section className={purch.section}>
          <h2>{t("prod.order.movements")}</h2>
          <table className={styles.needTable}>
            <thead><tr><th>{t("sales.date")}</th><th>{t("prod.editor.article")}</th><th className={styles.num}>{t("prod.quantity")}</th>{money && <th className={styles.num}>{t("prod.order.unitCost")}</th>}<th>{t("prod.order.by")}</th></tr></thead>
            <tbody>
              {order.movements.map((m) => (
                <tr key={m._id}>
                  <td>{new Date(m.createdAt).toLocaleString("fr-FR")}</td>
                  <td>{m.product?.name}<small>{m.reason}</small></td>
                  <td className={`${styles.num} ${m.type === "in" ? s.good : ""}`}>{m.type === "in" ? "+" : "−"}{fmtQty(m.quantity)}</td>
                  {money && <td className={styles.num}>{m.unitCost ? formatMoney(m.unitCost, "") : "—"}</td>}
                  <td>{m.performedBy ? `${m.performedBy.firstName || ""} ${m.performedBy.lastName || ""}`.trim() || m.performedBy.email : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {completing && (
        <div className={purch.modalOverlay} role="dialog" aria-modal="true">
          <div className={purch.modalCard} style={{ maxWidth: 560 }}>
            <h3>{t("prod.order.completeTitle")}</h3>
            <label className={purch.inlineCheck}><input type="checkbox" checked={completing.consumeRemaining} onChange={(e) => setCompleting({ ...completing, consumeRemaining: e.target.checked })} /> {t("prod.order.consumeRemaining")}</label>
            {order.outputs.length > 0 && !order.customerMaterial && order.outputs.map((o) => (
              <div key={o._id} className={s.inlineForm}>
                <span className={s.grow}>{o.variant?.name}</span>
                <label>{t("prod.order.producedCol")}<input type="number" min="0" step="any" value={completing.outputs[o._id].produced} onChange={(e) => setCompleting({ ...completing, outputs: { ...completing.outputs, [o._id]: { ...completing.outputs[o._id], produced: e.target.value } } })} /></label>
                <label>{t("prod.order.rejected")}<input type="number" min="0" step="any" value={completing.outputs[o._id].rejected} onChange={(e) => setCompleting({ ...completing, outputs: { ...completing.outputs, [o._id]: { ...completing.outputs[o._id], rejected: e.target.value } } })} /></label>
              </div>
            ))}
            <label className={purch.field}>{t("prod.order.note")}<input className={purch.input} value={completing.note} onChange={(e) => setCompleting({ ...completing, note: e.target.value })} /></label>
            {completing.shortages && (
              <>
                <p className={s.bad}>{t("prod.order.shortages")}</p>
                <ul className={styles.errList}>{completing.shortages.map((x, i) => <li key={i}>{x.product} : {t("prod.order.needed")} {fmtQty(x.needed)} · {t("prod.stock")} {fmtQty(x.stock)}</li>)}</ul>
              </>
            )}
            <div className={purch.modalActions}>
              <button type="button" className="btnCancel" onClick={() => setCompleting(null)}>{t("common.cancel")}</button>
              {completing.shortages && <button type="button" className="btnEdit" disabled={busy} onClick={async () => { const ok = await run(() => completeWorkOrder(id, { ...payload(completing), force: true }), "prod.order.completed"); if (ok === true) setCompleting(null); }}>{t("prod.order.completeAnyway")}</button>}
              <button type="button" className="btnPrimary" disabled={busy} onClick={async () => {
                const r = await run(() => completeWorkOrder(id, payload(completing)), "prod.order.completed");
                if (r === true) setCompleting(null);
                else if (r?.shortages) setCompleting({ ...completing, shortages: r.shortages });
              }}>{t("prod.order.complete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function payload(c) {
  return {
    consumeRemaining: c.consumeRemaining,
    note: c.note,
    outputs: Object.entries(c.outputs || {}).map(([output, v]) => ({ output, produced: Number(v.produced), rejected: Number(v.rejected) || 0 })),
  };
}
