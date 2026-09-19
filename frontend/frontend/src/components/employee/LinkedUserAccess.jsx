import { useEffect, useState } from "react";
import { UserRoundCog, Link2, Unlink, KeyRound, RotateCcw } from "lucide-react";

import { useI18n } from "../../hooks/useI18n";
import SearchSelect from "../useful/SearchSelect";
import ActionModal from "../useful/ActionModal";

import {
  getEmployeeById,
  linkEmployeeUser,
  unlinkEmployeeUser,
  createEmployeeLogin,
  resetEmployeePassword,
} from "../../services/employeeService";
import { getUsers } from "../../services/userService";

/**
 * Lives inside the employee detail view. Shows whether this
 * employee's self-service login is linked to a User account, and
 * lets HR either link an existing account or create a brand-new
 * one — this is what turns on My Space (My Payslips, My Absences,
 * My Advances, My Attendance) for that person. See
 * routes/employees.js: PATCH /:id/link-user, POST /:id/create-login.
 *
 * New employees get a login automatically at creation time (see
 * the "Create self-service login" checkbox on the employee form) —
 * this panel is mainly for employees created before that existed,
 * or where it was skipped (e.g. no work email on file yet).
 */
export default function LinkedUserAccess({ employeeId }) {
  const { t, tVar } = useI18n();

  const [linkedUser, setLinkedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [modal, setModal] = useState({ open: false, type: "confirm", title: "", message: "" });
  const [modalAction, setModalAction] = useState(null); // "link" | "unlink" | "create"
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { linkedUser: linked } = await getEmployeeById(employeeId);
      setLinkedUser(linked);
    } catch (error) {
      console.error("Failed to load linked user:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    if (linkedUser) return; // no need to load the picker once already linked
    (async () => {
      try {
        const { users: data } = await getUsers({ limit: 200 });
        setUsers(data || []);
      } catch (error) {
        console.error("Failed to load users:", error);
      }
    })();
  }, [linkedUser]);

  const userOptions = users.map((u) => ({
    value: u._id,
    label: `${u.firstName} ${u.lastName} (${u.email})`,
    searchText: `${u.firstName} ${u.lastName} ${u.email}`,
  }));

  const closeModal = () => {
    if (actionLoading) return;
    setModal((prev) => ({ ...prev, open: false }));
    setModalAction(null);
  };

  const askLink = () => {
    if (!selectedUserId) return;
    setModalAction("link");
    setModal({
      open: true,
      type: "confirm",
      title: t("employees.linkedUser.linkTitle"),
      message: t("employees.linkedUser.linkSureMessage"),
    });
  };

  const askUnlink = () => {
    setModalAction("unlink");
    setModal({
      open: true,
      type: "confirm",
      title: t("employees.linkedUser.unlinkTitle"),
      message: t("employees.linkedUser.unlinkSureMessage"),
    });
  };

  const askResetPassword = () => {
    setModalAction("reset");
    setModal({
      open: true,
      type: "confirm",
      title: t("employees.linkedUser.resetPasswordTitle"),
      message: t("employees.linkedUser.resetPasswordSureMessage"),
    });
  };

  const askCreate = () => {
    setModalAction("create");
    setModal({
      open: true,
      type: "confirm",
      title: t("employees.linkedUser.createLoginTitle"),
      message: t("employees.linkedUser.createLoginSureMessage"),
    });
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      if (modalAction === "unlink") {
        await unlinkEmployeeUser(employeeId);
        await load();
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
      } else if (modalAction === "link") {
        await linkEmployeeUser(employeeId, selectedUserId);
        setSelectedUserId("");
        await load();
        setModal((prev) => ({ ...prev, open: false }));
        setModalAction(null);
      } else if (modalAction === "create") {
        const { email, temporaryPassword } = await createEmployeeLogin(employeeId);
        await load();
        // Shown once — the password can't be retrieved again after
        // this, since it's hashed as soon as it's saved.
        setModal({
          open: true,
          type: "success",
          title: t("employees.linkedUser.loginCreatedTitle"),
          message: tVar("employees.linkedUser.loginCreatedMessage", {
            email,
            password: temporaryPassword,
          }),
        });
        setModalAction(null);
      } else if (modalAction === "reset") {
        const { email, temporaryPassword } = await resetEmployeePassword(employeeId);
        setModal({
          open: true,
          type: "success",
          title: t("employees.linkedUser.loginCreatedTitle"),
          message: tVar("employees.linkedUser.loginCreatedMessage", {
            email,
            password: temporaryPassword,
          }),
        });
        setModalAction(null);
      }
    } catch (error) {
      setModal({
        open: true,
        type: "error",
        title: t("common.fail"),
        message: error.response?.data?.message || t("employees.linkedUser.actionFailed"),
      });
      setModalAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="detailSection">
      <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", margin: "0 0 12px" }}>
        <UserRoundCog size={16} />
        {t("employees.linkedUser.title")}
      </h2>

      {linkedUser ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
            {t("employees.linkedUser.linkedTo")}{" "}
            <strong style={{ color: "var(--color-text-primary)" }}>
              {linkedUser.firstName} {linkedUser.lastName}
            </strong>{" "}
            ({linkedUser.email})
          </span>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button type="button" className="btnEdit" onClick={askResetPassword}>
              <RotateCcw size={14} />
              {t("employees.linkedUser.resetPassword")}
            </button>
            <button type="button" className="btnDelete" onClick={askUnlink}>
              <Unlink size={14} />
              {t("employees.linkedUser.unlink")}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <div style={{ flex: "1 1 260px", minWidth: 220 }}>
              <SearchSelect
                value={selectedUserId}
                onSelect={setSelectedUserId}
                options={userOptions}
                placeholder={t("employees.linkedUser.searchPlaceholder")}
                noResultsLabel={t("common.noResults")}
              />
            </div>

            <button type="button" className="btnEdit" disabled={!selectedUserId} onClick={askLink}>
              <Link2 size={14} />
              {t("employees.linkedUser.link")}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
              {t("employees.linkedUser.orCreateNew")}
            </span>
            <button type="button" className="btnEdit" onClick={askCreate}>
              <KeyRound size={14} />
              {t("employees.linkedUser.createLogin")}
            </button>
          </div>
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
