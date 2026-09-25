import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { User, Wallet, CalendarOff, HandCoins, Clock, Play, Square, Plus, X, Download, ClipboardList, ShieldAlert, Check } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CollapsibleForm from "../../components/useful/CollapsibleForm";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";
import Pagination from "../../components/useful/Pagination";
import DateRangeFilter from "../../components/useful/DateRangeFilter";

import {
  getMyEmployeeProfile,
  getMyLeaveBalance,
  getMyPayslips,
  downloadMyPayslipPdf,
  getMyAbsences,
  requestMyAbsence,
  cancelMyAbsence,
  getMyAdvances,
  requestMyAdvance,
  getMyAttendance,
  getMyTeamRequests,
} from "../../services/meService";
import {
  clockIn,
  clockOut,
  getTodayAttendance,
} from "../../services/attendanceService";
import { reviewAbsence } from "../../services/absenceService";
import { reviewAdvance } from "../../services/advanceService";
import { getMyPerformanceReviews, acknowledgePerformanceReview } from "../../services/performanceReviewService";
import { getMyDisciplinaryActions, acknowledgeDisciplinaryAction } from "../../services/disciplinaryActionService";

import styles from "./MySpace.module.css";

const PAGE_SIZE = 10;

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

function formatTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatAmount(amount, currency = "MAD") {
  if (amount === undefined || amount === null) return "—";
  return `${Number(amount).toLocaleString("en-US")} ${currency}`;
}

const TABS = ["profile", "payslips", "absences", "advances", "attendance", "records"];

export default function MySpace() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  // Derived directly from the URL on every render — NOT stored in
  // its own useState. All five /me/* routes render this same
  // <MySpace> component, so navigating between them (e.g. clicking
  // "My Attendance" in the sidebar) re-renders this component
  // rather than remounting it. A useState initialized once at
  // mount would never pick up the new URL on a later render, which
  // is exactly why clicking a sidebar subitem used to leave the
  // view stuck on whichever tab was active when the page first
  // loaded. Deriving it fresh each render means there's only one
  // source of truth (the URL) and it can never drift out of sync.
  const activeTab = TABS.find((tab) => location.pathname.endsWith(`/${tab}`)) || "profile";

  const goToTab = (tab) => {
    navigate(tab === "profile" ? "/me" : `/me/${tab}`);
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("mySpace.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <User size={20} />
            <h1>{t("mySpace.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("mySpace.subtitle")}</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${activeTab === "profile" ? styles.tabActive : ""}`} onClick={() => goToTab("profile")}>
          <User size={14} /> {t("mySpace.tabs.profile")}
        </button>
        <button type="button" className={`${styles.tab} ${activeTab === "payslips" ? styles.tabActive : ""}`} onClick={() => goToTab("payslips")}>
          <Wallet size={14} /> {t("mySpace.tabs.payslips")}
        </button>
        <button type="button" className={`${styles.tab} ${activeTab === "absences" ? styles.tabActive : ""}`} onClick={() => goToTab("absences")}>
          <CalendarOff size={14} /> {t("mySpace.tabs.absences")}
        </button>
        <button type="button" className={`${styles.tab} ${activeTab === "advances" ? styles.tabActive : ""}`} onClick={() => goToTab("advances")}>
          <HandCoins size={14} /> {t("mySpace.tabs.advances")}
        </button>
        <button type="button" className={`${styles.tab} ${activeTab === "attendance" ? styles.tabActive : ""}`} onClick={() => goToTab("attendance")}>
          <Clock size={14} /> {t("mySpace.tabs.attendance")}
        </button>
        <button type="button" className={`${styles.tab} ${activeTab === "records" ? styles.tabActive : ""}`} onClick={() => goToTab("records")}>
          <ClipboardList size={14} /> {t("mySpace.tabs.records")}
        </button>
      </div>

      {activeTab === "profile" && <ProfileTab t={t} />}
      {activeTab === "payslips" && <PayslipsTab t={t} />}
      {activeTab === "absences" && <AbsencesTab t={t} />}
      {activeTab === "advances" && <AdvancesTab t={t} />}
      {activeTab === "attendance" && <AttendanceTab t={t} />}
      {activeTab === "records" && <RecordsTab t={t} />}
    </div>
  );
}

// ============================================================
// PROFILE TAB
// ============================================================

function ProfileTab({ t }) {
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(null);
  const [teamRequests, setTeamRequests] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, b, team] = await Promise.all([
          getMyEmployeeProfile(),
          getMyLeaveBalance(),
          getMyTeamRequests().catch(() => null),
        ]);
        setProfile(p);
        setBalance(b);
        setTeamRequests(team);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className={styles.loadingText}>{t("common.loading")}</p>;
  if (!profile) return null;

  return (
    <div className={styles.profileGrid}>
      <div className={styles.profileCard}>
        <div className={styles.profileAvatar}>
          {profile.photo?.url ? <img src={profile.photo.url} alt="" /> : <User size={28} />}
        </div>
        <div>
          <h2>{profile.firstName} {profile.lastName}</h2>
          <p>{profile.jobTitle || "—"}</p>
        </div>
      </div>

      <div className={styles.infoGrid}>
        <div><label>{t("employees.detail.department")}</label><span>{profile.department?.name || "—"}</span></div>
        <div><label>{t("employees.fields.hireDate")}</label><span>{formatDate(profile.hireDate)}</span></div>
        <div><label>{t("employees.detail.phone")}</label><span>{profile.phone || "—"}</span></div>
        <div><label>{t("employees.detail.email")}</label><span>{profile.workEmail || "—"}</span></div>
        <div><label>{t("employees.detail.employmentType")}</label><span>{t(`employees.employmentTypes.${profile.employmentType}`)}</span></div>
        <div><label>{t("employees.fields.workLocation")}</label><span>{profile.workLocation || "—"}</span></div>
      </div>

      {balance && (
        <div className={styles.balanceCard}>
          <h3>{t("mySpace.leaveBalance.title")}</h3>
          <div className={styles.balanceRow}>
            <div><span className={styles.balanceValue}>{balance.accruedDays}</span><label>{t("mySpace.leaveBalance.accrued")}</label></div>
            <div><span className={styles.balanceValue}>{balance.usedDays}</span><label>{t("mySpace.leaveBalance.used")}</label></div>
            <div><span className={styles.balanceValue}>{balance.remainingDays}</span><label>{t("mySpace.leaveBalance.remaining")}</label></div>
          </div>
        </div>
      )}

      {teamRequests && (teamRequests.absences.length > 0 || teamRequests.advances.length > 0) && (
        <div className={styles.teamCard}>
          <h3>{t("mySpace.teamRequests.title")}</h3>
          <TeamRequestsList t={t} teamRequests={teamRequests} setTeamRequests={setTeamRequests} />
        </div>
      )}
    </div>
  );
}

function TeamRequestsList({ t, teamRequests, setTeamRequests }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const handleReview = async (kind, id, status) => {
    setBusyId(id);
    setError("");
    try {
      if (kind === "absence") {
        await reviewAbsence(id, { status });
        setTeamRequests((prev) => ({ ...prev, absences: prev.absences.filter((a) => a._id !== id) }));
      } else {
        await reviewAdvance(id, { status });
        setTeamRequests((prev) => ({ ...prev, advances: prev.advances.filter((a) => a._id !== id) }));
      }
    } catch (err) {
      // Was only logged to the console, so a refused review (e.g. HR
      // must approve first) looked like the button did nothing.
      setError(err.response?.data?.message || t("mySpace.teamRequests.reviewFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const dayCount = (a) => {
    if (!a.startDate || !a.endDate) return null;
    return Math.round((new Date(a.endDate) - new Date(a.startDate)) / 86400000) + 1;
  };

  // Real text buttons (the table's square icon-button style made the
  // words overflow their box).
  const actions = (kind, id) => (
    <div className={styles.teamRowActions}>
      <button type="button" className={styles.teamAccept} disabled={busyId === id} onClick={() => handleReview(kind, id, "accepted")}>
        <Check size={14} /> {t(`${kind === "absence" ? "absences" : "advances"}.actions.accept`)}
      </button>
      <button type="button" className={styles.teamReject} disabled={busyId === id} onClick={() => handleReview(kind, id, "rejected")}>
        <X size={14} /> {t(`${kind === "absence" ? "absences" : "advances"}.actions.reject`)}
      </button>
    </div>
  );

  return (
    <div className={styles.teamList}>
      {error && <div className="errorMessage">{error}</div>}
      {teamRequests.absences.map((a) => (
        <div key={a._id} className={styles.teamRow}>
          <div className={styles.teamRowInfo}>
            <strong className={styles.teamRowName}>{a.employee?.firstName} {a.employee?.lastName}</strong>
            <span className={styles.teamRowMeta}>
              <span className={styles.teamRowType}>{t(`absences.types.${a.type}`)}</span>
              {formatDate(a.startDate)} → {formatDate(a.endDate)}
              {dayCount(a) && ` · ${t("mySpace.teamRequests.days").replace("{count}", dayCount(a))}`}
            </span>
          </div>
          {actions("absence", a._id)}
        </div>
      ))}
      {teamRequests.advances.map((a) => (
        <div key={a._id} className={styles.teamRow}>
          <div className={styles.teamRowInfo}>
            <strong className={styles.teamRowName}>{a.employee?.firstName} {a.employee?.lastName}</strong>
            <span className={styles.teamRowMeta}>
              <span className={styles.teamRowType}>{t("mySpace.teamRequests.advance")}</span>
              {formatAmount(a.amount, a.currency)}
            </span>
          </div>
          {actions("advance", a._id)}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// PAYSLIPS TAB
// ============================================================

function PayslipsTab({ t }) {
  const [payslips, setPayslips] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // Was previously declared AFTER the early "empty state" return
  // below — a Rules-of-Hooks violation, since that return meant
  // this useState call got skipped entirely whenever the employee
  // had zero payslips, changing the number of hooks called between
  // renders. React detects that and throws ("change in the order
  // of Hooks"). Every hook now runs unconditionally before any
  // early return, so the call order can never differ between renders.
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { payslips: data, pagination: p } = await getMyPayslips({ page, limit: PAGE_SIZE });
        if (cancelled) return;
        setPayslips(data);
        setPagination(p);
      } catch (error) {
        console.error("Failed to load payslips:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const handleDownload = async (payslip) => {
    setDownloadingId(payslip._id);
    try {
      const monthLabel = t(`payroll.months.${payslip.month - 1}`);
      const safeName = `Bulletin de paie - ${monthLabel} ${payslip.year}`
        .replace(/[/\\:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      await downloadMyPayslipPdf(payslip._id, `${safeName}.pdf`);
    } catch (error) {
      console.error("Failed to download payslip:", error);
    } finally {
      setDownloadingId(null);
    }
  };

  if (!loading && payslips.length === 0) {
    return (
      <div className="emptyStateBlock">
        <div className="emptyStateIcon"><Wallet size={28} /></div>
        <h2>{t("mySpace.payslips.emptyTitle")}</h2>
        <p>{t("mySpace.payslips.emptyMessage")}</p>
      </div>
    );
  }

  const gridColumns = "minmax(110px,1fr) minmax(90px,0.8fr) minmax(90px,0.8fr) minmax(90px,0.7fr) 60px";

  return (
    <>
      <div className="dataTable">
        <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
          <span>{t("payroll.table.period")}</span>
          <span>{t("payroll.table.gross")}</span>
          <span>{t("payroll.table.net")}</span>
          <span>{t("payroll.fields.status")}</span>
          <span />
        </div>
        {payslips.map((p) => (
          <div key={p._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
            <span>{t(`payroll.months.${p.month - 1}`)} {p.year}</span>
            <span className="dataTableCellMuted">{formatAmount(p.grossSalary, p.currency)}</span>
            <span className="dataTableCellMuted">{formatAmount(p.netSalary, p.currency)}</span>
            <StatusPill status={p.status === "paid" ? "accepted" : "pending"} label={t(`payroll.payslipStatus.${p.status}`)} />
            <div className="dataTableActions">
              <button
                type="button"
                className="tableActionBtn"
                title={t("payroll.actions.downloadPdf")}
                disabled={downloadingId === p._id}
                onClick={() => handleDownload(p)}
              >
                <Download size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
    </>
  );
}

// ============================================================
// ABSENCES TAB
// ============================================================

function AbsencesTab({ t }) {
  const [absences, setAbsences] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [pendingData, setPendingData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const reload = async (targetPage = page) => {
    const { absences: data, pagination: p } = await getMyAbsences({
      page: targetPage, limit: PAGE_SIZE, from: dateFrom || undefined, to: dateTo || undefined,
    });
    setAbsences(data);
    setPagination(p);
  };

  useEffect(() => { setPage(1); }, [dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { absences: data, pagination: p } = await getMyAbsences({
          page, limit: PAGE_SIZE, from: dateFrom || undefined, to: dateTo || undefined,
        });
        if (cancelled) return;
        setAbsences(data);
        setPagination(p);
      } catch (error) {
        console.error("Failed to load absences:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, dateFrom, dateTo]);

  const fields = [
    { name: "type", label: t("absences.fields.type"), type: "select", required: true, options: [
      { value: "paid_leave", label: t("absences.types.paid_leave") },
      { value: "unpaid_leave", label: t("absences.types.unpaid_leave") },
      { value: "sick_leave", label: t("absences.types.sick_leave") },
      { value: "other", label: t("absences.types.other") },
    ] },
    { name: "startDate", label: t("absences.fields.startDate"), type: "date", required: true },
    { name: "endDate", label: t("absences.fields.endDate"), type: "date", required: true },
    { name: "halfDay", label: t("absences.fields.halfDay"), type: "checkbox" },
    { name: "reason", label: t("absences.fields.reason"), type: "textarea", fullWidth: true },
  ];

  const buttons = [
    { label: t("common.cancel"), type: "button", variant: "secondary", onClick: () => setShowForm(false) },
    { label: t("absences.buttons.create"), type: "submit", variant: "primary" },
  ];

  const closeModal = () => { if (!actionLoading) { setModal((p) => ({ ...p, open: false })); setPendingData(null); } };

  const handleSubmit = (formData) => {
    setPendingData(formData);
    setModal({ open: true, type: "confirm", title: t("absences.createTitle"), message: t("absences.createSureMessage") });
  };

  const askCancel = (absence) => {
    setPendingData({ id: absence._id, cancel: true });
    setModal({ open: true, type: "confirm", title: t("mySpace.absences.cancelTitle"), message: t("mySpace.absences.cancelSureMessage") });
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      if (pendingData.cancel) {
        await cancelMyAbsence(pendingData.id);
        setAbsences((prev) => prev.filter((a) => a._id !== pendingData.id));
        setModal((p) => ({ ...p, open: false }));
      } else {
        await requestMyAbsence(pendingData);
        setShowForm(false);
        setPage(1);
        await reload(1);
        setModal({ open: true, type: "success", title: t("absences.createSuccessTitle"), message: t("absences.createSuccessMessage") });
      }
      setPendingData(null);
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("absences.errors.actionFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  const gridColumns = "minmax(100px,0.8fr) minmax(140px,1.1fr) minmax(70px,0.5fr) minmax(90px,0.7fr) 1fr";

  return (
    <>
      <div className={styles.tabToolbar}>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          fromLabel={t("common.dateFrom")}
          toLabel={t("common.dateTo")}
        />

        <button type="button" className="btnPrimary" onClick={() => setShowForm((p) => !p)}>
          <Plus size={16} /> {t("absences.addAbsence")}
        </button>
      </div>

      {showForm && (
        <CollapsibleForm title={t("absences.addAbsence")} icon={<CalendarOff size={16} />} fields={fields} buttons={buttons} onSubmit={handleSubmit} defaultOpen />
      )}

      {!loading && absences.length === 0 ? (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><CalendarOff size={28} /></div>
          <h2>{t("absences.emptyTitle")}</h2>
          <p>{t("absences.emptyMessage")}</p>
        </div>
      ) : (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("absences.fields.type")}</span>
              <span>{t("absences.table.period")}</span>
              <span>{t("absences.table.days")}</span>
              <span>{t("absences.fields.status")}</span>
              <span />
            </div>
            {absences.map((a) => (
              <div key={a._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span className="dataTableCellMuted">{t(`absences.types.${a.type}`)}</span>
                <span className="dataTableCellMuted">{formatDate(a.startDate)} — {formatDate(a.endDate)}</span>
                <span className="dataTableCellMuted">{a.daysCount ?? "—"}</span>
                <StatusPill status={a.status} label={t(`absences.status.${a.status}`)} />
                <div className="dataTableActions">
                  {["pending", "manager_approved"].includes(a.status) && (
                    <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.cancel")} onClick={() => askCancel(a)}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}

      <ActionModal isOpen={modal.open} type={modal.type} title={modal.title} message={modal.message} loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirm : undefined} onClose={closeModal} />
    </>
  );
}

// ============================================================
// ADVANCES TAB
// ============================================================

function AdvancesTab({ t }) {
  const [advances, setAdvances] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [pendingData, setPendingData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const reload = async (targetPage = page) => {
    const { advances: data, pagination: p } = await getMyAdvances({ page: targetPage, limit: PAGE_SIZE });
    setAdvances(data);
    setPagination(p);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { advances: data, pagination: p } = await getMyAdvances({ page, limit: PAGE_SIZE });
        if (cancelled) return;
        setAdvances(data);
        setPagination(p);
      } catch (error) {
        console.error("Failed to load advances:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const fields = [
    { name: "amount", label: t("advances.fields.amount"), type: "number", required: true, placeholder: "0" },
    { name: "reason", label: t("advances.fields.reason"), type: "textarea", fullWidth: true },
  ];

  const buttons = [
    { label: t("common.cancel"), type: "button", variant: "secondary", onClick: () => setShowForm(false) },
    { label: t("advances.buttons.create"), type: "submit", variant: "primary" },
  ];

  const closeModal = () => { if (!actionLoading) { setModal((p) => ({ ...p, open: false })); setPendingData(null); } };

  const handleSubmit = (formData) => {
    setPendingData(formData);
    setModal({ open: true, type: "confirm", title: t("advances.createTitle"), message: t("advances.createSureMessage") });
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      await requestMyAdvance(pendingData);
      setShowForm(false);
      setPage(1);
      await reload(1);
      setModal({ open: true, type: "success", title: t("advances.createSuccessTitle"), message: t("advances.createSuccessMessage") });
      setPendingData(null);
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("advances.errors.actionFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  const gridColumns = "minmax(100px,0.8fr) minmax(110px,0.9fr) minmax(90px,0.7fr) 1fr";

  return (
    <>
      <div className={styles.tabActions}>
        <button type="button" className="btnPrimary" onClick={() => setShowForm((p) => !p)}>
          <Plus size={16} /> {t("advances.addAdvance")}
        </button>
      </div>

      {showForm && (
        <CollapsibleForm title={t("advances.addAdvance")} icon={<HandCoins size={16} />} fields={fields} buttons={buttons} onSubmit={handleSubmit} defaultOpen />
      )}

      {!loading && advances.length === 0 ? (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><HandCoins size={28} /></div>
          <h2>{t("advances.emptyTitle")}</h2>
          <p>{t("advances.emptyMessage")}</p>
        </div>
      ) : (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("advances.fields.amount")}</span>
              <span>{t("advances.fields.requestDate")}</span>
              <span>{t("advances.fields.status")}</span>
              <span />
            </div>
            {advances.map((a) => (
              <div key={a._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span>{formatAmount(a.amount, a.currency)}</span>
                <span className="dataTableCellMuted">{formatDate(a.requestDate)}</span>
                <StatusPill status={a.status} label={t(`advances.status.${a.status}`)} />
                <span />
              </div>
            ))}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}

      <ActionModal isOpen={modal.open} type={modal.type} title={modal.title} message={modal.message} loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirm : undefined} onClose={closeModal} />
    </>
  );
}

// ============================================================
// ATTENDANCE TAB
// ============================================================

// Minutes-since-midnight -> "HH:MM"
const minutesToHHMM = (mins) =>
  mins === null || mins === undefined ? "—" : `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

function AttendanceTab({ t }) {
  const [today, setToday] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [nextPunch, setNextPunch] = useState("clockIn");
  const [actionError, setActionError] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async (from = dateFrom, to = dateTo) => {
    const [todayData, records] = await Promise.all([
      getTodayAttendance(),
      getMyAttendance({ from: from || undefined, to: to || undefined }),
    ]);
    setToday(todayData.record);
    setTodaySchedule(todayData.schedule);
    setNextPunch(todayData.nextPunch);
    setHistory(records);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load(dateFrom, dateTo);
      } catch (error) {
        console.error("Failed to load attendance:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [dateFrom, dateTo]);

  // One handler for every punch. On a split day the server decides
  // whether a "clock in" is the morning or the after-lunch one (and
  // likewise for clock-outs); we just send the direction.
  const handlePunch = async (direction) => {
    setActionLoading(true);
    setActionError("");
    try {
      if (direction === "in") await clockIn();
      else await clockOut();
      await load();
    } catch (error) {
      // Previously only logged to the console, so a refused punch
      // looked like the button simply did nothing.
      setActionError(error.response?.data?.message || t("mySpace.attendance.punchFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const PUNCH_BUTTON = {
    clockIn: { direction: "in", label: t("mySpace.attendance.clockIn"), icon: <Play size={15} />, className: "btnPrimary" },
    breakOut: { direction: "out", label: t("mySpace.attendance.clockOutLunch"), icon: <Square size={15} />, className: "btnEdit" },
    breakIn: { direction: "in", label: t("mySpace.attendance.clockInAfternoon"), icon: <Play size={15} />, className: "btnPrimary" },
    clockOut: { direction: "out", label: t("mySpace.attendance.clockOut"), icon: <Square size={15} />, className: "btnDelete" },
  };
  const button = nextPunch ? PUNCH_BUTTON[nextPunch] : null;
  const isSplit = !!todaySchedule?.split;

  const scheduleText = !todaySchedule
    ? ""
    : !todaySchedule.isWorkingDay
      ? t("mySpace.attendance.restDay")
      : isSplit
        ? `${minutesToHHMM(todaySchedule.start)}–${minutesToHHMM(todaySchedule.breakStart)} / ${minutesToHHMM(todaySchedule.breakEnd)}–${minutesToHHMM(todaySchedule.end)}`
        : `${minutesToHHMM(todaySchedule.start)}–${minutesToHHMM(todaySchedule.end)}`;

  if (loading) return <p className={styles.loadingText}>{t("common.loading")}</p>;

  const gridColumns = "minmax(90px,0.8fr) minmax(70px,0.6fr) minmax(70px,0.6fr) minmax(90px,0.7fr)";

  return (
    <>
      <div className={styles.clockCard}>
        <div>
          <span className={styles.clockLabel}>
            {t("mySpace.attendance.todayStatus")}
            {scheduleText && <span className={styles.clockSchedule}> · {t("mySpace.attendance.scheduleToday")}: {scheduleText}</span>}
          </span>
          {todaySchedule?.holiday && (
            <span className={styles.clockHoliday}>
              {t("mySpace.attendance.holidayToday").replace("{name}", todaySchedule.holiday.name)}
              {todaySchedule.holiday.payRate === 2 && ` · ${t("mySpace.attendance.holidayDouble")}`}
            </span>
          )}
          {isSplit ? (
            <span className={styles.clockTimes}>
              {t("mySpace.attendance.morning")}: {formatTime(today?.clockIn)} → {formatTime(today?.breakOut)}
              {" · "}
              {t("mySpace.attendance.afternoon")}: {formatTime(today?.breakIn)} → {formatTime(today?.clockOut)}
            </span>
          ) : (
            <span className={styles.clockTimes}>
              {t("attendance.fields.clockIn")}: {formatTime(today?.clockIn)} · {t("attendance.fields.clockOut")}: {formatTime(today?.clockOut)}
            </span>
          )}
          {actionError && <span className={styles.clockError}>{actionError}</span>}
        </div>
        <div className={styles.clockActions}>
          {button ? (
            <button type="button" className={button.className} disabled={actionLoading} onClick={() => handlePunch(button.direction)}>
              {button.icon} {button.label}
            </button>
          ) : (
            <span className={styles.clockDone}>{t("mySpace.attendance.dayComplete")}</span>
          )}
        </div>
      </div>

      <div className={styles.tabToolbar}>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          fromLabel={t("common.dateFrom")}
          toLabel={t("common.dateTo")}
        />
      </div>

      {history.length === 0 ? (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Clock size={28} /></div>
          <h2>{t("attendance.emptyTitle")}</h2>
          <p>{t("attendance.emptyMessage")}</p>
        </div>
      ) : (
        <div className="dataTable">
          <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
            <span>{t("attendance.fields.date")}</span>
            <span>{t("attendance.fields.clockIn")}</span>
            <span>{t("attendance.fields.clockOut")}</span>
            <span>{t("absences.fields.status")}</span>
          </div>
          {history.map((r) => (
            <div key={r._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
              <span>{formatDate(r.date)}</span>
              <span className="dataTableCellMuted">{formatTime(r.clockIn)}</span>
              <span className="dataTableCellMuted">{formatTime(r.clockOut)}</span>
              <StatusPill status={r.status === "late" ? "pending" : r.status === "absent" ? "rejected" : "accepted"} label={t(`attendance.status.${r.status}`)} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// RECORDS TAB (performance reviews + disciplinary actions)
// ============================================================
// Both are read-mostly, occasional-view content compared to
// payslips/absences/advances, so they share one tab rather than
// each getting their own — keeps the tab bar from growing forever
// as more HR record types get added later.

function RecordsTab({ t }) {
  const [reviews, setReviews] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ackTarget, setAckTarget] = useState(null); // { kind: 'review'|'discipline', id }
  const [ackLoading, setAckLoading] = useState(false);

  const load = async () => {
    const [reviewData, actionData] = await Promise.all([
      getMyPerformanceReviews(),
      getMyDisciplinaryActions(),
    ]);
    setReviews(reviewData || []);
    setActions(actionData || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [reviewData, actionData] = await Promise.all([
          getMyPerformanceReviews(),
          getMyDisciplinaryActions(),
        ]);
        if (cancelled) return;
        setReviews(reviewData || []);
        setActions(actionData || []);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load records:", err);
        setError(err.response?.data?.message || t("mySpace.records.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAck = (kind, id) => setAckTarget({ kind, id });
  const closeAck = () => setAckTarget(null);

  const handleConfirmAck = async () => {
    if (!ackTarget) return;
    setAckLoading(true);
    try {
      if (ackTarget.kind === "review") await acknowledgePerformanceReview(ackTarget.id);
      else await acknowledgeDisciplinaryAction(ackTarget.id);
      closeAck();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("mySpace.records.acknowledgeError"));
    } finally {
      setAckLoading(false);
    }
  };

  const reviewerName = (r) => `${r?.reviewer?.firstName || ""} ${r?.reviewer?.lastName || ""}`.trim() || "—";
  const issuerName = (a) => `${a?.issuedBy?.firstName || ""} ${a?.issuedBy?.lastName || ""}`.trim() || "—";

  if (loading) return <p className={styles.loadingText}>{t("common.loading")}</p>;

  return (
    <>
      {error && <div className="errorMessage">{error}</div>}

      <div className={styles.recordsSection}>
        <h3 className={styles.recordsSectionTitle}>
          <ClipboardList size={16} /> {t("mySpace.records.performanceReviews")}
        </h3>

        {reviews.length === 0 ? (
          <p className={styles.emptyText}>{t("mySpace.records.noReviews")}</p>
        ) : (
          <div className={styles.recordsList}>
            {reviews.map((review) => (
              <div key={review._id} className={styles.recordCard}>
                <div className={styles.recordCardHeader}>
                  <div>
                    <span className={styles.recordTitle}>{review.periodLabel}</span>
                    <span className={styles.recordMeta}>
                      {t("mySpace.records.reviewedBy")} {reviewerName(review)} — {formatDate(review.reviewDate)}
                    </span>
                  </div>
                  <StatusPill
                    status={review.status === "acknowledged" ? "accepted" : "pending"}
                    label={t(`performanceReviews.statuses.${review.status}`)}
                  />
                </div>

                {review.strengths && (
                  <p className={styles.recordField}><strong>{t("performanceReviews.fields.strengths")}:</strong> {review.strengths}</p>
                )}
                {review.areasForImprovement && (
                  <p className={styles.recordField}><strong>{t("performanceReviews.fields.areasForImprovement")}:</strong> {review.areasForImprovement}</p>
                )}
                {review.comments && (
                  <p className={styles.recordField}><strong>{t("performanceReviews.fields.comments")}:</strong> {review.comments}</p>
                )}
                {Array.isArray(review.goals) && review.goals.length > 0 && (
                  <div className={styles.recordField}>
                    <strong>{t("performanceReviews.fields.goals")}:</strong>
                    <ul className={styles.goalsList}>
                      {review.goals.map((goal) => (
                        <li key={goal._id || goal.description}>{goal.description}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.status === "submitted" && (
                  <div className={styles.recordActions}>
                    <button type="button" className="btnPrimary" onClick={() => openAck("review", review._id)}>
                      {t("mySpace.records.acknowledge")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.recordsSection}>
        <h3 className={styles.recordsSectionTitle}>
          <ShieldAlert size={16} /> {t("mySpace.records.disciplinaryActions")}
        </h3>

        {actions.length === 0 ? (
          <p className={styles.emptyText}>{t("mySpace.records.noDisciplinaryActions")}</p>
        ) : (
          <div className={styles.recordsList}>
            {actions.map((action) => (
              <div key={action._id} className={styles.recordCard}>
                <div className={styles.recordCardHeader}>
                  <div>
                    <span className={styles.recordTitle}>{t(`disciplinaryActions.types.${action.type}`)}</span>
                    <span className={styles.recordMeta}>
                      {issuerName(action)} — {formatDate(action.date)}
                    </span>
                  </div>
                  <StatusPill
                    status={action.acknowledgedByEmployee ? "accepted" : "pending"}
                    label={action.acknowledgedByEmployee ? t("disciplinaryActions.acknowledged") : t("disciplinaryActions.notAcknowledged")}
                  />
                </div>

                <p className={styles.recordField}>{action.reason}</p>
                {action.description && <p className={styles.recordField}>{action.description}</p>}

                {!action.acknowledgedByEmployee && (
                  <div className={styles.recordActions}>
                    <button type="button" className="btnPrimary" onClick={() => openAck("discipline", action._id)}>
                      {t("mySpace.records.acknowledge")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ActionModal
        isOpen={!!ackTarget}
        type="confirm"
        title={t("mySpace.records.acknowledgeTitle")}
        message={ackTarget?.kind === "review" ? t("mySpace.records.acknowledgeReviewMessage") : t("mySpace.records.acknowledgeDisciplineMessage")}
        loading={ackLoading}
        onConfirm={handleConfirmAck}
        onClose={closeAck}
      />
    </>
  );
}
