import { useCallback, useEffect, useState } from "react";
import { Building2, Plus, Check, UserPlus, PauseCircle, PlayCircle, ChevronDown, ChevronRight, AlertTriangle, Pencil } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import ActionModal from "../../components/useful/ActionModal";
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  addClientAdmin,
  getOrphans,
  assignOrphans,
} from "../../services/platformService";

import styles from "./Clients.module.css";

const EMPTY_ADMIN = { firstName: "", lastName: "", email: "", password: "" };

function AdminFields({ value, onChange, t }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span>{t("platform.fields.firstName")}</span>
        <input required value={value.firstName} onChange={set("firstName")} />
      </label>
      <label className={styles.field}>
        <span>{t("platform.fields.lastName")}</span>
        <input required value={value.lastName} onChange={set("lastName")} />
      </label>
      <label className={styles.field}>
        <span>{t("platform.fields.email")}</span>
        <input required type="email" value={value.email} onChange={set("email")} />
      </label>
      <label className={styles.field}>
        <span>{t("platform.fields.password")}</span>
        <input required type="text" minLength={8} value={value.password} onChange={set("password")} autoComplete="new-password" />
        <small>{t("platform.fields.passwordHint")}</small>
      </label>
    </div>
  );
}

/**
 * Platform operator: the clients (tenants) of the platform. Create a
 * client with its first admin, suspend / reactivate it, give it
 * another admin, attach records left without a client. Shows counts
 * only — never a client's business data.
 */
export default function Clients() {
  const { t, language } = useI18n();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", notes: "", admin: EMPTY_ADMIN });
  const [saving, setSaving] = useState(false);

  const [expanded, setExpanded] = useState(null); // client id
  const [details, setDetails] = useState({}); // id -> detail (with admins)
  const [adminFormFor, setAdminFormFor] = useState(null);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);

  const [statusTarget, setStatusTarget] = useState(null);
  const [rename, setRename] = useState({ id: null, name: "" });

  const [orphans, setOrphans] = useState({ companies: [], users: [] });
  const [orphanPick, setOrphanPick] = useState({ tenantId: "", companyIds: [], userIds: [] });

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString(language || undefined) : "—");
  const errMsg = (err, fallback) => err.response?.data?.message || t(fallback);

  const load = useCallback(async () => {
    try {
      setError("");
      const [list, orph] = await Promise.all([getClients(), getOrphans()]);
      setClients(list);
      setOrphans(orph);
    } catch (err) {
      setError(errMsg(err, "platform.errors.load"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDetails = async (id) => {
    try {
      const d = await getClient(id);
      setDetails((prev) => ({ ...prev, [id]: d }));
    } catch (err) {
      setError(errMsg(err, "platform.errors.load"));
    }
  };

  const toggle = (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setAdminFormFor(null);
    loadDetails(id);
  };

  // ---------- create ----------
  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { tenant, admin } = await createClient(form);
      setNotice(t("platform.created").replace("{name}", tenant.name).replace("{email}", admin.email));
      setForm({ name: "", notes: "", admin: EMPTY_ADMIN });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(errMsg(err, "platform.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  // ---------- suspend / reactivate ----------
  const confirmStatus = async () => {
    if (!statusTarget) return;
    const next = statusTarget.status === "suspended" ? "active" : "suspended";
    try {
      await updateClient(statusTarget._id, { status: next });
      setNotice(t(next === "suspended" ? "platform.suspendedNotice" : "platform.reactivatedNotice").replace("{name}", statusTarget.name));
      setStatusTarget(null);
      await load();
    } catch (err) {
      setStatusTarget(null);
      setError(errMsg(err, "platform.errors.save"));
    }
  };

  // ---------- rename ----------
  const handleRename = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await updateClient(rename.id, { name: rename.name });
      setRename({ id: null, name: "" });
      await Promise.all([load(), loadDetails(rename.id)]);
    } catch (err) {
      setError(errMsg(err, "platform.errors.save"));
    }
  };

  // ---------- extra admin ----------
  const handleAddAdmin = async (e, clientId) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const admin = await addClientAdmin(clientId, adminForm);
      setNotice(t("platform.adminAdded").replace("{email}", admin.email));
      setAdminForm(EMPTY_ADMIN);
      setAdminFormFor(null);
      await Promise.all([loadDetails(clientId), load()]);
    } catch (err) {
      setError(errMsg(err, "platform.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  // ---------- unattached records ----------
  const togglePick = (key, id) => setOrphanPick((p) => ({
    ...p,
    [key]: p[key].includes(id) ? p[key].filter((x) => x !== id) : [...p[key], id],
  }));

  const handleAssign = async () => {
    setError("");
    try {
      const res = await assignOrphans(orphanPick);
      setNotice(t("platform.orphans.done").replace("{companies}", res.companies).replace("{users}", res.users));
      setOrphanPick({ tenantId: "", companyIds: [], userIds: [] });
      await load();
    } catch (err) {
      setError(errMsg(err, "platform.errors.save"));
    }
  };

  const clientOptions = clients.map((c) => ({ value: c._id, label: c.name }));
  const hasOrphans = orphans.companies.length > 0 || orphans.users.length > 0;
  const COLUMNS = "28px 1.6fr 2fr 0.8fr 0.8fr 1fr 1fr 130px";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.platform"), href: "/platform/clients" }, { label: t("platform.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Building2 size={20} />
            <h1>{t("platform.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("platform.subtitle")}</p>
        </div>
        <button type="button" className="btnPrimary" onClick={() => setShowCreate((v) => !v)}>
          <Plus size={15} /> {t("platform.new")}
        </button>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.notice}><Check size={15} /> {notice}</div>}

      {showCreate && (
        <form className={styles.card} onSubmit={handleCreate}>
          <h2 className={styles.cardTitle}>{t("platform.new")}</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>{t("platform.fields.name")}</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("platform.fields.namePlaceholder")} />
            </label>
            <label className={styles.field}>
              <span>{t("platform.fields.notes")}</span>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <h3 className={styles.subTitle}>{t("platform.firstAdmin")}</h3>
          <p className={styles.hint}>{t("platform.firstAdminHint")}</p>
          <AdminFields value={form.admin} onChange={(admin) => setForm({ ...form, admin })} t={t} />
          <div className={styles.actions}>
            <button type="button" className="btnCancel" onClick={() => setShowCreate(false)}>{t("common.cancel")}</button>
            <button type="submit" className="btnPrimary" disabled={saving}>{saving ? t("common.loading") : t("platform.create")}</button>
          </div>
        </form>
      )}

      {hasOrphans && (
        <div className={styles.orphans}>
          <div className={styles.orphansHead}>
            <AlertTriangle size={16} />
            <strong>{t("platform.orphans.title")}</strong>
          </div>
          <p className={styles.hint}>{t("platform.orphans.hint")}</p>
          <div className={styles.orphanLists}>
            {orphans.companies.length > 0 && (
              <div>
                <h4>{t("platform.orphans.companies")}</h4>
                {orphans.companies.map((c) => (
                  <label key={c._id} className={styles.checkRow}>
                    <input type="checkbox" checked={orphanPick.companyIds.includes(c._id)} onChange={() => togglePick("companyIds", c._id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
            {orphans.users.length > 0 && (
              <div>
                <h4>{t("platform.orphans.users")}</h4>
                {orphans.users.map((u) => (
                  <label key={u._id} className={styles.checkRow}>
                    <input type="checkbox" checked={orphanPick.userIds.includes(u._id)} onChange={() => togglePick("userIds", u._id)} />
                    {u.firstName} {u.lastName} <span className={styles.muted}>{u.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className={styles.assignRow}>
            <div className={styles.assignSelect}>
              <CustomSelect value={orphanPick.tenantId} placeholder={t("platform.orphans.chooseClient")}
                onSelect={(v) => setOrphanPick((p) => ({ ...p, tenantId: v }))} options={clientOptions} />
            </div>
            <button type="button" className="btnPrimary"
              disabled={!orphanPick.tenantId || (orphanPick.companyIds.length + orphanPick.userIds.length === 0)}
              onClick={handleAssign}>
              {t("platform.orphans.assign")}
            </button>
          </div>
        </div>
      )}

      {loading && <p className={styles.hint}>{t("common.loading")}</p>}

      {!loading && clients.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Building2 size={28} /></div>
          <h2>{t("platform.emptyTitle")}</h2>
          <p>{t("platform.emptyMessage")}</p>
        </div>
      )}

      {!loading && clients.length > 0 && (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: COLUMNS }}>
            <span />
            <span>{t("platform.columns.client")}</span>
            <span>{t("platform.columns.companies")}</span>
            <span>{t("platform.columns.accounts")}</span>
            <span>{t("platform.columns.employees")}</span>
            <span>{t("platform.columns.status")}</span>
            <span>{t("platform.columns.created")}</span>
            <span />
          </div>
          {clients.map((c) => {
            const open = expanded === c._id;
            const detail = details[c._id];
            const suspended = c.status === "suspended";
            return (
              <div key={c._id} className={styles.clientBlock}>
                <div className="dataTableRow" style={{ gridTemplateColumns: COLUMNS }}>
                  <button type="button" className={styles.expandBtn} onClick={() => toggle(c._id)} aria-label={t("platform.details")}>
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <span><strong>{c.name}</strong>{c.notes && <small className={styles.muted}> — {c.notes}</small>}</span>
                  <span className="dataTableCellMuted">{c.companies.map((x) => x.name).join(", ") || "—"}</span>
                  <span>{c.counts.users}</span>
                  <span>{c.counts.employees}</span>
                  <span>
                    <span className={`statusPill ${suspended ? "statusPillRejected" : "statusPillAccepted"}`}>
                      {t(suspended ? "platform.status.suspended" : "platform.status.active")}
                    </span>
                  </span>
                  <span className="dataTableCellMuted">{formatDate(c.createdAt)}</span>
                  <span className={styles.rowActions}>
                    <button type="button" className={suspended ? "btnEdit" : "btnCancel"} onClick={() => setStatusTarget(c)}>
                      {suspended ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                      {t(suspended ? "platform.reactivate" : "platform.suspend")}
                    </button>
                  </span>
                </div>

                {open && (
                  <div className={styles.detail}>
                    {rename.id === c._id ? (
                      <form className={styles.renameRow} onSubmit={handleRename}>
                        <input required value={rename.name} onChange={(e) => setRename({ id: c._id, name: e.target.value })} />
                        <button type="submit" className="btnPrimary">{t("common.save")}</button>
                        <button type="button" className="btnCancel" onClick={() => setRename({ id: null, name: "" })}>{t("common.cancel")}</button>
                      </form>
                    ) : (
                      <button type="button" className={`btnEdit ${styles.renameBtn}`} onClick={() => setRename({ id: c._id, name: c.name })}>
                        <Pencil size={13} /> {t("platform.rename")}
                      </button>
                    )}
                    <div className={styles.detailHead}>
                      <h4>{t("platform.admins")}</h4>
                      <button type="button" className="btnEdit" onClick={() => { setAdminFormFor(c._id); setAdminForm(EMPTY_ADMIN); }}>
                        <UserPlus size={14} /> {t("platform.addAdmin")}
                      </button>
                    </div>
                    {!detail && <p className={styles.hint}>{t("common.loading")}</p>}
                    {detail && detail.admins.length === 0 && <p className={styles.hint}>{t("platform.noAdmins")}</p>}
                    {detail && detail.admins.map((a) => (
                      <div key={a._id} className={styles.adminRow}>
                        <span>{a.firstName} {a.lastName}</span>
                        <span className={styles.muted}>{a.email}</span>
                        <span className={styles.muted}>{t(`platform.roles.${a.role}`)}</span>
                        <span className={styles.muted}>{a.status}</span>
                      </div>
                    ))}
                    {adminFormFor === c._id && (
                      <form className={styles.inlineForm} onSubmit={(e) => handleAddAdmin(e, c._id)}>
                        <AdminFields value={adminForm} onChange={setAdminForm} t={t} />
                        <div className={styles.actions}>
                          <button type="button" className="btnCancel" onClick={() => setAdminFormFor(null)}>{t("common.cancel")}</button>
                          <button type="submit" className="btnPrimary" disabled={saving}>{t("platform.addAdmin")}</button>
                        </div>
                      </form>
                    )}
                    <p className={styles.privacy}>{t("platform.privacyNote")}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActionModal
        isOpen={!!statusTarget}
        type="confirm"
        title={statusTarget ? t(statusTarget.status === "suspended" ? "platform.reactivateTitle" : "platform.suspendTitle") : ""}
        message={statusTarget
          ? t(statusTarget.status === "suspended" ? "platform.reactivateMessage" : "platform.suspendMessage").replace("{name}", statusTarget.name)
          : ""}
        onConfirm={confirmStatus}
        onClose={() => setStatusTarget(null)}
      />
    </div>
  );
}
