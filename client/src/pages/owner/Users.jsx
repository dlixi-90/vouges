import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Pencil, Save, X, LockKeyhole } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import {
  CatalogPage,
  CatalogState,
  RefreshButton,
  Badge,
  useCatalog,
  Pager,
} from "../../components/owner/CatalogUI";
import CustomerProfileFields from "../../components/CustomerProfileFields";
import usePaginationScroll from "../../hooks/usePaginationScroll";
import { validateCustomerProfile } from "../../utils/customerProfile";
import "../../customers.css";

const birthdayLabel = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "")
    ? value.split("-").reverse().join("/")
    : "Chưa cập nhật";

export default function Users() {
  const [q, setQ] = useState(""),
    [role, setRole] = useState("all"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25),
    [editing, setEditing] = useState(null);
  const query = useCatalog(
    `/manage?${new URLSearchParams({ q, role, page: String(page), pageSize: String(pageSize) })}`,
    "/api/users",
  );
  const { listRef, changePage } = usePaginationScroll({
    page,
    onPageChange: setPage,
    ready: !query.loading && query.data?.page === page,
  });
  const rows = query.data?.users || [];
  return (
    <CatalogPage
      title="Người dùng"
      className="admin-customers-page"
      actions={
        <RefreshButton onClick={query.reload} disabled={query.loading} />
      }
    >
      <p className="user-access-intro">
        Quản lý tài khoản, thông tin khách hàng và vai trò.
        {query.data?.canManageRoles
          ? " Chỉ quản trị gốc được cấp hoặc thu hồi quyền Admin."
          : " Quyền Admin do quản trị gốc cấp hoặc thu hồi."}
      </p>
      <div className="perfume-filter-bar">
        <label className="perfume-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Tìm người dùng"
            placeholder="Tìm họ tên, số điện thoại, email…"
            value={q}
            maxLength={120}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Lọc vai trò"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">Tất cả vai trò</option>
          <option value="user">Khách hàng</option>
          <option value="owner">Quản trị viên</option>
        </select>
        <select
          aria-label="Số người dùng mỗi trang"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
        >
          {[10, 25, 50].map((size) => (
            <option key={size} value={size}>
              {size} người dùng / trang
            </option>
          ))}
        </select>
      </div>
      <CatalogState {...query} />
      <section
        className="perfume-table-panel"
        aria-label="Danh sách người dùng"
      >
        <div className="customer-table-heading">
          <strong>
            {Number(query.data?.total || 0).toLocaleString("vi-VN")}
          </strong>{" "}
          người dùng
        </div>
        <div className="perfume-table-scroll">
          <table
            className="perfume-table customer-table pagination-list-start"
            ref={listRef}
            tabIndex={-1}
            aria-busy={query.loading}
          >
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Ngày sinh</th>
                <th>Vai trò</th>
                <th>Thông tin</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer._id}>
                  <td className="customer-name">
                    <strong>{customer.fullName || "Chưa cập nhật"}</strong>
                  </td>
                  <td className="customer-email">
                    {customer.email || "Chưa cập nhật"}
                  </td>
                  <td className="customer-nowrap">
                    {customer.phone || "Chưa cập nhật"}
                  </td>
                  <td className="customer-nowrap">
                    {birthdayLabel(customer.birthday)}
                  </td>
                  <td>
                    <Badge
                      tone={
                        customer.isRootAdmin || customer.role === "owner"
                          ? "amber"
                          : "neutral"
                      }
                    >
                      {customer.isRootAdmin
                        ? "Quản trị gốc"
                        : customer.role === "owner"
                          ? "Admin"
                          : "Khách hàng"}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={customer.completedAt ? "green" : "amber"}>
                      {customer.completedAt
                        ? "Đã hoàn thiện"
                        : "Chưa hoàn thiện"}
                    </Badge>
                  </td>
                  <td>
                    <div className="user-row-actions">
                      {(customer.canEditProfile || customer.canChangeRole) && (
                        <button
                          type="button"
                          className="perfume-button"
                          aria-label={`Chỉnh sửa người dùng ${customer.fullName}`}
                          onClick={() => setEditing(customer)}
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Chỉnh sửa
                        </button>
                      )}
                      {customer.isRootAdmin && (
                        <span
                          className="user-protected"
                          title="Vai trò quản trị gốc không thể thay đổi trên website"
                        >
                          <LockKeyhole size={14} aria-hidden="true" />
                          Khóa vai trò
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!query.loading && !rows.length && !query.error && (
            <p className="perfume-empty">
              {q || role !== "all"
                ? "Không tìm thấy người dùng phù hợp."
                : "Chưa có người dùng."}
            </p>
          )}
        </div>
        <Pager
          page={page}
          totalPages={query.data?.totalPages}
          total={query.data?.total}
          onPage={changePage}
          disabled={query.loading}
        />
      </section>
      {editing && (
        <UserEditor
          key={editing._id}
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.reload();
          }}
        />
      )}
    </CatalogPage>
  );
}

function UserDialog({ title, children, busy, onClose, className = "" }) {
  const ref = useRef(null),
    close = useRef({ busy, onClose });
  useEffect(() => {
    close.current = { busy, onClose };
  }, [busy, onClose]);
  useEffect(() => {
    const dialog = ref.current,
      opener = document.activeElement,
      overflow = document.body.style.overflow;
    const cancel = (event) => {
      event.preventDefault();
      if (!close.current.busy) close.current.onClose();
    };
    dialog.addEventListener("cancel", cancel);
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`customer-profile-dialog customer-editor-dialog user-access-dialog ${className}`}
      aria-labelledby="user-access-title"
      aria-busy={Boolean(busy)}
    >
      <header>
        <h2 id="user-access-title">{title}</h2>
        <button
          type="button"
          aria-label="Đóng cửa sổ"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}

function UserEditor({ customer, onClose, onSaved }) {
  const [tab, setTab] = useState(customer.canEditProfile ? "profile" : "role"),
    [busy, setBusy] = useState(false);
  const tabs = customer.canChangeRole
    ? [
        { id: "profile", label: "Thông tin" },
        { id: "role", label: "Phân quyền" },
      ]
    : [{ id: "profile", label: "Thông tin" }];
  const keys = (event, index) => {
    if (busy || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    setTab(tabs[next].id);
    document.getElementById(`user-editor-tab-${tabs[next].id}`)?.focus();
  };
  return (
    <UserDialog
      title="Chỉnh sửa người dùng"
      busy={busy}
      onClose={onClose}
      className="user-editor-dialog"
    >
      <p className="customer-editor-email">
        <strong>{customer.fullName || "Chưa cập nhật"}</strong>
        <br />
        {customer.email || "Chưa cập nhật email"}
      </p>
      <div
        className="user-editor-tabs"
        role="tablist"
        aria-label="Chỉnh sửa người dùng"
      >
        {tabs.map((item, index) => (
          <button
            type="button"
            role="tab"
            id={`user-editor-tab-${item.id}`}
            aria-controls={`user-editor-panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            disabled={busy}
            onKeyDown={(event) => keys(event, index)}
            onClick={() => setTab(item.id)}
            key={item.id}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section
        id="user-editor-panel-profile"
        role="tabpanel"
        aria-labelledby="user-editor-tab-profile"
        hidden={tab !== "profile"}
      >
        {customer.canEditProfile ? (
          <ProfileForm
            customer={customer}
            busy={busy}
            setBusy={setBusy}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <dl className="user-readonly-profile">
            <div>
              <dt>Họ và tên</dt>
              <dd>{customer.fullName || "Chưa cập nhật"}</dd>
            </div>
            <div>
              <dt>Số điện thoại</dt>
              <dd>{customer.phone || "Chưa cập nhật"}</dd>
            </div>
            <div>
              <dt>Ngày sinh</dt>
              <dd>{birthdayLabel(customer.birthday)}</dd>
            </div>
          </dl>
        )}
      </section>
      {customer.canChangeRole && (
        <section
          id="user-editor-panel-role"
          role="tabpanel"
          aria-labelledby="user-editor-tab-role"
          hidden={tab !== "role"}
        >
          <RoleForm
            account={customer}
            busy={busy}
            setBusy={setBusy}
            onClose={onClose}
            onSaved={onSaved}
          />
        </section>
      )}
    </UserDialog>
  );
}

function RoleForm({ account, busy, setBusy, onClose, onSaved }) {
  const { axios, getToken, storeResources } = useAppContext();
  const [role, setRole] = useState(account.role),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const submitting = useRef(false),
    request = useRef(null),
    key = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const save = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    if (reason.trim().length > 500) {
      setError("Lý do tối đa 500 ký tự.");
      return;
    }
    const fingerprint = JSON.stringify([
      role,
      reason.trim(),
      account.accessVersion,
    ]);
    if (key.current?.fingerprint !== fingerprint)
      key.current = { fingerprint, id: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const token = await getToken();
      controller.signal.throwIfAborted();
      const { data } = await axios.patch(
        `/api/users/manage/${encodeURIComponent(account._id)}/role`,
        {
          role,
          reason: reason.trim(),
          version: account.accessVersion,
          requestId: key.current.id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 15000,
        },
      );
      if (!data.success)
        throw Error(data.message || "Không thể cập nhật quyền.");
      if (!controller.signal.aborted) {
        storeResources.invalidateCatalog();
        onSaved();
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err.response?.data?.message || err.message);
    } finally {
      if (!controller.signal.aborted) {
        submitting.current = false;
        setBusy(false);
      }
      request.current = null;
    }
  };
  return (
    <form onSubmit={save} className="user-role-form">
      <label htmlFor="user-role">Vai trò</label>
      <select
        id="user-role"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        disabled={busy}
      >
        <option value="user">Khách hàng</option>
        <option
          value="owner"
          disabled={!account.email && account.role !== "owner"}
        >
          Admin
        </option>
      </select>
      <p className="user-role-explanation">
        {role === "owner"
          ? "Admin được quản lý sản phẩm, đơn hàng, khách hàng, ưu đãi và hỗ trợ. Chỉ quản trị gốc được quản lý phân quyền."
          : "Khách hàng sử dụng các chức năng mua sắm và không được truy cập API quản trị. Thay đổi vai trò vẫn giữ nguyên đơn hàng, điểm và lịch sử."}
      </p>
      <label htmlFor="user-role-reason">Lý do thay đổi</label>
      <textarea
        id="user-role-reason"
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={busy}
        placeholder="Có thể thêm ghi chú cho thay đổi này…"
      />
      <p className="user-role-note">
        Mọi thay đổi được lưu cùng người thực hiện và thời điểm.
      </p>
      {error && (
        <p role="alert" className="customer-field-error">
          {error}
        </p>
      )}
      <footer>
        <button
          type="button"
          className="btn-outline"
          disabled={busy}
          onClick={onClose}
        >
          Hủy
        </button>
        <button
          type="submit"
          className="btn-dark"
          disabled={busy || role === account.role}
        >
          {busy
            ? "Đang cập nhật…"
            : role === "owner"
              ? "Xác nhận cấp Admin"
              : "Xác nhận thu hồi"}
        </button>
      </footer>
    </form>
  );
}

function ProfileForm({ customer, busy, setBusy, onClose, onSaved }) {
  const { axios, getToken, storeResources } = useAppContext();
  const request = useRef(null),
    submitting = useRef(false);
  const [draft, setDraft] = useState({
    fullName: customer.fullName || "",
    phone: customer.phone || "",
    birthday: customer.birthday || "",
  });
  const [errors, setErrors] = useState({}),
    [error, setError] = useState("");
  useEffect(() => () => request.current?.abort(), []);
  const save = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const checked = validateCustomerProfile(draft);
    setErrors(checked.errors);
    setError("");
    if (Object.keys(checked.errors).length) return;
    submitting.current = true;
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const token = await getToken();
      controller.signal.throwIfAborted();
      const { data } = await axios.patch(
        `/api/users/customers/${encodeURIComponent(customer._id)}`,
        checked.value,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 15000,
        },
      );
      if (!data.success)
        throw new Error(data.message || "Không thể lưu thông tin khách hàng.");
      if (controller.signal.aborted) return;
      storeResources.invalidateCatalog();
      onSaved();
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrors(err.response?.data?.errors || {});
        setError(err.response?.data?.message || err.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        submitting.current = false;
        setBusy(false);
      }
      request.current = null;
    }
  };
  return (
    <form className="user-profile-form" onSubmit={save} noValidate>
      <CustomerProfileFields
        draft={draft}
        setDraft={setDraft}
        errors={errors}
        disabled={busy}
      />
      {error && (
        <p role="alert" className="customer-field-error">
          {error}
        </p>
      )}
      <footer>
        <button
          type="button"
          className="btn-outline"
          disabled={busy}
          onClick={onClose}
        >
          Hủy
        </button>
        <button type="submit" className="btn-dark" disabled={busy}>
          <Save size={15} />
          {busy ? "Đang lưu…" : "Lưu thông tin"}
        </button>
      </footer>
    </form>
  );
}
