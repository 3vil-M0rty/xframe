import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FolderKanban, Plus, Trash2, Pencil, Check, Clock, Package, ShoppingCart, Receipt, ListChecks, Coins, Undo2, Boxes, Factory, Radar, Scissors, Rocket } from "lucide-react";
import { ProjectOuvrages, ProjectFabrication } from "./ProjectFabrication";
import CuttingPlans from "./CuttingPlans";
import WorkflowSteps, { projectSteps } from "../../components/workflow/WorkflowSteps";
import LaunchProduction from "../../components/workflow/LaunchProduction";
import ProjectTracking from "../logistics/ProjectTracking";
import { getFinishes } from "../../services/productionService";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import StatusPill from "../../components/useful/StatusPill";
import ActionModal from "../../components/useful/ActionModal";
import { canManageProjects, canAccessSales, canAccessPurchasing, canSeeFinancials, can } from "../../utils/permissions";
import {
  getProject, updateProject, setProjectStatus, deleteProject, getProjectPeople,
  createTask, updateTask, deleteTask, addTimeEntry, deleteTimeEntry, addMaterial, addExpense, deleteExpense,
} from "../../services/projectService";
import { useCompanyProducts, formatMoney, formatDate, todayInput, toInputDate, SALES_PILL } from "../sales/salesShared";
import styles from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";

const STATUSES = ["planned", "in_progress", "on_hold", "completed", "cancelled"];
const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"];
const TABS = [
  { key: "ouvrages", icon: Boxes },
  { key: "fabrication", icon: Factory },
  { key: "debit", icon: Scissors },
  { key: "suivi", icon: Radar },
  { key: "tasks", icon: ListChecks },
  { key: "hours", icon: Clock },
  { key: "materials", icon: Package },
  { key: "purchases", icon: ShoppingCart },
  { key: "expenses", icon: Coins },
  { key: "invoices", icon: Receipt },
];

/** One project: budget vs real cost, tasks, hours, materials, purchases, expenses, invoices. */
export default function ProjectDetail() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const canEdit = canManageProjects(user);
  // Each part of the project has its own permission (tasks, hours, materials, chassis…).
  const hasList = Array.isArray(user?.permissions);
  const may = (key) => (hasList ? can(user, key) : canEdit);
  const tabPerm = { tasks: "projects.tasks.manage", hours: "projects.time.manage", materials: "projects.materials.manage", expenses: "projects.expenses.manage" };
  // Production / workshops / logistics don't see money (the API leaves it out too).
  const money = canSeeFinancials(user);
  const tabs = TABS.filter(({ key }) => money || !["expenses", "invoices"].includes(key));
  const [project, setProject] = useState(null);
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab || null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(null); // current inline form for the tab
  const [budgetForm, setBudgetForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [debitTab, setDebitTab] = useState("bars");
  const products = useCompanyProducts(may("projects.materials.manage") ? project?.company : "");

  const load = useCallback(async () => {
    try {
      setProject(await getProject(id));
    } catch (err) {
      setError(err.response?.data?.message || t("projects.errors.load"));
    }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);
  // Once production is launched, the project opens on the workshop flow.
  useEffect(() => {
    if (project && !tab) setTab((project.productionOrders || []).some((o) => o.status !== "cancelled") ? "fabrication" : "ouvrages");
  }, [project, tab]);
  useEffect(() => {
    if (project?.company && (canEdit || may("projects.tasks.manage") || may("projects.time.manage")) && !people.length) getProjectPeople(project.company).then(setPeople).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.company]);

  const run = async (fn, successKey) => {
    setError("");
    try {
      const r = await fn();
      if (successKey) setNotice(t(successKey));
      await load();
      return r ?? true;
    } catch (err) {
      setError(err.response?.data?.message || t("projects.errors.save"));
      return null;
    }
  };

  if (!project) return <div className="pageShell">{error ? <div className="errorMessage">{error}</div> : <p className={s.muted}>{t("common.loading")}</p>}</div>;

  const f = project.financials;
  const activeOrders = (project.productionOrders || []).filter((o) => o.status !== "cancelled");
  const peopleOptions = people.map((p) => ({ value: p._id, label: `${p.firstName} ${p.lastName}` }));
  const counts = {
    ouvrages: (project.items || []).length, fabrication: (project.productionOrders || []).length,
    suivi: (project.items || []).reduce((a, i) => a + (i.quantity || 0), 0),
    tasks: project.tasks.length, hours: project.timeEntries.length, materials: project.materials.length,
    purchases: project.purchaseOrders.length, expenses: project.expenses.length, invoices: project.invoices.length,
  };
  const openTabForm = () => {
    if (tab === "tasks") setForm({ title: "", startDate: "", dueDate: "", estimatedHours: "", assignees: [] });
    if (tab === "hours") setForm({ employee: "", date: todayInput(), hours: "", task: "", notes: "" });
    if (tab === "materials") setForm({ product: "", quantity: "", unitCost: "", direction: "out" });
    if (tab === "expenses") setForm({ date: todayInput(), label: "", amount: "" });
  };
  const personName = (p) => (p ? `${p.firstName} ${p.lastName}` : "—");

  const budgetRows = !money ? [] : [
    ["materials", f.budget.materials, f.actual.materials],
    ["purchases", f.budget.purchases, f.actual.purchases],
    ["labour", f.budget.labour, f.actual.labour],
    ["other", f.budget.other, f.actual.other],
  ];

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/projects" }, { label: t("projects.title"), href: "/production/projects" }, { label: project.number }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <FolderKanban size={20} />
            <h1>{project.name}</h1>
            <StatusPill status={SALES_PILL[project.status]} label={t(`projects.statuses.${project.status}`)} />
          </div>
          <p className="pageSubtitle">
            {project.number}{project.customer ? ` · ${project.customer.name}` : ""}{project.location ? ` · ${project.location}` : ""}
          </p>
        </div>
        {(may("projects.projects.status") || may("projects.projects.delete") || may("projects.production.plan")) && (
          <div className={styles.headerActions} style={{ alignItems: "center" }}>
            {may("projects.production.plan") && project.status !== "cancelled" && (
              <button type="button" className={activeOrders.length ? "btnEdit" : "btnPrimary"} disabled={!(project.items || []).length} title={!(project.items || []).length ? t("flow.noItems") : ""} onClick={() => setLaunching(true)}>
                <Rocket size={15} /> {activeOrders.some((o) => ["in_progress", "done"].includes(o.status)) ? t("flow.complete") : activeOrders.length ? t("prod.project.replan") : t("prod.project.launch")}
              </button>
            )}
            {may("projects.projects.status") && <div style={{ width: 180 }}>
              <CustomSelect value={project.status} onSelect={(v) => run(() => setProjectStatus(id, v))}
                options={STATUSES.map((st) => ({ value: st, label: t(`projects.statuses.${st}`) }))} />
            </div>}
            {may("projects.projects.delete") && <button type="button" className="btnDelete" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /></button>}
          </div>
        )}
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.infoBanner}>{notice}</div>}

      <WorkflowSteps steps={projectSteps(project, t, { navigate: canAccessSales(user) ? navigate : null, onTab: (k) => { setTab(k); setForm(null); } })} />
      {activeOrders.length > 0 && (
        <div className={s.statusBar} style={{ flexWrap: "wrap" }}>
          <span className={s.muted}>{t("flow.workshopTasks")}</span>
          {activeOrders.map((o) => (
            <button key={o._id} type="button" className="btnEdit" onClick={() => navigate(`/production/orders/${o._id}`)}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: o.workshop?.color || "#888" }} /> {o.workshop?.name} · {o.number} · {t(`prod.orderStatus.${o.status}`)}{o.progress?.total ? ` · ${o.progress.done}/${o.progress.total}` : ""}
            </button>
          ))}
        </div>
      )}
      {launching && <LaunchProduction project={project} canEditItems={may("projects.items.manage")} onChanged={load} onClose={() => setLaunching(false)} onLaunched={async (r) => { setLaunching(false); setNotice(t("flow.launched").replace("{list}", (r.orders || []).map((o) => o.number).join(", "))); await load(); }} />}

      <div className={s.docMeta}>
        <div><span>{t("projects.manager")}</span>{personName(project.manager)}</div>
        <div><span>{t("projects.startDate")}</span>{formatDate(project.startDate)}</div>
        <div><span>{t("projects.dueDate")}</span>{formatDate(project.dueDate)}</div>
        {project.quote && <div><span>{t("sales.quotes.one")}</span>
          {canAccessSales(user)
            ? <button type="button" className={styles.linkButton} onClick={() => navigate(`/sales/quotes/${project.quote._id}`)}>{project.quote.number}</button>
            : project.quote.number}
        </div>}
        <div><span>{t("projects.team")}</span>{(project.team || []).map(personName).join(", ") || "—"}</div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>{t("projects.progress")}</span>
          <strong>{f.progress}%</strong>
          <span className={s.progress}><span style={{ width: `${f.progress}%` }} /></span>
        </div>
        {money && <>
        <div className={styles.summaryCard}><span>{t("projects.revenue")}</span><strong>{formatMoney(f.revenue)}</strong>
          <span>{t("projects.invoiced")} {formatMoney(f.invoiced)} · {t("projects.toInvoice")} {formatMoney(f.toInvoice)}</span></div>
        <div className={styles.summaryCard}><span>{t("projects.actualCost")}</span>
          <strong className={f.overBudget ? s.bad : ""}>{formatMoney(f.actual.total)}</strong>
          <span>{t("projects.budget.title")} {formatMoney(f.budget.total)}{f.budgetUsedPercent !== null ? ` (${f.budgetUsedPercent}%)` : ""}</span></div>
        <div className={styles.summaryCard}><span>{t("projects.margin")}</span>
          <strong className={f.actualMargin.amount < 0 ? s.bad : s.good}>{formatMoney(f.actualMargin.amount)}</strong>
          <span>{f.actualMargin.percent !== null ? `${f.actualMargin.percent}% · ` : ""}{t("projects.planned")} {formatMoney(f.plannedMargin.amount)}</span></div>
        </>}
        <div className={styles.summaryCard}><span>{t("projects.hours")}</span><strong>{f.actual.hours} h</strong>{money && <span>{formatMoney(f.actual.labour)}</span>}</div>
      </div>

      {money && <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>{t("projects.budgetVsActual")}</h2>
          {canEdit && !budgetForm && (
            <button type="button" className="btnEdit" onClick={() => setBudgetForm({ ...project.budget })}><Pencil size={14} /> {t("projects.editBudget")}</button>
          )}
        </div>
        {budgetForm ? (
          <form className={s.inlineForm} onSubmit={async (e) => { e.preventDefault(); const r = await run(() => updateProject(id, { budget: budgetForm }), "projects.saved"); if (r) setBudgetForm(null); }}>
            {["revenue", "materials", "purchases", "labour", "other"].map((k) => (
              <label key={k}>{t(`projects.budget.${k}`)}<input type="number" min="0" step="0.01" value={budgetForm[k] ?? 0} onChange={(e) => setBudgetForm({ ...budgetForm, [k]: e.target.value })} /></label>
            ))}
            <button type="button" className="btnCancel" onClick={() => setBudgetForm(null)}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary">{t("common.save")}</button>
          </form>
        ) : (
          <div className={s.compare}>
            <div className={s.head} />
            <div className={`${s.head} ${s.num}`}>{t("projects.budget.title")}</div>
            <div className={`${s.head} ${s.num}`}>{t("projects.actual")}</div>
            <div className={`${s.head} ${s.num}`}>{t("projects.difference")}</div>
            {budgetRows.map(([k, b, a]) => [
              <div key={`${k}l`}>{t(`projects.budget.${k}`)}</div>,
              <div key={`${k}b`} className={s.num}>{formatMoney(b, "")}</div>,
              <div key={`${k}a`} className={`${s.num} ${b > 0 && a > b ? s.bad : ""}`}>{formatMoney(a, "")}</div>,
              <div key={`${k}d`} className={`${s.num} ${b - a < 0 ? s.bad : s.good}`}>{formatMoney(b - a, "")}</div>,
            ])}
            <div><strong>{t("projects.total")}</strong></div>
            <div className={s.num}><strong>{formatMoney(f.budget.total, "")}</strong></div>
            <div className={`${s.num} ${f.overBudget ? s.bad : ""}`}><strong>{formatMoney(f.actual.total, "")}</strong></div>
            <div className={`${s.num} ${f.budget.total - f.actual.total < 0 ? s.bad : s.good}`}><strong>{formatMoney(f.budget.total - f.actual.total, "")}</strong></div>
          </div>
        )}
      </section>}

      <div className={s.tabs}>
        {tabs.map(({ key, icon: Icon }) => (
          <button key={key} type="button" className={tab === key ? s.tabActive : s.tab} onClick={() => { setTab(key); setForm(null); }}>
            <Icon size={14} /> {t(`projects.tabs.${key}`, t(`prod.project.tabs.${key}`))} {counts[key] !== undefined && <span className={s.count}>{counts[key]}</span>}
          </button>
        ))}
      </div>

      {!form && ["tasks", "hours", "materials", ...(money ? ["expenses"] : [])].includes(tab) && may(tabPerm[tab]) && (
        <div className={styles.cardTopActions}>
          <button type="button" className="btnEdit" onClick={openTabForm}><Plus size={14} /> {t(`projects.add.${tab}`)}</button>
        </div>
      )}
      {tab === "purchases" && canAccessPurchasing(user) && (
        <div className={styles.cardTopActions}>
          <button type="button" className="btnEdit" onClick={() => navigate("/purchasing/orders/new", { state: { companyId: project.company, projectId: project._id } })}>
            <Plus size={14} /> {t("projects.add.purchases")}
          </button>
        </div>
      )}

      {tab === "ouvrages" && <ProjectOuvrages project={project} canEdit={may("projects.items.manage")} reload={load} onError={setError} />}
      {tab === "fabrication" && <ProjectFabrication project={project} canEdit={may("projects.production.plan")} reload={load} onError={setError} onNotice={setNotice} onShowGlassCutting={() => { setDebitTab("glass"); setTab("debit"); }} />}
      {tab === "debit" && <CuttingPlans key={`${project._id}-${(project.productionOrders || []).length}-${debitTab}`} projectId={project._id} initialTab={debitTab} />}
      {tab === "suivi" && <ProjectTracking projectId={project._id} onChanged={load} />}

      {/* ---------- inline forms ---------- */}
      {form && tab === "tasks" && (
        <form className={s.inlineForm} onSubmit={async (e) => { e.preventDefault(); const r = await run(() => createTask(id, { ...form, estimatedHours: Number(form.estimatedHours) || 0 })); if (r) setForm(null); }}>
          <label className={s.grow}>{t("projects.task.title")}<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>{t("projects.startDate")}<input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label>{t("projects.dueDate")}<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <label>{t("projects.task.estimatedHours")}<input type="number" min="0" step="0.5" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} /></label>
          <label style={{ minWidth: 200 }}>{t("projects.task.assignee")}
            <CustomSelect value={form.assignees[0] || ""} onSelect={(v) => setForm({ ...form, assignees: v ? [v] : [] })} placeholder={t("projects.pickPerson")} options={peopleOptions} />
          </label>
          <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
          <button type="submit" className="btnPrimary">{t("common.save")}</button>
        </form>
      )}
      {form && tab === "hours" && (
        <form className={s.inlineForm} onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => addTimeEntry(id, { ...form, hours: Number(form.hours) }));
          if (r) { setForm(null); if (r.warning) setNotice(r.warning); }
        }}>
          <label style={{ minWidth: 200 }}>{t("projects.time.employee")}<CustomSelect value={form.employee} onSelect={(v) => setForm({ ...form, employee: v })} placeholder={t("projects.pickPerson")} options={peopleOptions} /></label>
          <label>{t("sales.date")}<input type="date" max={todayInput()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>{t("projects.time.hours")}<input type="number" min="0.25" max="24" step="0.25" required value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></label>
          <label style={{ minWidth: 200 }}>{t("projects.time.task")}<CustomSelect value={form.task} onSelect={(v) => setForm({ ...form, task: v })} placeholder="—"
            options={[{ value: "", label: "—" }, ...project.tasks.map((tk) => ({ value: tk._id, label: tk.title }))]} /></label>
          <label className={s.grow}>{t("sales.notes")}<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
          <button type="submit" className="btnPrimary" disabled={!form.employee}>{t("common.save")}</button>
        </form>
      )}
      {form && tab === "materials" && (
        <form className={s.inlineForm} onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => addMaterial(id, { ...form, quantity: Number(form.quantity) }), form.direction === "return" ? "projects.materials.returned" : "projects.materials.taken");
          if (r) setForm(null);
        }}>
          <label style={{ minWidth: 240 }}>{t("projects.materials.article")}
            <SearchSelect value={form.product} onSelect={(v) => setForm({ ...form, product: v })} icon={Package} placeholder={t("sales.lines.pickArticle")} noResultsLabel={t("common.noResults")}
              options={products.map((p) => ({ value: p._id, label: `${p.name} — ${t("projects.materials.inStock")} ${p.quantity} ${p.unit || ""}` }))} />
          </label>
          <label>{t("sales.lines.quantity")}<input type="number" min="0" step="any" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
          {money && <label>{t("projects.materials.unitCost")}<input type="number" min="0" step="0.01" value={form.unitCost} placeholder={t("projects.materials.unitCostAuto")} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></label>}
          <label style={{ minWidth: 170 }}>{t("projects.materials.direction")}
            <CustomSelect value={form.direction} onSelect={(v) => setForm({ ...form, direction: v })}
              options={[{ value: "out", label: t("projects.materials.out") }, { value: "return", label: t("projects.materials.return") }]} />
          </label>
          <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
          <button type="submit" className="btnPrimary" disabled={!form.product}>{t("common.save")}</button>
        </form>
      )}
      {form && tab === "expenses" && (
        <form className={s.inlineForm} onSubmit={async (e) => { e.preventDefault(); const r = await run(() => addExpense(id, { ...form, amount: Number(form.amount) })); if (r) setForm(null); }}>
          <label>{t("sales.date")}<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className={s.grow}>{t("projects.expense.label")}<input required value={form.label} placeholder={t("projects.expense.placeholder")} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <label>{t("projects.expense.amount")}<input type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
          <button type="submit" className="btnPrimary">{t("common.save")}</button>
        </form>
      )}

      {/* ---------- tab contents ---------- */}
      {tab === "tasks" && (project.tasks.length === 0 ? <p className={s.muted}>{t("projects.empty.tasks")}</p> : (
        <div className="dataTable">
          {project.tasks.map((tk) => {
            const late = tk.dueDate && new Date(tk.dueDate) < new Date() && tk.status !== "done";
            return (
              <div key={tk._id} className="dataTableRow" style={{ gridTemplateColumns: "1.8fr 1.2fr 1.2fr 0.6fr 160px 44px" }}>
                <span><strong>{tk.title}</strong>{late && <span className={`${s.tag} ${s.tagBad}`}>{t("projects.late")}</span>}</span>
                <span className="dataTableCellMuted">{(tk.assignees || []).map(personName).join(", ") || "—"}</span>
                <span className="dataTableCellMuted">{formatDate(tk.startDate)} → {formatDate(tk.dueDate)}</span>
                <span className="dataTableCellMuted">{tk.estimatedHours ? `${tk.estimatedHours} h` : ""}</span>
                <span>
                  {may("projects.tasks.manage")
                    ? <CustomSelect value={tk.status} onSelect={(v) => run(() => updateTask(tk._id, { status: v }))} options={TASK_STATUSES.map((st) => ({ value: st, label: t(`projects.taskStatuses.${st}`) }))} />
                    : t(`projects.taskStatuses.${tk.status}`)}
                </span>
                <span className="dataTableActions">
                  {may("projects.tasks.manage") && <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => run(() => deleteTask(tk._id))}><Trash2 size={13} /></button>}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {tab === "hours" && (project.timeEntries.length === 0 ? <p className={s.muted}>{t("projects.empty.hours")}</p> : (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: money ? "110px 1.4fr 1.2fr 0.7fr 0.9fr 1fr 44px" : "110px 1.4fr 1.2fr 0.7fr 44px" }}>
            <span>{t("sales.date")}</span><span>{t("projects.time.employee")}</span><span>{t("projects.time.task")}</span>
            <span>{t("projects.time.hours")}</span>{money && <><span>{t("projects.time.rate")}</span><span>{t("projects.time.cost")}</span></>}<span />
          </div>
          {project.timeEntries.map((te) => (
            <div key={te._id} className="dataTableRow" style={{ gridTemplateColumns: money ? "110px 1.4fr 1.2fr 0.7fr 0.9fr 1fr 44px" : "110px 1.4fr 1.2fr 0.7fr 44px" }}>
              <span>{formatDate(te.date)}</span><span>{personName(te.employee)}</span>
              <span className="dataTableCellMuted">{te.task?.title || te.notes || "—"}</span>
              <span>{te.hours} h</span>{money && <><span className="dataTableCellMuted">{formatMoney(te.hourlyCost, "")}/h</span>
              <span>{formatMoney(te.cost)}</span></>}
              <span className="dataTableActions">{may("projects.time.manage") && <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => run(() => deleteTimeEntry(te._id))}><Trash2 size={13} /></button>}</span>
            </div>
          ))}
        </div>
      ))}
      {tab === "hours" && money && <p className={s.muted} style={{ marginTop: 8 }}>{t("projects.time.costHint")}</p>}

      {tab === "materials" && (project.materials.length === 0 ? <p className={s.muted}>{t("projects.empty.materials")}</p> : (
        <div className="dataTable">
          {project.materials.map((m) => (
            <div key={m._id} className="dataTableRow" style={{ gridTemplateColumns: money ? "110px 1.6fr 1fr 1fr 1fr" : "110px 1.6fr 1fr" }}>
              <span>{formatDate(m.createdAt)}</span>
              <span>{m.type === "in" && <Undo2 size={13} />} {m.product?.name}</span>
              <span>{m.type === "in" ? "−" : ""}{m.quantity} {m.product?.unit || ""}</span>
              {money && <><span className="dataTableCellMuted">{formatMoney(m.unitCost || 0, "")} / {m.product?.unit || "u"}</span>
              <span className={m.type === "in" ? s.good : ""}>{m.type === "in" ? "−" : ""}{formatMoney((m.unitCost || 0) * m.quantity)}</span></>}
            </div>
          ))}
        </div>
      ))}

      {tab === "purchases" && (project.purchaseOrders.length === 0 ? <p className={s.muted}>{t("projects.empty.purchases")}</p> : (
        <div className="dataTable">
          {project.purchaseOrders.map((po) => (
            <div key={po._id} className={`dataTableRow ${canAccessPurchasing(user) ? styles.clickableRow : ""}`} style={{ gridTemplateColumns: "130px 110px 1.4fr 1fr 120px" }}
              role="button" tabIndex={0} onClick={() => canAccessPurchasing(user) && navigate(`/purchasing/orders/${po._id}`)} onKeyDown={() => {}}>
              <span><strong>{po.number}</strong></span><span className="dataTableCellMuted">{formatDate(po.date)}</span>
              <span>{po.supplier?.name}</span><span>{money ? `${formatMoney(po.totalHT)} HT` : ""}</span>
              <span>{t(`purchasing.orderStatus.${po.status}`)}</span>
            </div>
          ))}
        </div>
      ))}
      {tab === "purchases" && <p className={s.muted} style={{ marginTop: 8 }}>{t("projects.purchasesHint")}</p>}

      {tab === "expenses" && (project.expenses.length === 0 ? <p className={s.muted}>{t("projects.empty.expenses")}</p> : (
        <div className="dataTable">
          {project.expenses.map((ex) => (
            <div key={ex._id} className="dataTableRow" style={{ gridTemplateColumns: "110px 2fr 1fr 44px" }}>
              <span>{formatDate(ex.date)}</span><span>{ex.label}</span><span>{formatMoney(ex.amount)}</span>
              <span className="dataTableActions">{may("projects.expenses.manage") && <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => run(() => deleteExpense(id, ex._id))}><Trash2 size={13} /></button>}</span>
            </div>
          ))}
        </div>
      ))}

      {tab === "invoices" && (project.invoices.length === 0 ? <p className={s.muted}>{t("projects.empty.invoices")}</p> : (
        <div className="dataTable">
          {project.invoices.map((inv) => (
            <div key={inv._id} className={`dataTableRow ${canAccessSales(user) ? styles.clickableRow : ""}`} style={{ gridTemplateColumns: "140px 1fr 1fr 1fr 1fr" }}
              role="button" tabIndex={0} onClick={() => canAccessSales(user) && navigate(`/sales/invoices/${inv._id}`)} onKeyDown={() => {}}>
              <span><strong>{inv.number || t("sales.invoiceStatus.draft")}</strong></span>
              <span>{t(`sales.invoiceTypes.${inv.type}`)}</span>
              <span>{formatMoney(inv.totalHT)} HT</span>
              <span className="dataTableCellMuted">{t("sales.invoices.paid")} {formatMoney(inv.amountPaid)}</span>
              <span><StatusPill status={SALES_PILL[inv.status]} label={t(`sales.invoiceStatus.${inv.status}`)} /></span>
            </div>
          ))}
        </div>
      ))}

      {canEdit && (
        <section className={styles.section}>
          <details>
            <summary className={s.muted} style={{ cursor: "pointer" }}><Pencil size={13} /> {t("projects.editDetails")}</summary>
            <ProjectDetailsForm project={project} people={people} onSave={(data) => run(() => updateProject(id, data), "projects.saved")} t={t} />
          </details>
        </section>
      )}

      <ActionModal isOpen={confirmDelete} type="confirm" title={t("projects.deleteTitle")} message={t("projects.deleteMessage")}
        onClose={() => setConfirmDelete(false)} onConfirm={async () => { setConfirmDelete(false); const r = await run(() => deleteProject(id)); if (r) navigate("/production/projects"); }} />
    </div>
  );
}

function ProjectDetailsForm({ project, people, onSave, t }) {
  const [d, setD] = useState({
    name: project.name,
    location: project.location || "",
    startDate: toInputDate(project.startDate),
    dueDate: toInputDate(project.dueDate),
    manager: project.manager?._id || "",
    team: (project.team || []).map((p) => p._id),
    description: project.description || "",
    finish: project.finish?._id || project.finish || "",
  });
  const [finishes, setFinishes] = useState([]);
  const companyId = project.company?._id || project.company;
  useEffect(() => { if (companyId) getFinishes(companyId).then(setFinishes).catch(() => setFinishes([])); }, [companyId]);
  const toggleTeam = (pid) => setD({ ...d, team: d.team.includes(pid) ? d.team.filter((x) => x !== pid) : [...d.team, pid] });
  return (
    <form className={s.inlineForm} style={{ marginTop: 10 }} onSubmit={(e) => {
      e.preventDefault();
      // The colour is also changed from the "Ouvrages" tab: only send it when edited here.
      const { finish, ...rest } = d;
      onSave(finish !== (project.finish?._id || project.finish || "") ? { ...rest, finish: finish || null } : rest);
    }}>
      <label className={s.grow}>{t("projects.name")}<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
      <label className={s.grow}>{t("projects.location")}<input value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} /></label>
      <label>{t("projects.startDate")}<input type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} /></label>
      <label>{t("projects.dueDate")}<input type="date" value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} /></label>
      <label style={{ minWidth: 200 }}>{t("projects.manager")}
        <CustomSelect value={d.manager} onSelect={(v) => setD({ ...d, manager: v })} placeholder={t("projects.pickManager")}
          options={people.map((p) => ({ value: p._id, label: `${p.firstName} ${p.lastName}` }))} />
      </label>
      <label style={{ minWidth: 220 }}>{t("cv.projectFinish")}
        <CustomSelect value={d.finish} onSelect={(v) => setD({ ...d, finish: v })} placeholder={t("prod.noFinish")}
          options={[{ value: "", label: t("prod.noFinish") }, ...finishes.filter((f) => f.isActive !== false || f._id === d.finish).map((f) => ({ value: f._id, label: `${f.code}${f.name ? ` — ${f.name}` : ""}` }))]} />
      </label>
      <div style={{ flexBasis: "100%" }}>
        <span className={s.muted}>{t("projects.team")}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
          {people.map((p) => (
            <label key={p._id} style={{ flexDirection: "row", alignItems: "center", minWidth: 0, gap: 6 }}>
              <input type="checkbox" checked={d.team.includes(p._id)} onChange={() => toggleTeam(p._id)} /> {p.firstName} {p.lastName}
            </label>
          ))}
        </div>
      </div>
      <button type="submit" className="btnPrimary"><Check size={14} /> {t("common.save")}</button>
    </form>
  );
}
