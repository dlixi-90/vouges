import { useCallback, useEffect, useId, useState } from "react";
import toast from "react-hot-toast";
import { LoaderCircle, Plus, Search, Ticket, Trash2 } from "lucide-react";
import DeleteVoucherDialog from "../../components/owner/DeleteVoucherDialog";
import { useAppContext } from "../../context/AppContext";
import { formatVnd } from "../../utils/money";
import { getVoucherValidityPeriod, getVoucherStatus, formatVoucherDate, formatVoucherExpiryDate } from "../../utils/voucherDates";
import { Badge, CatalogPage, RefreshButton } from "../../components/owner/CatalogUI";
import { OperationsEmptyState, OperationsPanel } from "../../components/owner/OperationsUI";
import OperationsDrawer from "../../components/owner/OperationsDrawer";

const initial = { code: "", type: "percent", value: 10, minSubtotal: 0, maxDiscount: "", maxUses: 100, startsAt: "", expiresAt: "" };
const voucherStatuses = {
  available: { label: "Có thể sử dụng", tone: "green" },
  inactive: { label: "Đã tắt", tone: "neutral" },
  expired: { label: "Đã hết hạn", tone: "neutral" },
  upcoming: { label: "Chưa đến ngày", tone: "amber" },
  exhausted: { label: "Hết lượt dùng", tone: "neutral" },
};
export default function Vouchers() {
  const { axios, getToken, storeResources } = useAppContext();
  const [draft, setDraft] = useState(initial);
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const formId = useId();
  const query = search.trim().toLowerCase();
  const visibleVouchers = vouchers.filter((voucher) => voucher.code.toLowerCase().includes(query));
  const load = useCallback(async (signal) => {
    const { data } = await axios.get("/api/vouchers", { headers: { Authorization: `Bearer ${await getToken()}` }, signal });
    if (!data.success) throw new Error(data.message || "Không thể tải mã giảm giá.");
    return data.vouchers;
  }, [axios, getToken]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((items) => {
      if (!controller.signal.aborted) { setVouchers(items); setError(""); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);
  const create = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await axios.post("/api/vouchers", {
        ...draft, value: Number(draft.value),
        minSubtotal: Number(draft.minSubtotal),
        maxDiscount: draft.maxDiscount === "" ? null : Number(draft.maxDiscount),
        maxUses: Number(draft.maxUses),
        ...getVoucherValidityPeriod(draft.startsAt, draft.expiresAt),
      }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      storeResources.invalidateMembership();
      setDraft(initial); setVouchers(await load()); setShowCreate(false); toast.success("Đã tạo mã giảm giá.");
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const toggle = async (voucher) => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.patch(`/api/vouchers/${voucher._id}`, { active: !voucher.active }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      storeResources.invalidateMembership();
      setVouchers(await load());
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !deleteTarget) return;
    setBusy(true);
    setDeleteError("");
    try {
      const { data } = await axios.delete(`/api/vouchers/${deleteTarget._id}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!data.success) throw new Error(data.message || "Không thể xóa mã giảm giá.");
      setVouchers((current) => current.filter((voucher) => voucher._id !== deleteTarget._id));
      storeResources.invalidateMembership();
      setDeleteTarget(null);
      toast.success("Đã xóa mã giảm giá.");
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };
  const field = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  const retry = async () => {
    setLoading(true);
    try { setVouchers(await load()); setError(""); }
    catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  return <CatalogPage className="admin-operations-page admin-vouchers-page" title="Mã giảm giá" actions={<><RefreshButton onClick={retry} disabled={loading || busy} /><button type="button" className="perfume-button primary" onClick={() => setShowCreate(true)} disabled={busy}><Plus size={15} />Thêm mã giảm giá</button></>}>
    <div className="admin-operation-summary"><span><Ticket size={15} />Tổng cộng <strong>{loading ? "—" : vouchers.length}</strong> mã</span><span>Có thể sử dụng <strong>{loading ? "—" : vouchers.filter(voucher => getVoucherStatus(voucher) === "available").length}</strong></span><span>Đã tắt <strong>{loading ? "—" : vouchers.filter(voucher => !voucher.active).length}</strong></span></div>
    <OperationsPanel title="Danh sách mã giảm giá" description="Tra cứu điều kiện, theo dõi lượt dùng và bật/tắt từng mã." className="admin-voucher-list" actions={<Badge>{loading ? "—" : visibleVouchers.length} mã giảm giá</Badge>}>
      <div className="admin-operation-toolbar"><label className="perfume-search"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã giảm giá…" aria-label="Tìm mã giảm giá" /></label>{query && <span>{visibleVouchers.length}/{vouchers.length} kết quả</span>}</div>
      <div aria-busy={loading}>{loading ? <p role="status" className="perfume-loading">Đang tải mã giảm giá…</p> : error ? <div role="alert" className="perfume-alert">{error}<button type="button" onClick={retry}>Thử lại</button></div> : !visibleVouchers.length ? <OperationsEmptyState icon={Ticket} title={query ? "Không tìm thấy mã giảm giá phù hợp" : "Chưa có mã giảm giá nào"} description={query ? "Thử tìm kiếm với mã khác." : "Tạo ưu đãi đầu tiên cho khách hàng của Velours."}>{query ? <button type="button" className="perfume-button" onClick={() => setSearch("")}>Xóa tìm kiếm</button> : <button type="button" className="perfume-button" onClick={() => setShowCreate(true)}><Plus size={14} />Thêm mã giảm giá</button>}</OperationsEmptyState> : <div className="perfume-table-scroll"><table className="perfume-table admin-voucher-table"><caption className="sr-only">Mã giảm giá cửa hàng và trạng thái sử dụng</caption><thead><tr>{["Mã giảm giá", "Ưu đãi", "Đơn tối thiểu", "Thời hạn", "Lượt dùng", "Trạng thái", "Thao tác"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visibleVouchers.map(voucher => {
        const status = voucherStatuses[getVoucherStatus(voucher)];
        return <tr key={voucher._id}><td><strong className="admin-voucher-code">{voucher.code}</strong></td><td><strong className="admin-operation-nowrap">{voucher.type === "percent" ? `${voucher.value}%` : formatVnd(voucher.value)}</strong>{voucher.maxDiscount != null && <small>Tối đa {formatVnd(voucher.maxDiscount)}</small>}</td><td className="admin-operation-nowrap">{formatVnd(voucher.minSubtotal)}</td><td><span className="admin-operation-nowrap">{formatVoucherDate(voucher.startsAt)}</span><small className="admin-operation-nowrap">Đến {formatVoucherExpiryDate(voucher.expiresAt)}</small></td><td className="admin-operation-nowrap">{voucher.usedCount} / {voucher.maxUses}</td><td><div className="admin-voucher-status"><label className="admin-toggle-switch"><input type="checkbox" role="switch" checked={voucher.active} disabled={busy} onChange={() => toggle(voucher)} aria-label={`${voucher.active ? "Tắt" : "Bật"} mã giảm giá ${voucher.code}`} /><span aria-hidden="true" /></label><Badge tone={status.tone}>{status.label}</Badge></div></td><td><button type="button" className="perfume-icon-button admin-danger-action" disabled={busy} aria-label={`Xóa mã giảm giá ${voucher.code}`} onClick={() => { setDeleteError(""); setDeleteTarget(voucher); }}><Trash2 size={15} /></button></td></tr>;
      })}</tbody></table></div>}</div>
    </OperationsPanel>
    {showCreate && <OperationsDrawer title="Tạo mã giảm giá" description="Mỗi khách dùng một lần cho mỗi mã. Tiền tệ: VND." busy={busy} onClose={() => setShowCreate(false)} footer={<><button type="button" className="perfume-button" disabled={busy} onClick={() => setShowCreate(false)}>Hủy</button><button type="submit" form={formId} disabled={busy} className="perfume-button primary">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}{busy ? "Đang xử lý…" : "Tạo mã giảm giá"}</button></>}>
      <form id={formId} onSubmit={create} className="admin-operation-form"><fieldset disabled={busy} className="perfume-form-grid"><legend className="sr-only">Thông tin mã giảm giá</legend>
        <label className="perfume-field admin-field-full"><span>Mã giảm giá <i>*</i></span><input name="code" type="text" required maxLength={40} pattern="[A-Za-z0-9-]{3,40}" value={draft.code} onChange={event => field("code", event.target.value.toUpperCase())} placeholder="VD: VELOURS10" autoComplete="off" /></label>
        <label className="perfume-field admin-field-full"><span>Loại giảm <i>*</i></span><select name="type" value={draft.type} onChange={event => { field("type", event.target.value); field("value", ""); }}><option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền (VND)</option></select></label>
        {[["value", draft.type === "percent" ? "Mức giảm (%)" : "Mức giảm (VND)", "number", true], ["minSubtotal", "Đơn tối thiểu (VND)", "number", true], ["maxDiscount", "Giảm tối đa (VND)", "number", false], ["maxUses", "Tổng lượt dùng", "number", true], ["startsAt", "Bắt đầu", "date", true], ["expiresAt", "Hết hạn", "date", true]].map(([name, label, type, required]) => <label key={name} className="perfume-field"><span>{label}{required && <i> *</i>}</span><input name={name} type={type} required={required} min={type === "number" ? name === "minSubtotal" ? 0 : 1 : name === "expiresAt" ? draft.startsAt || undefined : undefined} max={name === "value" && draft.type === "percent" ? 100 : undefined} placeholder={name === "maxDiscount" ? "Không giới hạn" : undefined} value={draft[name]} onChange={event => field(name, event.target.value)} /></label>)}
      </fieldset><p className="admin-form-help">Thời hạn tính từ ngày bắt đầu đến hết ngày hết hạn theo giờ Việt Nam.</p></form>
    </OperationsDrawer>}
    {deleteTarget && <DeleteVoucherDialog voucher={deleteTarget} busy={busy} error={deleteError} onCancel={() => { if (!busy) setDeleteTarget(null); }} onConfirm={remove} />}
  </CatalogPage>;
}
