import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Search, Lock, RotateCcw, Save, ChevronDown, ChevronRight, UserX, Crown, Check } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { useCompanyPicker } from "../purchasing/shared";
import {
  getPermissionCatalog, getTeamPermissions, getUserPermissions, saveUserPermissions, resetUserPermissions,
} from "../../services/permissionService";
import styles from "./TeamPermissions.module.css";

/**
 * Permissions of the people under me (everyone, for admins / owners).
 * Left: my team as a tree (reporting lines). Right: one person's
 * permissions — module › resource › actions — as checkboxes. I can only
 * tick what I have myself; permissions coming from managing a
 * department are automatic (locked). "Profil du poste" = the default
 * profile of their department / HR level.
 */
const label = (obj, language) => (obj ? obj[language === "fr" || language === "ar" ? "fr" : "en"] || obj.fr : "");

export default function TeamPermissions() {
  const { t, language } = useI18n();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  const [catalog, setCatalog] = useState(null);
  const [team, setTeam] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // person
  const [state, setState] = useState(null); // permissions of the selected person
  const [draft, setDraft] = useState(new Set());
  const [open, setOpen] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPermissionCatalog().then(setCatalog).catch(() => setError(t("perm.errors.load"))); }, [t]);
  const loadTeam = useCallback(async () => {
    if (!companyId) return;
    try { setTeam(await getTeamPermissions(companyId)); } catch (err) { setError(err.response?.data?.message || t("perm.errors.load")); }
  }, [companyId, t]);
  useEffect(() => { loadTeam(); }, [loadTeam]);

  const pick = async (person) => {
    setSelected(person);
    setState(null);
    setError("");
    setNotice("");
    if (!person.user || person.user.role === "admin" || person.user.role === "owner" || person.user.self) return;
    try {
      const s = await getUserPermissions(person.user._id);
      setState(s);
      setDraft(new Set(s.effective));
    } catch (err) { setError(err.response?.data?.message || t("perm.errors.load")); }
  };

  // Tree order: roots (whose manager isn't in my list) then their reports.
  const rows = useMemo(() => {
    const people = team?.people || [];
    const ids = new Set(people.map((p) => String(p.employeeId)));
    const children = new Map();
    for (const p of people) {
      const parent = p.reportsTo && ids.has(p.reportsTo) ? p.reportsTo : "";
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(p);
    }
    const out = [];
    const walk = (pid, depth) => (children.get(pid) || []).forEach((p) => { out.push({ ...p, depth }); walk(String(p.employeeId), depth + 1); });
    walk("", 0);
    const q = search.trim().toLowerCase();
    return q ? out.filter((p) => `${p.name} ${p.jobTitle} ${p.department} ${p.user?.email || ""}`.toLowerCase().includes(q)) : out;
  }, [team, search]);

  const grantable = useMemo(() => new Set(state?.grantable || []), [state]);
  const automatic = useMemo(() => new Set(state?.fromManagement || []), [state]);
  const dirty = state && (draft.size !== state.effective.length || state.effective.some((k) => !draft.has(k)));

  const toggle = (key) => {
    if (!grantable.has(key) || automatic.has(key)) return;
    setDraft((d) => { const n = new Set(d); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };
  const setMany = (keys, on) => setDraft((d) => {
    const n = new Set(d);
    for (const k of keys) if (grantable.has(k) && !automatic.has(k)) { if (on) n.add(k); else n.delete(k); }
    return n;
  });
  const applyPreset = (presetKey) => {
    const preset = catalog.presets.find((p) => p.key === presetKey);
    if (!preset) return;
    const keep = [...draft].filter((k) => !grantable.has(k) || automatic.has(k));
    setDraft(new Set([...keep, ...preset.keys.filter((k) => grantable.has(k))]));
  };

  const save = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      // Automatic (management) ones are not stored — the server adds them back.
      const s = await saveUserPermissions(selected.user._id, [...draft].filter((k) => !automatic.has(k)));
      setState({ ...state, ...s });
      setDraft(new Set(s.effective));
      setNotice(t("perm.saved").replace("{added}", s.added?.length || 0).replace("{removed}", s.removed?.length || 0));
      loadTeam();
    } catch (err) { setError(err.response?.data?.message || t("perm.errors.save")); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm(t("perm.resetConfirm"))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const s = await resetUserPermissions(selected.user._id);
      setState({ ...state, ...s });
      setDraft(new Set(s.effective));
      setNotice(t("perm.resetDone"));
      loadTeam();
    } catch (err) { setError(err.response?.data?.message || t("perm.errors.save")); } finally { setBusy(false); }
  };

  const personStatus = (p) => {
    if (!p.user) return <span className={styles.tagMuted}><UserX size={11} /> {t("perm.noLogin")}</span>;
    if (p.user.role === "admin" || p.user.role === "owner") return <span className={styles.tagTop}><Crown size={11} /> {t("perm.fullAccess")}</span>;
    if (p.user.mode === "custom") return <span className={styles.tagCustom}>{t("perm.custom")} · {p.user.count}</span>;
    return <span className={styles.tagMuted}>{t("perm.roleProfile")}</span>;
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("perm.title") }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow"><ShieldCheck size={20} /><h1>{t("perm.title")}</h1></div>
          <p className="pageSubtitle">{team?.all ? t("perm.subtitleAll") : t("perm.subtitleTeam")}</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        {companyOptions.length > 1 && (
          <div className="filterGroup" style={{ minWidth: 220 }}>
            <label>{t("employees.toolbar.company")}</label>
            <CustomSelect value={companyId} onSelect={(v) => { setCompanyId(v); setSelected(null); setState(null); }} options={companyOptions} />
          </div>
        )}
      </div>
      {error && <div className="errorMessage">{error}</div>}

      <div className={styles.layout}>
        {/* ------------ team ------------ */}
        <aside className={styles.teamPanel}>
          <div className={styles.searchBox}><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("perm.searchPeople")} /></div>
          {team && !team.people.length && <p className={styles.muted}>{t("perm.emptyTeam")}</p>}
          <div className={styles.people}>
            {rows.map((p) => (
              <button key={p.employeeId} type="button" onClick={() => pick(p)}
                className={`${styles.person} ${selected?.employeeId === p.employeeId ? styles.personActive : ""}`}
                style={{ paddingInlineStart: 10 + p.depth * 18 }}>
                <span className={styles.personName}>{p.name}{p.manages.length > 0 && <span className={styles.managerTag} title={p.manages.join(", ")}>{t("perm.manager")}</span>}</span>
                <span className={styles.personMeta}>{[p.jobTitle, p.department].filter(Boolean).join(" · ")}</span>
                {personStatus(p)}
              </button>
            ))}
          </div>
        </aside>

        {/* ------------ permissions ------------ */}
        <section className={styles.permPanel}>
          {!selected && <div className={styles.placeholder}><ShieldCheck size={28} /><p>{t("perm.pickSomeone")}</p><small>{t("perm.rules")}</small></div>}
          {selected && !state && (
            <div className={styles.placeholder}>
              <p><strong>{selected.name}</strong></p>
              <p>{!selected.user ? t("perm.noLoginHint") : selected.user.self ? t("perm.selfHint") : selected.user.role === "admin" || selected.user.role === "owner" ? t("perm.fullAccessHint") : t("common.loading")}</p>
            </div>
          )}
          {selected && state && catalog && (
            <>
              <div className={styles.personHeader}>
                <div>
                  <h2>{selected.name}</h2>
                  <p className={styles.muted}>{[selected.jobTitle, selected.department, selected.user.email].filter(Boolean).join(" · ")}</p>
                  {state.managedDepartments?.length > 0 && <p className={styles.muted}><Lock size={12} /> {t("perm.managesHint").replace("{deps}", state.managedDepartments.join(", "))}</p>}
                </div>
                <div className={styles.headerActions}>
                  <div style={{ minWidth: 220 }}>
                    <CustomSelect value="" onSelect={applyPreset} placeholder={t("perm.applyPreset")}
                      options={catalog.presets.map((p) => ({ value: p.key, label: label(p.label, language) }))} />
                  </div>
                  <button type="button" className="btnCancel" disabled={busy} onClick={reset} title={t("perm.resetHint")}><RotateCcw size={14} /> {t("perm.reset")}</button>
                  <button type="button" className="btnPrimary" disabled={busy || !dirty} onClick={save}><Save size={14} /> {t("common.save")}</button>
                </div>
              </div>
              {notice && <div className={styles.notice}><Check size={14} /> {notice}</div>}
              <p className={styles.legend}>
                <span><i className={`${styles.box} ${styles.boxOn}`} /> {t("perm.legendOn")}</span>
                <span><i className={`${styles.box} ${styles.boxAuto}`} /> {t("perm.legendAuto")}</span>
                <span><i className={`${styles.box} ${styles.boxOff}`} /> {t("perm.legendOff")}</span>
                <span className={styles.muted}>{t("perm.legendGrantable")}</span>
              </p>
              {catalog.modules.map((m) => {
                const keys = m.resources.flatMap((r) => r.actions.map((a) => a.perm));
                const on = keys.filter((k) => draft.has(k)).length;
                const mine = keys.filter((k) => grantable.has(k)).length;
                if (!mine && !on) return null;
                const isOpen = open[m.key] ?? on > 0;
                return (
                  <div key={m.key} className={styles.module}>
                    <div className={styles.moduleHead}>
                      <button type="button" className={styles.moduleToggle} onClick={() => setOpen({ ...open, [m.key]: !isOpen })}>
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />} {label(m.label, language)}
                        <span className={styles.count}>{on} / {keys.length}</span>
                      </button>
                      {mine > 0 && (
                        <span className={styles.moduleActions}>
                          <button type="button" className={styles.linkBtn} onClick={() => { setMany(keys, true); setOpen({ ...open, [m.key]: true }); }}>{t("perm.all")}</button>
                          <button type="button" className={styles.linkBtn} onClick={() => setMany(keys, false)}>{t("perm.none")}</button>
                        </span>
                      )}
                    </div>
                    {isOpen && (
                      <div className={styles.resources}>
                        {m.resources.map((r) => {
                          const rKeys = r.actions.map((a) => a.perm);
                          return (
                            <div key={r.key} className={styles.resource}>
                              <div className={styles.resourceName}>
                                {label(r.label, language)}
                                {rKeys.some((k) => grantable.has(k)) && (
                                  <button type="button" className={styles.linkBtnSmall} onClick={() => setMany(rKeys, !rKeys.filter((k) => grantable.has(k)).every((k) => draft.has(k)))}>{t("perm.toggleRow")}</button>
                                )}
                              </div>
                              <div className={styles.actions}>
                                {r.actions.map((a) => {
                                  const checked = draft.has(a.perm);
                                  const auto = automatic.has(a.perm);
                                  const locked = auto || !grantable.has(a.perm);
                                  return (
                                    <button key={a.perm} type="button" onClick={() => toggle(a.perm)} disabled={locked}
                                      title={auto ? t("perm.autoHint") : !grantable.has(a.perm) ? t("perm.notGrantable") : a.perm}
                                      className={`${styles.action} ${checked ? (auto ? styles.actionAuto : styles.actionOn) : ""} ${locked ? styles.actionLocked : ""}`}>
                                      {auto ? <Lock size={11} /> : <span className={styles.check}>{checked ? <Check size={11} /> : null}</span>}
                                      {label(a.label, language)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
