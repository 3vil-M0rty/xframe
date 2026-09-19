import { useEffect, useState } from "react";
import { History, BriefcaseBusiness, Trash2 } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import ActionModal from "../../components/useful/ActionModal";
import DateRangeFilter from "../../components/useful/DateRangeFilter";

import { getAuditLogs, deleteAuditLogEntry } from "../../services/auditLogService";
import { getCompanies } from "../../services/companyService";
import { isAdmin } from "../../utils/permissions";

import styles from "./AuditLog.module.css";

const PAGE_SIZE = 25;

const RESOURCE_TYPES = [
  "Employee", "Salary", "Absence", "Advance", "Contract",
  "EmployeeDocument", "PayrollRun", "WorkSchedule",
];

function actorName(actor) {
  if (!actor) return "—";
  return `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email;
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-GB");
}

export default function AuditLog() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();
  const userIsAdmin = isAdmin(currentUser);

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setCompaniesLoading(true);
        const data = await getCompanies();
        const list = Array.isArray(data) ? data : [];
        setCompanies(list);
        if (!selectedCompanyId && list.length > 0) setSelectedCompanyId(list[0]._id);
      } catch (error) {
        console.error("Failed to load companies:", error);
      } finally {
        setCompaniesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companyOptions = companies.map((c) => ({
    value: c._id,
    label: c.name || c.tradeName || t("employees.company.unnamed"),
  }));

  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setPage(1); }, [selectedCompanyId, resourceTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedCompanyId) { setEntries([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const { entries: data, pagination: p } = await getAuditLogs({
          companyId: selectedCompanyId,
          resourceType: resourceTypeFilter || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        setEntries(data);
        setPagination(p);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.message || t("auditLog.errors.fetchFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, resourceTypeFilter, dateFrom, dateTo, page, t]);

  const gridColumns = userIsAdmin
    ? "minmax(120px,0.8fr) minmax(130px,1fr) minmax(110px,0.8fr) minmax(150px,1.2fr) minmax(130px,1fr) 50px"
    : "minmax(120px,0.8fr) minmax(130px,1fr) minmax(110px,0.8fr) minmax(150px,1.2fr) minmax(130px,1fr)";

  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const askDelete = (entry) => {
    setPendingDeleteId(entry._id);
    setModal({ open: true, type: "confirm", title: t("auditLog.deleteTitle"), message: t("auditLog.deleteSureMessage") });
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModal((prev) => ({ ...prev, open: false }));
    setPendingDeleteId(null);
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      await deleteAuditLogEntry(pendingDeleteId);
      setEntries((prev) => prev.filter((e) => e._id !== pendingDeleteId));
      setModal((prev) => ({ ...prev, open: false }));
      setPendingDeleteId(null);
    } catch (error) {
      setModal({ open: true, type: "error", title: t("common.fail"), message: error.response?.data?.message || t("auditLog.errors.actionFailed") });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("auditLog.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("auditLog.breadcrumbs.auditLog") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <History size={20} />
            <h1>{t("auditLog.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("auditLog.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>
        <div className={styles.filterGroup}>
          <label>{t("auditLog.fields.resourceType")}</label>
          <CustomSelect value={resourceTypeFilter} onSelect={setResourceTypeFilter} options={[
            { value: "", label: t("absences.filters.allTypes") },
            ...RESOURCE_TYPES.map((r) => ({ value: r, label: t(`auditLog.resourceTypes.${r}`) })),
          ]} />
        </div>

        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          fromLabel={t("common.dateFrom")}
          toLabel={t("common.dateTo")}
        />
      </div>

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {selectedCompanyId && !loading && entries.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><History size={28} /></div>
          <h2>{t("auditLog.emptyTitle")}</h2>
          <p>{t("auditLog.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && entries.length > 0 && (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("auditLog.fields.action")}</span>
              <span>{t("auditLog.fields.resourceType")}</span>
              <span>{t("auditLog.fields.resource")}</span>
              <span>{t("auditLog.fields.actor")}</span>
              <span>{t("auditLog.fields.date")}</span>
              {userIsAdmin && <span />}
            </div>
            {entries.map((entry) => (
              <div key={entry._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span className={styles.actionTag} data-action={entry.action}>
                  {t(`auditLog.actions.${entry.action}`)}
                </span>
                <span className="dataTableCellMuted">{t(`auditLog.resourceTypes.${entry.resourceType}`)}</span>
                <span className="dataTableCellMuted">{entry.resourceLabel || "—"}</span>
                <span className="dataTableCellMuted">{actorName(entry.actor)}</span>
                <span className="dataTableCellMuted">{formatDateTime(entry.createdAt)}</span>
                {userIsAdmin && (
                  <div className="dataTableActions">
                    <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => askDelete(entry)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}

      <ActionModal
        isOpen={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        loading={actionLoading}
        onConfirm={modal.type === "confirm" ? handleConfirmDelete : undefined}
        onClose={closeModal}
      />
    </div>
  );
}
