import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  User,
  Wallet,
  CalendarOff,
  HandCoins,
  Clock,
  Play,
  Square,
  Plus,
  X,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CollapsibleForm from "../../components/useful/CollapsibleForm";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";
import Pagination from "../../components/useful/Pagination";

import {
  getMyEmployeeProfile,
  getMyLeaveBalance,
  getMyPayslips,
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

const TABS = ["profile", "payslips", "absences", "advances", "attendance"];

export default function MySpace() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const initialTab = TABS.find((tab) => location.pathname.endsWith(`/${tab}`)) || "profile";
  const [activeTab, setActiveTab] = useState(initialTab);

  const goToTab = (tab) => {
    setActiveTab(tab);
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
      </div>

      {activeTab === "profile" && <ProfileTab t={t} />}
      {activeTab === "payslips" && <PayslipsTab t={t} />}
      {activeTab === "absences" && <AbsencesTab t={t} />}
      {activeTab === "advances" && <AdvancesTab t={t} />}
      {activeTab === "attendance" && <AttendanceTab t={t} />}
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
        <div><label>{t("employees.detail.department")}</label><span>{profile.department || "—"}</span></div>
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
  const handleReview = async (kind, id, status) => {
    try {
      if (kind === "absence") {
        await reviewAbsence(id, { status });
        setTeamRequests((prev) => ({ ...prev, absences: prev.absences.filter((a) => a._id !== id) }));
      } else {
        await reviewAdvance(id, { status });
        setTeamRequests((prev) => ({ ...prev, advances: prev.advances.filter((a) => a._id !== id) }));
      }
    } catch (error) {
      console.error("Failed to review team request:", error);
    }
  };

  return (
    <div className={styles.teamList}>
      {teamRequests.absences.map((a) => (
        <div key={a._id} className={styles.teamRow}>
          <span>{a.employee?.firstName} {a.employee?.lastName} — {t(`absences.types.${a.type}`)} ({formatDate(a.startDate)} - {formatDate(a.endDate)})</span>
          <div className={styles.teamRowActions}>
            <button type="button" className="tableActionBtn tableActionBtnAccept" onClick={() => handleReview("absence", a._id, "accepted")}>{t("absences.actions.accept")}</button>
            <button type="button" className="tableActionBtn tableActionBtnReject" onClick={() => handleReview("absence", a._id, "rejected")}>{t("absences.actions.reject")}</button>
          </div>
        </div>
      ))}
      {teamRequests.advances.map((a) => (
        <div key={a._id} className={styles.teamRow}>
          <span>{a.employee?.firstName} {a.employee?.lastName} — {formatAmount(a.amount, a.currency)}</span>
          <div className={styles.teamRowActions}>
            <button type="button" className="tableActionBtn tableActionBtnAccept" onClick={() => handleReview("advance", a._id, "accepted")}>{t("advances.actions.accept")}</button>
            <button type="button" className="tableActionBtn tableActionBtnReject" onClick={() => handleReview("advance", a._id, "rejected")}>{t("advances.actions.reject")}</button>
          </div>
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

  if (!loading && payslips.length === 0) {
    return (
      <div className="emptyStateBlock">
        <div className="emptyStateIcon"><Wallet size={28} /></div>
        <h2>{t("mySpace.payslips.emptyTitle")}</h2>
        <p>{t("mySpace.payslips.emptyMessage")}</p>
      </div>
    );
  }

  const gridColumns = "minmax(110px,1fr) minmax(90px,0.8fr) minmax(90px,0.8fr) minmax(90px,0.7fr)";

  return (
    <>
      <div className="dataTable">
        <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
          <span>{t("payroll.table.period")}</span>
          <span>{t("payroll.table.gross")}</span>
          <span>{t("payroll.table.net")}</span>
          <span>{t("payroll.fields.status")}</span>
        </div>
        {payslips.map((p) => (
          <div key={p._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
            <span>{t(`payroll.months.${p.month - 1}`)} {p.year}</span>
            <span className="dataTableCellMuted">{formatAmount(p.grossSalary, p.currency)}</span>
            <span className="dataTableCellMuted">{formatAmount(p.netSalary, p.currency)}</span>
            <StatusPill status={p.status === "paid" ? "accepted" : "pending"} label={t(`payroll.payslipStatus.${p.status}`)} />
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

  const reload = async (targetPage = page) => {
    const { absences: data, pagination: p } = await getMyAbsences({ page: targetPage, limit: PAGE_SIZE });
    setAbsences(data);
    setPagination(p);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { absences: data, pagination: p } = await getMyAbsences({ page, limit: PAGE_SIZE });
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
  }, [page]);

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
      <div className={styles.tabActions}>
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
                  {a.status === "pending" && (
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

function AttendanceTab({ t }) {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    const [todayRecord, records] = await Promise.all([
      getTodayAttendance(),
      getMyAttendance({}),
    ]);
    setToday(todayRecord);
    setHistory(records);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (error) {
        console.error("Failed to load attendance:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      await clockIn();
      await load();
    } catch (error) {
      console.error("Clock-in failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      await clockOut();
      await load();
    } catch (error) {
      console.error("Clock-out failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className={styles.loadingText}>{t("common.loading")}</p>;

  const gridColumns = "minmax(90px,0.8fr) minmax(70px,0.6fr) minmax(70px,0.6fr) minmax(90px,0.7fr)";

  return (
    <>
      <div className={styles.clockCard}>
        <div>
          <span className={styles.clockLabel}>{t("mySpace.attendance.todayStatus")}</span>
          <span className={styles.clockTimes}>
            {t("attendance.fields.clockIn")}: {formatTime(today?.clockIn)} · {t("attendance.fields.clockOut")}: {formatTime(today?.clockOut)}
          </span>
        </div>
        <div className={styles.clockActions}>
          {!today?.clockIn && (
            <button type="button" className="btnPrimary" disabled={actionLoading} onClick={handleClockIn}>
              <Play size={15} /> {t("mySpace.attendance.clockIn")}
            </button>
          )}
          {today?.clockIn && !today?.clockOut && (
            <button type="button" className="btnDelete" disabled={actionLoading} onClick={handleClockOut}>
              <Square size={15} /> {t("mySpace.attendance.clockOut")}
            </button>
          )}
        </div>
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
