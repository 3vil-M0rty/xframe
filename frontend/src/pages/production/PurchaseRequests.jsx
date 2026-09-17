import { useEffect, useState } from "react";
import { ShoppingCart, BriefcaseBusiness, Check, X as XIcon, Trash2 } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import Pagination from "../../components/useful/Pagination";
import StatusPill from "../../components/useful/StatusPill";

import {
  getPurchaseRequests,
  reviewPurchaseRequest,
  deletePurchaseRequest,
} from "../../services/purchaseRequestService";
import { getCompanies } from "../../services/companyService";
import { isAdmin } from "../../utils/permissions";

import styles from "./PurchaseRequests.module.css";

const PAGE_SIZE = 20;

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB");
}

const STATUS_TO_PILL = { pending: "pending", approved: "accepted", rejected: "rejected", received: "accepted" };

export default function PurchaseRequests() {
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

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setPage(1); }, [selectedCompanyId, statusFilter]);

  const reload = async () => {
    if (!selectedCompanyId) return;
    const { requests: data, pagination: p } = await getPurchaseRequests({ companyId: selectedCompanyId, status: statusFilter || undefined, page, limit: PAGE_SIZE });
    setRequests(data);
    setPagination(p);
  };

  useEffect(() => {
    if (!selectedCompanyId) { setRequests([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { requests: data, pagination: p } = await getPurchaseRequests({ companyId: selectedCompanyId, status: statusFilter || undefined, page, limit: PAGE_SIZE });
        if (cancelled) return;
        setRequests(data);
        setPagination(p);
      } catch (error) {
        console.error("Failed to load purchase requests:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, statusFilter, page]);

  const handleReview = async (request, status) => {
    try {
      await reviewPurchaseRequest(request._id, status);
      await reload();
    } catch (error) {
      console.error("Failed to review purchase request:", error);
    }
  };

  const handleDelete = async (request) => {
    try {
      await deletePurchaseRequest(request._id);
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
    } catch (error) {
      console.error("Failed to delete purchase request:", error);
    }
  };

  const gridColumns = "minmax(140px,1.2fr) minmax(90px,0.7fr) minmax(100px,0.8fr) minmax(90px,0.7fr) 1fr";

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("production.title"), href: "/production/inventory" }, { label: t("purchaseRequests.title") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <ShoppingCart size={20} />
            <h1>{t("purchaseRequests.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("purchaseRequests.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>
        <div className="filterGroup">
          <label>{t("absences.fields.status")}</label>
          <CustomSelect value={statusFilter} onSelect={setStatusFilter} options={[
            { value: "", label: t("absences.filters.allStatuses") },
            { value: "pending", label: t("absences.status.pending") },
            { value: "approved", label: t("absences.status.accepted") },
            { value: "rejected", label: t("absences.status.rejected") },
            { value: "received", label: t("purchaseRequests.status.received") },
          ]} />
        </div>
      </div>

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {selectedCompanyId && !loading && requests.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><ShoppingCart size={28} /></div>
          <h2>{t("purchaseRequests.emptyTitle")}</h2>
          <p>{t("purchaseRequests.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && requests.length > 0 && (
        <>
          <div className="dataTable">
            <div className="dataTableHead" style={{ gridTemplateColumns: gridColumns }}>
              <span>{t("purchaseRequests.fields.product")}</span>
              <span>{t("purchaseRequests.fields.quantity")}</span>
              <span>{t("purchaseRequests.fields.requestedBy")}</span>
              <span>{t("absences.fields.status")}</span>
              <span />
            </div>
            {requests.map((request) => (
              <div key={request._id} className="dataTableRow" style={{ gridTemplateColumns: gridColumns }}>
                <span>{request.product?.name || "—"} <span className="dataTableCellMuted">({request.product?.internalReference})</span></span>
                <span className="dataTableCellMuted">{request.requestedQuantity} {request.product?.unit}</span>
                <span className="dataTableCellMuted">{request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : "—"} · {formatDate(request.createdAt)}</span>
                <StatusPill status={STATUS_TO_PILL[request.status]} label={t(`purchaseRequests.status.${request.status}`)} />
                <div className="dataTableActions">
                  {userIsAdmin && request.status === "pending" && (
                    <>
                      <button type="button" className="tableActionBtn tableActionBtnAccept" title={t("absences.actions.accept")} onClick={() => handleReview(request, "approved")}>
                        <Check size={14} />
                      </button>
                      <button type="button" className="tableActionBtn tableActionBtnReject" title={t("absences.actions.reject")} onClick={() => handleReview(request, "rejected")}>
                        <XIcon size={14} />
                      </button>
                    </>
                  )}
                  {userIsAdmin && request.status === "approved" && (
                    <button type="button" className="tableActionBtn tableActionBtnAccept" title={t("purchaseRequests.markReceived")} onClick={() => handleReview(request, "received")}>
                      <Check size={14} />
                    </button>
                  )}
                  {userIsAdmin && (
                    <button type="button" className="tableActionBtn tableActionBtnDanger" title={t("common.delete")} onClick={() => handleDelete(request)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
