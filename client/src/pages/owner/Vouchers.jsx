import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { formatThousandsVnd } from "../../utils/money";

const initial = { code: "", type: "percent", value: 10, minSubtotal: 0, maxDiscount: "", maxUses: 100, startsAt: "", expiresAt: "" };
export default function Vouchers() {
  const { axios, getToken } = useAppContext();
  const [draft, setDraft] = useState(initial);
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (signal) => {
    const { data } = await axios.get("/api/vouchers", { headers: { Authorization: `Bearer ${await getToken()}` }, signal });
    return data.vouchers;
  }, [axios, getToken]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((items) => {
      if (!controller.signal.aborted) { setVouchers(items); setError(""); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || err.message); });
    return () => controller.abort();
  }, [load]);
  const create = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await axios.post("/api/vouchers", {
        ...draft, value: Number(draft.value) / (draft.type === "fixed" ? 1000 : 1),
        minSubtotal: Number(draft.minSubtotal) / 1000,
        maxDiscount: draft.maxDiscount === "" ? null : Number(draft.maxDiscount) / 1000,
        maxUses: Number(draft.maxUses),
        startsAt: new Date(`${draft.startsAt}:00+07:00`).toISOString(),
        expiresAt: new Date(`${draft.expiresAt}:00+07:00`).toISOString(),
      }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      setDraft(initial); setVouchers(await load()); toast.success("Đã tạo voucher.");
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const toggle = async (voucher) => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.patch(`/api/vouchers/${voucher._id}`, { active: !voucher.active }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      setVouchers(await load());
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const field = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  return <div className="w-full p-6 lg:p-10">
    <h1 className="text-2xl font-semibold">Quản lý voucher</h1>
    <p className="mt-2 text-sm text-gray-500">Mỗi khách dùng một lần cho mỗi mã. Các thời điểm bên dưới theo giờ Việt Nam.</p>
    <form onSubmit={create} className="mt-6 grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
      <fieldset disabled={busy} className="contents">
        <label className="text-sm">Mã voucher<input required maxLength={40} pattern="[A-Za-z0-9-]{3,40}" value={draft.code}
          onChange={(event) => field("code", event.target.value.toUpperCase())} className="mt-1 block w-full rounded border p-2" /></label>
        <label className="text-sm">Loại giảm<select value={draft.type} onChange={(event) => { field("type", event.target.value); field("value", ""); }} className="mt-1 block w-full rounded border p-2">
          <option value="percent">Phần trăm</option><option value="fixed">Số tiền (VNĐ)</option></select></label>
        {[
          ["value", draft.type === "percent" ? "Mức giảm (%)" : "Mức giảm (VNĐ)", "number", true],
          ["minSubtotal", "Đơn tối thiểu (VNĐ)", "number", true],
          ["maxDiscount", "Giảm tối đa (VNĐ, có thể để trống)", "number", false],
          ["maxUses", "Tổng lượt dùng", "number", true],
          ["startsAt", "Bắt đầu (giờ Việt Nam)", "datetime-local", true],
          ["expiresAt", "Hết hạn (giờ Việt Nam)", "datetime-local", true],
        ].map(([name, label, type, required]) => <label key={name} className="text-sm">{label}
          <input type={type} required={required} min={type === "number" ? name === "minSubtotal" ? 0 : 1 : undefined}
            max={name === "value" && draft.type === "percent" ? 100 : undefined}
            value={draft[name]} onChange={(event) => field(name, event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>)}
        <button className="btn-dark !rounded-md sm:col-span-2">{busy ? "Đang xử lý…" : "Tạo voucher"}</button>
      </fieldset>
    </form>
    {error && <div role="alert" className="mt-4 text-red-600">{error}<button onClick={() => load().then((items) => { setVouchers(items); setError(""); }).catch((err) => setError(err.message))} className="ml-3 underline">Thử lại</button></div>}
    <div className="mt-6 space-y-3">{vouchers.map((voucher) => <article key={voucher._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div><h2 className="font-mono font-semibold">{voucher.code}</h2>
        <p className="text-sm">Giảm {voucher.type === "percent" ? `${voucher.value}%` : formatThousandsVnd(voucher.value)} · {voucher.usedCount}/{voucher.maxUses} lượt</p>
        <p className="text-xs text-gray-500">Hết hạn: {new Date(voucher.expiresAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {voucher.active ? "Đang bật" : "Đã tắt"}</p></div>
      <button disabled={busy} onClick={() => toggle(voucher)} className="btn-outline !rounded-md">{voucher.active ? "Tắt" : "Bật"}</button>
    </article>)}</div>
  </div>;
}
