import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Plus,
  Eye,
  CheckCircle2,
  Trash2,
  RefreshCw,
  X,
  BriefcaseBusiness,
  Download,
  FileDown,
} from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CollapsibleForm from "../../components/useful/CollapsibleForm";
import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import SearchBar from "../../components/useful/SearchBar";
import ActionModal from "../../components/useful/ActionModal";
import StatusPill from "../../components/useful/StatusPill";

import {
  getPayrollRuns,
  createPayrollRun,
  regeneratePayrollRun,
  completePayrollRun,
  deletePayrollRun,
  getPayrollRunById,
  markPayslipPaid,
  downloadPayslipPdf,
  downloadPayrollExport,
} from "../../services/payrollService";
import { getCompanies } from "../../services/companyService";

import styles from "./Payroll.module.css";

const RUNS_PAGE_SIZE = 12;

function employeeName(employee) {
  if (!employee) return "—";
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

function formatAmount(amount, currency = "MAD") {
  if (amount === undefined || amount === null) return "—";
  return `${Number(amount).toLocaleString("en-US")} ${currency}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function Payroll() {
  const { t } = useI18n();

  // ---------- Companies ----------
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setCompaniesLoading(true);
        const data = await getCompanies();
        const list = Array.isArray(data) ? data : [];
        setCompanies(list);
        if (!selectedCompanyId && list.length > 0) {
          setSelectedCompanyId(list[0]._id);
        }
      } catch (error) {
        console.error("Failed to load companies:", error);
      } finally {
        setCompaniesLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((c) => ({
    value: c._id,
    label: c.name || c.tradeName || t("employees.company.unnamed"),
  }));

  // ---------- Runs list ----------
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: RUNS_PAGE_SIZE, pages: 1 });

  const reloadRuns = async (targetPage = page) => {
    if (!selectedCompanyId) return;
    const { runs: data, pagination: p } = await getPayrollRuns({
      companyId: selectedCompanyId,
      page: targetPage,
      limit: RUNS_PAGE_SIZE,
    });
    setRuns(data);
    setPagination(p);
  };

  useEffect(() => {
    if (!selectedCompanyId) {
      setRuns([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { runs: data, pagination: p } = await getPayrollRuns({
          companyId: selectedCompanyId,
          page,
          limit: RUNS_PAGE_SIZE,
        });
        if (cancelled) return;
        setRuns(data);
        setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("payroll.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, page, t]);

  // ---------- Create run form ----------
  const [showCreateForm, setShowCreateForm] = useState(false);

  const now = new Date();
  const monthOptions = MONTH_NAMES.map((label, index) => ({
    value: String(index + 1),
    label: t(`payroll.months.${index}`) || label,
  }));

  const runFields = [
    { name: "month", label: t("payroll.fields.month"), type: "select", options: monthOptions, required: true },
    { name: "year", label: t("payroll.fields.year"), type: "number", required: true, placeholder: String(now.getFullYear()) },
  ];

  const runButtons = [
    { label: t("common.cancel"), type: "button", variant: "secondary", onClick: () => setShowCreateForm(false) },
    { label: t("payroll.buttons.generate"), type: "submit", variant: "primary" },
  ];

  // ---------- Modal ----------
  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [modalAction, setModalAction] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const closeModal = () => {
    if (actionLoading) return;
    setModal((p) => ({ ...p, open: false }));
    setModalAction(null);
    setPendingData(null);
  };

  const handleSubmitCreate = (formData) => {
    setPendingData({ month: Number(formData.month), year: Number(formData.year) });
    setModalAction("create");
    setModal({ open: true, type: "confirm", title: t("payroll.createTitle"), message: t("payroll.createSureMessage") });
  };

  const askComplete = (run) => {
    setPendingData({ id: run._id });
    setModalAction("complete");
    setModal({ open: true, type: "confirm", title: t("payroll.completeTitle"), message: t("payroll.completeSureMessage") });
  };

  const askDelete = (run) => {
    setPendingData({ id: run._id });
    setModalAction("delete");
    setModal({ open: true, type: "confirm", title: t("payroll.deleteTitle"), message: t("payroll.deleteSureMessage") });
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      if (modalAction === "create") {
        await createPayrollRun({ company: selectedCompanyId, month: pendingData.month, year: pendingData.year });
        setShowCreateForm(false);
        setPage(1);
        await reloadRuns(1);
        setModal({ open: true, type: "success", title: t("payroll.createSuccessTitle"), message: t("payroll.createSuccessMessage") });
      } else if (modalAction === "complete") {
        const updated = await completePayrollRun(pendingData.id);
        setRuns((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
        if (activeRun && activeRun.run._id === updated._id) {
          setActiveRun((prev) => ({ ...prev, run: updated }));
        }
        setModal((p) => ({ ...p, open: false }));
        setModalAction(null);
        setPendingData(null);
      } else if (modalAction === "delete") {
        await deletePayrollRun(pendingData.id);
        setRuns((prev) => prev.filter((r) => r._id !== pendingData.id));
        if (activeRun && activeRun.run._id === pendingData.id) setActiveRun(null);
        setModal((p) => ({ ...p, open: false }));
        setModalAction(null);
        setPendingData(null);
      }
    } catch (error) {
      setModal({
        open: true,
        type: "error",
        title: t("common.fail"),
        message: error.response?.data?.message || t("payroll.errors.actionFailed"),
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ---------- Run detail (payslips) ----------
  const [activeRun, setActiveRun] = useState(null); // { run, payslips }

  // Payslips are already fully loaded per run (not server-paginated),
  // so filtering by employee name/number happens client-side here —
  // no extra request needed.
  const [payslipSearch, setPayslipSearch] = useState("");
  const filteredPayslips = useMemo(() => {
    const term = payslipSearch.trim().toLowerCase();
    if (!term || !activeRun) return activeRun?.payslips || [];
    return activeRun.payslips.filter((p) => {
      const emp = p.employee;
      return (
        employeeName(emp).toLowerCase().includes(term) ||
        (emp?.employeeNumber || "").toLowerCase().includes(term)
      );
    });
  }, [payslipSearch, activeRun]);
  const [runDetailLoading, setRunDetailLoading] = useState(false);

  const openRun = async (run) => {
    setRunDetailLoading(true);
    setPayslipSearch("");
    try {
      const data = await getPayrollRunById(run._id);
      setActiveRun(data);
    } catch (error) {
      console.error("Failed to load payroll run:", error);
    } finally {
      setRunDetailLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activeRun) return;
    setRunDetailLoading(true);
    try {
      await regeneratePayrollRun(activeRun.run._id);
      const data = await getPayrollRunById(activeRun.run._id);
      setActiveRun(data);
      await reloadRuns();
    } catch (error) {
      console.error("Failed to regenerate run:", error);
    } finally {
      setRunDetailLoading(false);
    }
  };

  const handleMarkPaid = async (payslipId) => {
    try {
      const updated = await markPayslipPaid(payslipId);
      setActiveRun((prev) => ({
        ...prev,
        payslips: prev.payslips.map((p) => (p._id === updated._id ? { ...p, ...updated } : p)),
      }));
    } catch (error) {
      console.error("Failed to mark payslip paid:", error);
    }
  };

  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadPayslip = async (payslip) => {
    setDownloadingId(payslip._id);
    try {
      const employeeName = `${payslip.employee?.firstName || ""} ${payslip.employee?.lastName || ""}`.trim();
      const monthLabel = t(`payroll.months.${payslip.month - 1}`) || MONTH_NAMES[payslip.month - 1] || "";
      const safeName = ["Bulletin de paie", employeeName, monthLabel && payslip.year ? `${monthLabel} ${payslip.year}` : payslip.year]
        .filter(Boolean)
        .join(" - ")
        .replace(/[/\\:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      await downloadPayslipPdf(payslip._id, `${safeName}.pdf`);
    } catch (error) {
      console.error("Failed to download payslip:", error);
    } finally {
      setDownloadingId(null);
    }
  };

  const [exportingType, setExportingType] = useState(null);

  const handleExport = async (type) => {
    if (!activeRun) return;
    setExportingType(type);
    try {
      const { run } = activeRun;
      await downloadPayrollExport(run._id, type, `${type}-${run.month}-${run.year}.csv`);
    } catch (error) {
      console.error(`Failed to export ${type}:`, error);
    } finally {
      setExportingType(null);
    }
  };

  const gridColumns = "minmax(140px,1.3fr) minmax(90px,0.7fr) minmax(90px,0.7fr) minmax(90px,0.7fr) minmax(90px,0.6fr) 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("payroll.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("payroll.breadcrumbs.payroll") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Wallet size={20} />
            <h1>{t("payroll.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("payroll.subtitle")}</p>
        </div>

        {selectedCompanyId && (
          <div className="pageHeaderActions">
            <button type="button" className="btnPrimary" onClick={() => setShowCreateForm((p) => !p)}>
              <Plus size={16} />
              {t("payroll.generateRun")}
            </button>
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect
            value={selectedCompanyId}
            onSelect={setSelectedCompanyId}
            options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading}
          />
        </div>
      </div>

      {showCreateForm && selectedCompanyId && (
        <CollapsibleForm
          title={t("payroll.generateRun")}
          icon={<Wallet size={16} />}
          fields={runFields}
          buttons={runButtons}
          onSubmit={handleSubmitCreate}
          defaultOpen
        />
      )}

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {selectedCompanyId && !loading && runs.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Wallet size={28} /></div>
          <h2>{t("payroll.emptyTitle")}</h2>
          <p>{t("payroll.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && runs.length > 0 && (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("payroll.table.period")}</span>
              <span>{t("payroll.table.employees")}</span>
              <span>{t("payroll.table.gross")}</span>
              <span>{t("payroll.table.net")}</span>
              <span>{t("payroll.fields.status")}</span>
              <span />
            </div>

            {runs.map((run) => (
              <div key={run._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span>{t(`payroll.months.${run.month - 1}`)} {run.year}</span>
                <span className="dataTableCellMuted">{run.employeeCount}</span>
                <span className="dataTableCellMuted">{formatAmount(run.totalGross)}</span>
                <span className="dataTableCellMuted">{formatAmount(run.totalNet)}</span>
                <StatusPill
                  status={run.status === "completed" ? "accepted" : run.status === "voided" ? "rejected" : "pending"}
                  label={t(`payroll.status.${run.status}`)}
                />
                <div className="dataTableActions">
                  <button type="button" className="tableActionBtn" title={t("payroll.actions.view")} onClick={() => openRun(run)}>
                    <Eye size={15} />
                  </button>
                  {run.status === "draft" && (
                    <>
                      <button type="button" className="tableActionBtn tableActionBtnAccept" title={t("payroll.actions.complete")} onClick={() => askComplete(run)}>
                        <CheckCircle2 size={15} />
                      </button>
                      <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDelete(run)}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}

      {/* ---------- Run detail panel ---------- */}
      {activeRun && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <h2>{t(`payroll.months.${activeRun.run.month - 1}`)} {activeRun.run.year}</h2>
            <div className={styles.detailHeaderActions}>
              <button
                type="button"
                className="btnEdit"
                disabled={exportingType === "cnss"}
                onClick={() => handleExport("cnss")}
                title={t("payroll.exports.cnssHint")}
              >
                <FileDown size={14} />
                {t("payroll.exports.cnss")}
              </button>
              <button
                type="button"
                className="btnEdit"
                disabled={exportingType === "register"}
                onClick={() => handleExport("register")}
              >
                <FileDown size={14} />
                {t("payroll.exports.register")}
              </button>
              <button
                type="button"
                className="btnEdit"
                disabled={exportingType === "bank-transfer"}
                onClick={() => handleExport("bank-transfer")}
              >
                <FileDown size={14} />
                {t("payroll.exports.bankTransfer")}
              </button>
              {activeRun.run.status === "draft" && (
                <button type="button" className="btnEdit" onClick={handleRegenerate}>
                  <RefreshCw size={14} />
                  {t("payroll.actions.regenerate")}
                </button>
              )}
              <button type="button" className="tableActionBtn" onClick={() => setActiveRun(null)} title={t("common.close")}>
                <X size={16} />
              </button>
            </div>
          </div>

          {runDetailLoading && <p className={styles.loadingText}>{t("common.loading")}</p>}

          {!runDetailLoading && activeRun.payslips.length === 0 && (
            <p className={styles.loadingText}>{t("payroll.noPayslips")}</p>
          )}

          {!runDetailLoading && activeRun.payslips.length > 0 && (
            <>
              <div className={styles.payslipSearchWrapper}>
                <SearchBar
                  placeholder={t("payroll.table.searchPlaceholder")}
                  onSearch={setPayslipSearch}
                  onClear={() => setPayslipSearch("")}
                />
              </div>

              <div className="dataTable">
                <div className="dataTableHead" style={{ gridTemplateColumns: "minmax(140px,1.3fr) minmax(90px,0.8fr) minmax(90px,0.8fr) minmax(90px,0.7fr) 1fr" }}>
                  <span>{t("salaries.fields.employee")}</span>
                  <span>{t("payroll.table.gross")}</span>
                  <span>{t("payroll.table.net")}</span>
                  <span>{t("payroll.fields.status")}</span>
                  <span />
                </div>

                {filteredPayslips.map((p) => (
                  <div key={p._id} className="dataTableRow" style={{ gridTemplateColumns: "minmax(140px,1.3fr) minmax(90px,0.8fr) minmax(90px,0.8fr) minmax(90px,0.7fr) 1fr" }}>
                    <span>{employeeName(p.employee)}</span>
                    <span className="dataTableCellMuted">{formatAmount(p.grossSalary, p.currency)}</span>
                    <span className="dataTableCellMuted">{formatAmount(p.netSalary, p.currency)}</span>
                    <StatusPill
                    status={p.status === "paid" ? "accepted" : p.status === "validated" ? "pending" : "rejected"}
                    label={t(`payroll.payslipStatus.${p.status}`)}
                  />
                  <div className="dataTableActions">
                    <button
                      type="button"
                      className="tableActionBtn"
                      title={t("payroll.actions.downloadPdf")}
                      disabled={downloadingId === p._id}
                      onClick={() => handleDownloadPayslip(p)}
                    >
                      <Download size={15} />
                    </button>
                    {p.status === "validated" && (
                      <button type="button" className="tableActionBtn tableActionBtnAccept" title={t("payroll.actions.markPaid")} onClick={() => handleMarkPaid(p._id)}>
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      )}

      <ActionModal
        isOpen={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirm : undefined}
        onClose={closeModal}
      />
    </div>
  );
}
