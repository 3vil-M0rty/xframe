import { useCallback, useEffect, useState } from "react";
import { Settings2, Plus, X, Pencil, Trash2, Palette, User } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import { canSeeFinancials } from "../../utils/permissions";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import SearchSelect from "../../components/useful/SearchSelect";
import {
  getWorkshops, createWorkshop, updateWorkshop, deleteWorkshop,
  getFinishes, createFinish, updateFinish, deleteFinish,
  getProductionSettings, saveProductionSettings, getCatalogArticles,
} from "../../services/productionService";
import { getProjectPeople } from "../../services/projectService";
import { useCompanyPicker, WORKSHOP_KINDS, FINISH_KINDS, articleLabel } from "./prodShared";
import purch from "../purchasing/Purchasing.module.css";
import s from "../sales/Sales.module.css";
import styles from "./Production.module.css";
import { ralOptions } from "../../utils/ralColors";
import { useDialog } from "../../components/useful/DialogProvider";

const RAL_OPTIONS = ralOptions();
/** Hourly rates, colour surcharges and pricing settings are hidden from people who don't see amounts. */
const useMoney = () => canSeeFinancials(useAuth().user);


/** Production set-up: workshops (with their manager and team), colours, calculation settings. */
export default function ProductionConfig() {
  const { t } = useI18n();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.production"), href: "/production/workshops" }, { label: t("prod.config.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><Settings2 size={20} /><h1>{t("prod.config.title")}</h1></div>
          <p className="pageSubtitle">{t("prod.config.subtitle")}</p>
        </div>
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>
      {companyId && <WorkshopsTab companyId={companyId} />}
    </div>
  );
}

// ------------------------------------------------------------------
function WorkshopsTab({ companyId }) {
  const dialog = useDialog();
  const money = useMoney();
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [w, p] = await Promise.all([getWorkshops(companyId), getProjectPeople(companyId).catch(() => [])]);
      setRows(w);
      setPeople(p);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.load"));
    }
  }, [companyId, t]);
  useEffect(() => { load(); }, [load]);

  const personOptions = people.map((p) => ({ value: p._id, label: `${p.firstName} ${p.lastName}`, searchText: `${p.firstName} ${p.lastName} ${p.jobTitle || ""}` }));
  const nameOf = (id) => { const p = people.find((x) => String(x._id) === String(id)); return p ? `${p.firstName} ${p.lastName}` : ""; };

  const edit = (w) => setForm(w ? {
    _id: w._id, code: w.code, name: w.name, kind: w.kind, color: w.color || "#4c8dff", hourlyRate: w.hourlyRate ?? 0, order: w.order ?? 0,
    manager: w.manager?._id || "", members: (w.members || []).map((m) => m._id), feeds: (w.feeds || []).map((f) => f._id), description: w.description || "", isActive: w.isActive !== false,
  } : { code: "", name: "", kind: "other", color: "#4c8dff", hourlyRate: 0, order: rows.length + 1, manager: "", members: [], feeds: [], description: "", isActive: true });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { ...form, company: companyId };
      if (form._id) await updateWorkshop(form._id, body); else await createWorkshop(body);
      setForm(null);
      setNotice(t("prod.saved"));
      load();
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.save"));
    }
  };
  const remove = async (w) => {
    if (!(await dialog.confirm(t("prod.config.deleteWorkshop")))) return;
    try {
      const r = await deleteWorkshop(w._id);
      setNotice(r.message || t("prod.deleted"));
      load();
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };

  return (
    <>
      <p className={s.muted}>{t("prod.config.workshopsHint")}</p>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      <div className={purch.sectionHeader}>
        <div className={styles.flow}>
          {rows.filter((w) => w.isActive).map((w) => (
            <span key={w._id} className={styles.flowStep}><i className={styles.dot} style={{ background: w.color }} /> {w.name}{(w.feeds || []).length > 0 && <> → {(w.feeds || []).map((f) => f.name).join(", ")}</>}</span>
          ))}
        </div>
        <button type="button" className="btnPrimary" onClick={() => edit(null)}><Plus size={15} /> {t("prod.config.newWorkshop")}</button>
      </div>

      {form && (
        <form className={purch.panel} onSubmit={save}>
          <div className={purch.sectionHeader}><h3>{form._id ? form.name : t("prod.config.newWorkshop")}</h3><button type="button" className="tableActionBtn" onClick={() => setForm(null)}><X size={14} /></button></div>
          <div className={purch.formGrid}>
            <label className={purch.field}>{t("prod.config.code")}<input className={purch.input} required value={form.code} maxLength={12} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ALU" /></label>
            <label className={purch.field}>{t("prod.config.name")}<input className={purch.input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className={purch.field}>{t("prod.config.kind")}<CustomSelect value={form.kind} onSelect={(v) => setForm({ ...form, kind: v })} options={WORKSHOP_KINDS.map((k) => ({ value: k, label: t(`prod.workshopKinds.${k}`) }))} /></label>
            {money && <label className={purch.field}>{t("prod.config.hourlyRate")}<input className={purch.input} type="number" min="0" step="any" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></label>}
            <label className={purch.field}>{t("prod.config.color")}<input className={purch.input} type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ height: 36, padding: 2 }} /></label>
            <label className={purch.field}>{t("prod.config.order")}<input className={purch.input} type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></label>
            <label className={purch.field}>{t("prod.config.manager")}
              <SearchSelect value={form.manager} onSelect={(v) => setForm({ ...form, manager: v })} options={personOptions} icon={User} placeholder={t("prod.config.pickPerson")} noResultsLabel={t("common.noResults")} />
            </label>
            <label className={purch.field}>{t("prod.config.status")}<CustomSelect value={form.isActive ? "1" : "0"} onSelect={(v) => setForm({ ...form, isActive: v === "1" })} options={[{ value: "1", label: t("prod.active") }, { value: "0", label: t("prod.inactive") }]} /></label>
          </div>
          <div className={purch.formGrid}>
            <div className={purch.field}>{t("prod.config.members")}
              <div className={styles.memberPicker}>
                <div className={styles.chips}>
                  {form.members.map((id) => <span key={id} className={styles.chip}>{nameOf(id)}<button type="button" className="tableActionBtn" onClick={() => setForm({ ...form, members: form.members.filter((x) => x !== id) })}><X size={11} /></button></span>)}
                </div>
                <SearchSelect value="" onSelect={(v) => v && !form.members.includes(v) && setForm({ ...form, members: [...form.members, v] })} options={personOptions.filter((o) => !form.members.includes(o.value))} icon={User} placeholder={t("prod.config.addMember")} noResultsLabel={t("common.noResults")} />
              </div>
            </div>
            <div className={purch.field}>{t("prod.config.feeds")}
              <div className={styles.memberPicker}>
                <div className={styles.chips}>
                  {form.feeds.map((id) => <span key={id} className={styles.chip}>{rows.find((w) => w._id === id)?.name}<button type="button" className="tableActionBtn" onClick={() => setForm({ ...form, feeds: form.feeds.filter((x) => x !== id) })}><X size={11} /></button></span>)}
                </div>
                <CustomSelect value="" onSelect={(v) => v && setForm({ ...form, feeds: [...form.feeds, v] })} placeholder={t("prod.config.addFeed")}
                  options={rows.filter((w) => w._id !== form._id && !form.feeds.includes(w._id)).map((w) => ({ value: w._id, label: w.name }))} />
                <small className={s.muted}>{t("prod.config.feedsHint")}</small>
              </div>
            </div>
          </div>
          <label className={purch.field}>{t("prod.config.description")}<input className={purch.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className={purch.formActions}>
            <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary">{t("common.save")}</button>
          </div>
        </form>
      )}

      <div className="dataTable">
        <div className="dataTableHead" style={{ gridTemplateColumns: money ? "80px 1.2fr 1fr 1.2fr 1.6fr 1fr 90px 80px" : "80px 1.2fr 1fr 1.2fr 1.6fr 1fr 80px" }}>
          <span>{t("prod.config.code")}</span><span>{t("prod.config.name")}</span><span>{t("prod.config.kind")}</span><span>{t("prod.config.manager")}</span>
          <span>{t("prod.config.members")}</span><span>{t("prod.config.feeds")}</span>{money && <span>{t("prod.config.hourlyRate")}</span>}<span />
        </div>
        {rows.map((w) => (
          <div key={w._id} className="dataTableRow" style={{ gridTemplateColumns: money ? "80px 1.2fr 1fr 1.2fr 1.6fr 1fr 90px 80px" : "80px 1.2fr 1fr 1.2fr 1.6fr 1fr 80px", opacity: w.isActive ? 1 : 0.5 }}>
            <span><i className={styles.dot} style={{ background: w.color }} /> <strong>{w.code}</strong></span>
            <span>{w.name}</span>
            <span className="dataTableCellMuted">{t(`prod.workshopKinds.${w.kind}`)}</span>
            <span>{w.manager ? `${w.manager.firstName} ${w.manager.lastName}` : <span className={styles.unmapped}>{t("prod.config.noManager")}</span>}</span>
            <span className="dataTableCellMuted">{(w.members || []).map((m) => m.firstName).join(", ") || "—"}</span>
            <span className="dataTableCellMuted">{(w.feeds || []).map((f) => f.code).join(", ") || "—"}</span>
            {money && <span>{w.hourlyRate || 0}</span>}
            <span className="dataTableActions">
              <button type="button" className="tableActionBtn" onClick={() => edit(w)} title={t("common.edit")}><Pencil size={14} /></button>
              <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => remove(w)} title={t("common.delete")}><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------
export function FinishesTab({ companyId }) {
  const dialog = useDialog();
  const money = useMoney();
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [powders, setPowders] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [f, w, p] = await Promise.all([getFinishes(companyId), getWorkshops(companyId), getCatalogArticles(companyId, { materialType: "powder" })]);
      setRows(f);
      setWorkshops(w);
      setPowders(p);
    } catch (err) {
      setError(err.response?.data?.message || t("prod.errors.load"));
    }
  }, [companyId, t]);
  useEffect(() => { load(); }, [load]);

  const edit = (f) => setForm(f ? {
    _id: f._id, code: f.code, name: f.name || "", kind: f.kind, color: f.color || "#cccccc", powderProduct: f.powderProduct?._id || "",
    processWorkshop: f.processWorkshop?._id || "", surchargePercent: f.surchargePercent ?? 0, isDefault: !!f.isDefault, isActive: f.isActive !== false,
  } : { code: "", name: "", kind: "lacquer", color: "#f4f4f4", powderProduct: "", processWorkshop: "", surchargePercent: 0, isDefault: false, isActive: true });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { ...form, company: companyId };
      if (form._id) await updateFinish(form._id, body); else await createFinish(body);
      setForm(null);
      setNotice(t("prod.saved"));
      load();
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  const remove = async (f) => {
    if (!(await dialog.confirm(t("prod.config.deleteFinish")))) return;
    try { const r = await deleteFinish(f._id); setNotice(r.message || t("prod.deleted")); load(); } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };

  return (
    <>
      <p className={s.muted}>{t("prod.config.finishesHint")}</p>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      <div className={purch.sectionHeader}><span /><button type="button" className="btnPrimary" onClick={() => edit(null)}><Plus size={15} /> {t("prod.config.newFinish")}</button></div>
      {form && (
        <form className={purch.panel} onSubmit={save}>
          <div className={purch.sectionHeader}><h3>{form._id ? form.code : t("prod.config.newFinish")}</h3><button type="button" className="tableActionBtn" onClick={() => setForm(null)}><X size={14} /></button></div>
          <div className={purch.formGrid}>
            <label className={purch.field} style={{ gridColumn: "1 / -1" }}>{t("cv.ralPick")}
              <SearchSelect value={/^RAL \d{4}$/.test(form.code) ? form.code.slice(4) : ""} icon={Palette} placeholder={t("cv.ralPickPh")} noResultsLabel={t("cv.ralNone")}
                options={RAL_OPTIONS}
                onSelect={(v) => { const r = RAL_OPTIONS.find((o) => o.value === v); if (r) setForm({ ...form, code: `RAL ${r.value}`, name: r.name, color: r.hex.toLowerCase(), kind: form.kind === "raw" ? "lacquer" : form.kind }); }} />
            </label>
            <label className={purch.field}>{t("prod.config.code")}<input className={purch.input} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="RAL 9016" /></label>
            <label className={purch.field}>{t("prod.config.name")}<input className={purch.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("prod.config.finishNamePh")} /></label>
            <label className={purch.field}>{t("prod.config.kind")}<CustomSelect value={form.kind} onSelect={(v) => setForm({ ...form, kind: v })} options={FINISH_KINDS.map((k) => ({ value: k, label: t(`prod.finishKinds.${k}`) }))} /></label>
            <label className={purch.field}>{t("prod.config.color")}<input className={purch.input} type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ height: 36, padding: 2 }} /></label>
            {form.kind === "lacquer" && (
              <>
                <label className={purch.field}>{t("prod.config.processWorkshop")}
                  <CustomSelect value={form.processWorkshop} onSelect={(v) => setForm({ ...form, processWorkshop: v })} placeholder={t("prod.config.autoLaquage")}
                    options={workshops.filter((w) => w.kind === "laquage").map((w) => ({ value: w._id, label: w.name }))} />
                </label>
                <label className={purch.field}>{t("prod.config.powder")}
                  <SearchSelect value={form.powderProduct} onSelect={(v) => setForm({ ...form, powderProduct: v })} options={powders.map((p) => ({ value: p._id, label: articleLabel(p) }))} placeholder={t("prod.config.pickPowder")} noResultsLabel={t("prod.config.noPowder")} />
                </label>
              </>
            )}
            {money && <label className={purch.field}>{t("prod.config.surcharge")}<input className={purch.input} type="number" min="0" step="any" value={form.surchargePercent} onChange={(e) => setForm({ ...form, surchargePercent: e.target.value })} /></label>}
            <label className={purch.field}>{t("prod.config.status")}<CustomSelect value={form.isActive ? "1" : "0"} onSelect={(v) => setForm({ ...form, isActive: v === "1" })} options={[{ value: "1", label: t("prod.active") }, { value: "0", label: t("prod.inactive") }]} /></label>
          </div>
          <label className={purch.inlineCheck}><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> {t("prod.config.defaultFinish")}</label>
          <p className={s.muted}>{t(`prod.config.finishKindHint.${form.kind}`)}</p>
          <div className={purch.formActions}>
            <button type="button" className="btnCancel" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary">{t("common.save")}</button>
          </div>
        </form>
      )}
      <div className="dataTable">
        <div className="dataTableHead" style={{ gridTemplateColumns: money ? "44px 1fr 1.2fr 1fr 1fr 1.4fr 80px 80px" : "44px 1fr 1.2fr 1fr 1fr 1.4fr 80px" }}>
          <span /><span>{t("prod.config.code")}</span><span>{t("prod.config.name")}</span><span>{t("prod.config.kind")}</span><span>{t("prod.config.processWorkshop")}</span><span>{t("prod.config.powder")}</span>{money && <span>{t("prod.config.surchargeShort")}</span>}<span />
        </div>
        {rows.map((f) => (
          <div key={f._id} className="dataTableRow" style={{ gridTemplateColumns: money ? "44px 1fr 1.2fr 1fr 1fr 1.4fr 80px 80px" : "44px 1fr 1.2fr 1fr 1fr 1.4fr 80px", opacity: f.isActive ? 1 : 0.5 }}>
            <span><i className={styles.dot} style={{ background: f.color, width: 18, height: 18, border: "1px solid var(--color-border)" }} /></span>
            <span><strong>{f.code}</strong>{f.isDefault && <span className={s.tag}>{t("prod.default")}</span>}</span>
            <span>{f.name || "—"}</span>
            <span className="dataTableCellMuted">{t(`prod.finishKinds.${f.kind}`)}</span>
            <span className="dataTableCellMuted">{f.processWorkshop?.name || "—"}</span>
            <span>{f.kind === "lacquer" ? (f.powderProduct ? `${f.powderProduct.name} (${f.powderProduct.quantity} ${f.powderProduct.unit || "kg"})` : <span className={styles.unmapped}>{t("prod.config.noPowderLinked")}</span>) : "—"}</span>
            {money && <span>{f.surchargePercent ? `+${f.surchargePercent}%` : "—"}</span>}
            <span className="dataTableActions">
              <button type="button" className="tableActionBtn" onClick={() => edit(f)} title={t("common.edit")}><Pencil size={14} /></button>
              <button type="button" className="tableActionBtn tableActionBtnDanger" onClick={() => remove(f)} title={t("common.delete")}><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Grouped so the cutting settings (débit) are easy to find.
const SETTING_GROUPS = [
  { key: "bars", fields: [["defaultBarLength", "mm"], ["kerf", "mm"], ["trimAllowance", "mm"], ["barEndTrim", "mm"], ["cutSpacing", "mm"], ["minReusableOffcut", "mm"]] },
  { key: "glass", fields: [["glassEdgeTrim", "mm"], ["glassCutGap", "mm"], ["glassWastePercent", "%"]] },
  { key: "powder", fields: [["defaultCoverage", "kg/m²"], ["powderWastePercent", "%"]] },
  { key: "pricing", fields: [["pricingProfileWaste", "%"], ["defaultCoefficient", "×"]] },
];
const NUMBER_SETTINGS = SETTING_GROUPS.flatMap((g) => g.fields);
const MONEY_SETTINGS = ["pricingProfileWaste", "defaultCoefficient"];
export function SettingsTab({ companyId }) {
  const money = useMoney();
  const { t } = useI18n();
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    getProductionSettings(companyId).then(setForm).catch((err) => setError(err.response?.data?.message || t("prod.errors.load")));
  }, [companyId, t]);
  if (!form) return error ? <div className="errorMessage">{error}</div> : null;
  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { powderMethod: form.powderMethod, lacquerFromStockFirst: !!form.lacquerFromStockFirst, consumeOnComplete: !!form.consumeOnComplete, deliverRequiresReady: form.deliverRequiresReady !== false, glassAllowRotation: form.glassAllowRotation !== false, mitreNesting: form.mitreNesting !== false };
      for (const [k] of NUMBER_SETTINGS) if (money || !MONEY_SETTINGS.includes(k)) body[k] = Number(form[k]);
      setForm(await saveProductionSettings(companyId, body));
      setNotice(t("prod.saved"));
    } catch (err) { setError(err.response?.data?.message || t("prod.errors.save")); }
  };
  return (
    <form onSubmit={save}>
      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={purch.infoBanner}>{notice}</div>}
      {SETTING_GROUPS.map((g) => {
        const fields = g.fields.filter(([k]) => money || !MONEY_SETTINGS.includes(k));
        if (!fields.length) return null;
        return (
          <fieldset key={g.key} className={styles.cutSettings} style={{ border: "1px solid var(--color-border)" }}>
            <h4>{t(`cut.groups.${g.key}`)}</h4>
            {g.key === "bars" && <p className={s.muted} style={{ fontSize: "0.76rem", margin: "0 0 8px" }}>{t("cut.barsSettingsHint")}</p>}
            {g.key === "glass" && <p className={s.muted} style={{ fontSize: "0.76rem", margin: "0 0 8px" }}>{t("cut.glassSettingsHint")}</p>}
            <div className={purch.formGrid}>
              {g.key === "powder" && (
                <label className={purch.field}>{t("prod.settings.powderMethod")}
                  <CustomSelect value={form.powderMethod} onSelect={(v) => setForm({ ...form, powderMethod: v })} options={["surface", "per_unit", "manual"].map((m) => ({ value: m, label: t(`prod.settings.methods.${m}`) }))} />
                </label>
              )}
              {fields.map(([k, unit]) => (
                <label key={k} className={purch.field}>{t(`prod.settings.${k}`, t(`cut.settingLabels.${k}`))} ({unit})
                  <input className={purch.input} type="number" step="any" min="0" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </label>
              ))}
            </div>
            {g.key === "bars" && <label className={purch.inlineCheck}><input type="checkbox" checked={form.mitreNesting !== false} onChange={(e) => setForm({ ...form, mitreNesting: e.target.checked })} /> {t("cut.fields.nest")}</label>}
            {g.key === "glass" && <label className={purch.inlineCheck}><input type="checkbox" checked={form.glassAllowRotation !== false} onChange={(e) => setForm({ ...form, glassAllowRotation: e.target.checked })} /> {t("cut.fields.allowRotation")}</label>}
          </fieldset>
        );
      })}
      <p className={s.muted}>{t(`prod.settings.methodHint.${form.powderMethod}`)}</p>
      <label className={purch.inlineCheck}><input type="checkbox" checked={!!form.lacquerFromStockFirst} onChange={(e) => setForm({ ...form, lacquerFromStockFirst: e.target.checked })} /> {t("prod.settings.lacquerFromStockFirst")}</label>
      <label className={purch.inlineCheck}><input type="checkbox" checked={!!form.consumeOnComplete} onChange={(e) => setForm({ ...form, consumeOnComplete: e.target.checked })} /> {t("prod.settings.consumeOnComplete")}</label>
      <label className={purch.inlineCheck}><input type="checkbox" checked={form.deliverRequiresReady !== false} onChange={(e) => setForm({ ...form, deliverRequiresReady: e.target.checked })} /> {t("logi.settingReady")}</label>
      <div className={purch.formActions}><button type="submit" className="btnPrimary">{t("common.save")}</button></div>
    </form>
  );
}
