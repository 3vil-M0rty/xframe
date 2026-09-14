import { useEffect, useMemo, useState } from "react";
import { Network, BriefcaseBusiness, UserRound } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";

import CustomSelect from "../../components/useful/CustomSelect";
import Breadcrumbs from "../../components/useful/Breadcrumbs";

import { getEmployees } from "../../services/employeeService";
import { getCompanies } from "../../services/companyService";

import styles from "./OrgChart.module.css";

function employeeName(employee) {
  return `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
}

function buildTree(employees) {
  const byId = new Map(employees.map((e) => [e._id, { ...e, children: [] }]));
  const roots = [];

  for (const employee of byId.values()) {
    const managerId = employee.manager?._id || employee.manager;
    if (managerId && byId.has(managerId)) {
      byId.get(managerId).children.push(employee);
    } else {
      roots.push(employee);
    }
  }

  return roots;
}

function TreeNode({ node, depth }) {
  return (
    <div className={styles.node} style={{ marginInlineStart: depth * 24 }}>
      <div className={styles.nodeCard}>
        <div className={styles.avatar}>
          {node.photo?.url ? (
            <img src={node.photo.url} alt={employeeName(node)} />
          ) : (
            <UserRound size={16} />
          )}
        </div>
        <div className={styles.nodeInfo}>
          <span className={styles.nodeName}>{employeeName(node)}</span>
          <span className={styles.nodeTitle}>{node.jobTitle || "—"}</span>
        </div>
        {node.children.length > 0 && (
          <span className={styles.reportCount}>{node.children.length}</span>
        )}
      </div>

      {node.children.map((child) => (
        <TreeNode key={child._id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function OrgChart() {
  const { t } = useI18n();

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

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompanyId) { setEmployees([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { employees: data } = await getEmployees({ companyId: selectedCompanyId, page: 1, limit: 500 });
        if (!cancelled) setEmployees(data || []);
      } catch (error) {
        console.error("Failed to load employees:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const tree = useMemo(() => buildTree(employees), [employees]);

  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("orgChart.breadcrumbs.hr"), href: "/hr/employees" }, { label: t("orgChart.breadcrumbs.orgChart") }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Network size={20} />
            <h1>{t("orgChart.title")}</h1>
          </div>
          <p className="pageSubtitle">{t("orgChart.subtitle")}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={selectedCompanyId} onSelect={setSelectedCompanyId} options={companyOptions}
            placeholder={companiesLoading ? t("employees.toolbar.loadingCompanies") : t("employees.toolbar.selectCompany")}
            disabled={companiesLoading} />
        </div>
      </div>

      {!selectedCompanyId && !companiesLoading && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><BriefcaseBusiness size={28} /></div>
          <h2>{t("employees.emptyNoCompany.title")}</h2>
          <p>{t("employees.emptyNoCompany.message")}</p>
        </div>
      )}

      {selectedCompanyId && !loading && tree.length === 0 && (
        <div className="emptyStateBlock">
          <div className="emptyStateIcon"><Network size={28} /></div>
          <h2>{t("orgChart.emptyTitle")}</h2>
          <p>{t("orgChart.emptyMessage")}</p>
        </div>
      )}

      {selectedCompanyId && tree.length > 0 && (
        <div className={styles.treeWrapper}>
          {tree.map((root) => (
            <TreeNode key={root._id} node={root} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
