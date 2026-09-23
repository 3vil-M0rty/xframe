import { useEffect, useState } from "react";
import { Network, Users as UsersIcon, KeyRound } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import { useAuth } from "../../hooks/useAuth";
import Breadcrumbs from "../../components/useful/Breadcrumbs";
import TranslatedText from "../../components/useful/TranslatedText";

import { getManagedDepartments } from "../../services/departmentService";
import { setPositionAccess } from "../../services/jobPositionService";

import styles from "./MyDepartment.module.css";

/**
 * "My department" — for department managers (Department.manager).
 * Shows each department they run with:
 *   - its job positions, each with a switch deciding whether holders
 *     of that position get the department's module (HR / Production).
 *     This is how a manager distributes permissions across job titles.
 *   - its team, with each person's job title and resulting access.
 * Flipping a switch re-syncs the affected accounts on the backend
 * immediately (see PATCH /job-positions/:id/access).
 */
export default function MyDepartment() {
  const { t } = useI18n();
  const { user } = useAuth();
  // Admins oversee every department, owners every department of their
  // companies — same page, wider scope (see GET /departments/managed).
  const overseesAll = user?.role === "admin" || user?.role === "owner";
  const pageTitle = overseesAll ? t("myDepartment.adminTitle") : t("myDepartment.title");

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getManagedDepartments();
        if (!cancelled) setDepartments(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t("myDepartment.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePositionLocally = (departmentId, positionId, value) => {
    setDepartments((prev) => prev.map((d) => (d._id !== departmentId ? d : {
      ...d,
      positions: d.positions.map((p) => (p._id === positionId ? { ...p, grantsModuleAccess: value } : p)),
    })));
  };

  const handleToggle = async (department, position) => {
    const next = !position.grantsModuleAccess;
    setSavingId(position._id);
    setError("");
    setNotice("");
    updatePositionLocally(department._id, position._id, next); // optimistic
    try {
      const result = await setPositionAccess(position._id, next);
      const count = result?.usersUpdated || 0;
      setNotice(count > 0 ? t("myDepartment.accountsUpdated").replace("{count}", count) : t("myDepartment.saved"));
    } catch (err) {
      updatePositionLocally(department._id, position._id, !next); // roll back
      setError(err.response?.data?.message || t("myDepartment.saveError"));
    } finally {
      setSavingId(null);
    }
  };

  const hasAccess = (department, employee) =>
    !!department.permissionKey &&
    department.positions.some((p) => p.grantsModuleAccess && p.title === (employee.jobTitle || "").trim());

  const holdersOf = (department, position) =>
    department.employees.filter((e) => (e.jobTitle || "").trim() === position.title).length;

  return (
    <div className="pageShell">
      <Breadcrumbs items={overseesAll
        ? [{ label: t("sidebar.organization"), href: "/organization/company" }, { label: pageTitle }]
        : [{ label: t("sidebar.mySpace"), href: "/me" }, { label: pageTitle }]} />

      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">
            <Network size={20} />
            <h1>{pageTitle}</h1>
          </div>
          <p className="pageSubtitle">{overseesAll ? t("myDepartment.adminSubtitle") : t("myDepartment.subtitle")}</p>
        </div>
      </div>

      {error && <div className="errorMessage">{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}
      {loading && <p className={styles.muted}>{t("common.loading")}</p>}

      {!loading && departments.length === 0 && !error && (
        <div className="emptyStateBlock">
          <h2>{overseesAll ? t("myDepartment.adminEmptyTitle") : t("myDepartment.emptyTitle")}</h2>
        </div>
      )}

      {departments.map((department) => (
        <section key={department._id} className={styles.department}>
          <div className={styles.departmentHeader}>
            <h2 className={styles.departmentName}>
              {department.name}
              {overseesAll && department.company?.name && (
                <span className={styles.companyName}> · {department.company.name}</span>
              )}
            </h2>
            {department.manager?.firstName ? (
              <span className={styles.managerChip}>
                {t("departments.managerLabel")}: {department.manager.firstName} {department.manager.lastName}
              </span>
            ) : (
              <span className="statusPill statusPillPending">{t("myDepartment.noManagerAssigned")}</span>
            )}
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}><KeyRound size={15} /> {t("myDepartment.positionsTitle")}</h3>
            {department.permissionKey ? (
              <p className={styles.muted}>{t("myDepartment.positionsHint")}</p>
            ) : (
              <p className={styles.muted}>{t("myDepartment.noModule")}</p>
            )}

            {department.positions.length === 0 ? (
              <p className={styles.muted}>{t("myDepartment.noPositions")}</p>
            ) : (
              <div className={styles.positionList}>
                {department.positions.map((position) => (
                  <label key={position._id} className={styles.positionRow}>
                    <span className={styles.positionText}>
                      <strong><TranslatedText doc={position} field="title" /></strong>
                      <small>{t("myDepartment.holders").replace("{count}", holdersOf(department, position))}</small>
                    </span>
                    {department.permissionKey && (
                      <input
                        type="checkbox"
                        className="switchToggle"
                        checked={!!position.grantsModuleAccess}
                        disabled={savingId === position._id}
                        onChange={() => handleToggle(department, position)}
                        aria-label={t("myDepartment.toggleLabel")}
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.block}>
            <h3 className={styles.blockTitle}><UsersIcon size={15} /> {t("myDepartment.teamTitle")}</h3>
            {department.employees.length === 0 ? (
              <p className={styles.muted}>{t("myDepartment.noEmployees")}</p>
            ) : (
              <div className="dataTable">
                <div className="dataTableHead" style={{ gridTemplateColumns: "1.4fr 1.4fr 1fr" }}>
                  <span>{t("myDepartment.columns.name")}</span>
                  <span>{t("myDepartment.columns.jobTitle")}</span>
                  <span>{t("myDepartment.columns.access")}</span>
                </div>
                {department.employees.map((employee) => (
                  <div key={employee._id} className="dataTableRow" style={{ gridTemplateColumns: "1.4fr 1.4fr 1fr" }}>
                    <span>{employee.firstName} {employee.lastName}</span>
                    <span className="dataTableCellMuted">{employee.jobTitle || "—"}</span>
                    <span>
                      {!employee.hasLogin ? (
                        <span className="dataTableCellMuted">{t("myDepartment.noLogin")}</span>
                      ) : hasAccess(department, employee) ? (
                        <span className="statusPill statusPillAccepted">{t("myDepartment.moduleAccess")}</span>
                      ) : (
                        <span className="statusPill statusPillNeutral">{t("myDepartment.mySpaceOnly")}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
