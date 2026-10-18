import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LoaderCircle, Plus, Search, Ticket } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { formatThousandsVnd } from "../../utils/money";
import { getVoucherValidityPeriod, getVoucherStatus, formatVoucherDate, formatVoucherExpiryDate } from "../../utils/voucherDates";

const initial = { code: "", type: "percent", value: 10, minSubtotal: 0, maxDiscount: "", maxUses: 100, startsAt: "", expiresAt: "" };
const voucherStatuses = {
  available: { label: "Có thể sử dụng", style: "bg-[#edf6ee] text-[#557b5e]" },
  inactive: { label: "Đã tắt", style: "bg-[#f0f2f3] text-[#839099]" },
  expired: { label: "Đã hết hạn", style: "bg-red-50 text-red-700" },
  upcoming: { label: "Chưa đến ngày", style: "bg-amber-50 text-amber-700" },
  exhausted: { label: "Hết lượt dùng", style: "bg-[#f0f2f3] text-[#839099]" },
};
export default function Vouchers() {
  const { axios, getToken, storeResources } = useAppContext();
  const [draft, setDraft] = useState(initial);
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visibleVouchers = vouchers.filter((voucher) => voucher.code.toLowerCase().includes(query));
  const load = useCallback(async (signal) => {
    const { data } = await axios.get("/api/vouchers", { headers: { Authorization: `Bearer ${await getToken()}` }, signal });
    if (!data.success) throw new Error(data.message || "Không thể tải voucher.");
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
        ...draft, value: Number(draft.value) / (draft.type === "fixed" ? 1000 : 1),
        minSubtotal: Number(draft.minSubtotal) / 1000,
        maxDiscount: draft.maxDiscount === "" ? null : Number(draft.maxDiscount) / 1000,
        maxUses: Number(draft.maxUses),
        ...getVoucherValidityPeriod(draft.startsAt, draft.expiresAt),
      }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      storeResources.invalidateMembership();
      setDraft(initial); setVouchers(await load()); toast.success("Đã tạo voucher.");
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
  const field = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  const retry = async () => {
    setLoading(true);
    try { setVouchers(await load()); setError(""); }
    catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  return (
    <main className="m-1 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain rounded-xl bg-primary px-3 py-6 shadow sm:m-3 sm:px-5 md:px-8 xl:py-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#e1e6e3] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#6f9a79]">Ưu đãi cửa hàng</p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#263b4a] sm:text-3xl">Quản lý voucher</h1>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d8e5da] bg-[#edf6ee] px-3 py-1.5 text-xs font-medium text-[#557b5e]">
            <Ticket size={15} aria-hidden="true" />{loading ? "—" : vouchers.length} voucher
          </span>
        </header>

        <div className="space-y-6">
          <section aria-labelledby="voucher-details-title" className="rounded-2xl border border-[#e2e7e4] bg-white p-5 shadow-sm sm:p-6">
            <h2 id="voucher-details-title" className="text-lg font-semibold text-[#263b4a]">Tạo voucher mới</h2>
            <p className="mt-2 text-sm text-[#839099]">Mỗi đơn áp dụng 1 mã. Mỗi khách dùng một lần cho mỗi mã.</p>
            <form onSubmit={create} className="mt-5">
              <fieldset disabled={busy} className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <legend className="sr-only">Thông tin voucher</legend>
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-medium text-[#334957]">Mã voucher <span className="text-[#b55f5f]">*</span></span>
                  <input type="text" required maxLength={40} pattern="[A-Za-z0-9-]{3,40}" value={draft.code}
                    onChange={(event) => field("code", event.target.value.toUpperCase())} placeholder="VD: VELOURS10" autoComplete="off"
                    className="admin-input font-mono" />
                </label>
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-medium text-[#334957]">Loại giảm <span className="text-[#b55f5f]">*</span></span>
                  <select value={draft.type} onChange={(event) => { field("type", event.target.value); field("value", ""); }} className="admin-input">
                    <option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền (VNĐ)</option>
                  </select>
                </label>
                {[
                  ["value", draft.type === "percent" ? "Mức giảm (%)" : "Mức giảm (VNĐ)", "number", true],
                  ["minSubtotal", "Đơn tối thiểu (VNĐ)", "number", true],
                  ["maxDiscount", "Giảm tối đa (VNĐ)", "number", false],
                  ["maxUses", "Tổng lượt dùng", "number", true],
                  ["startsAt", "Bắt đầu", "date", true],
                  ["expiresAt", "Hết hạn", "date", true],
                ].map(([name, label, type, required]) => (
                  <label key={name} className="block min-w-0">
                    <span className="mb-2 block text-sm font-medium text-[#334957]">{label}{required && <span className="text-[#b55f5f]"> *</span>}</span>
                    <input type={type} required={required}
                      min={type === "number" ? name === "minSubtotal" ? 0 : 1 : name === "expiresAt" ? draft.startsAt || undefined : undefined}
                      max={name === "value" && draft.type === "percent" ? 100 : undefined}
                      placeholder={name === "maxDiscount" ? "Không giới hạn" : undefined}
                      value={draft[name]} onChange={(event) => field(name, event.target.value)} className="admin-input" />
                  </label>
                ))}
              </fieldset>
              <div className="mt-6 flex flex-col gap-4 border-t border-[#edf0f2] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-xs leading-relaxed text-[#839099]">Voucher có hiệu lực từ ngày bắt đầu đến hết ngày hết hạn theo giờ Việt Nam.</p>
                <button type="submit" disabled={busy} className="admin-primary-button shrink-0 cursor-pointer justify-center">
                  {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
                  {busy ? "Đang xử lý…" : "Tạo voucher"}
                </button>
              </div>
            </form>
          </section>

          <section aria-labelledby="voucher-list-title" className="min-w-0 overflow-hidden rounded-2xl border border-[#e2e7e4] bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[#edf0f2] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 id="voucher-list-title" className="text-lg font-semibold text-[#263b4a]">Danh sách voucher</h2>
                <span className="rounded-full bg-[#edf6ee] px-3 py-1 text-xs font-medium text-[#557b5e]">{loading ? "—" : visibleVouchers.length} voucher</span>
              </div>
              <label className="relative block w-full sm:max-w-sm">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#839099]" aria-hidden="true" />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã voucher…"
                  aria-label="Tìm mã voucher" className="admin-input !pl-10" />
              </label>
            </div>
            <div aria-busy={loading}>
              {loading ? <p role="status" className="py-12 text-center text-sm text-[#839099]">Đang tải voucher…</p>
                : error ? <div role="alert" className="px-5 py-8 text-center text-sm text-[#b55f5f]">
                  {error}<button type="button" onClick={retry} className="ml-3 cursor-pointer font-medium underline">Thử lại</button>
                </div>
                : !visibleVouchers.length ? <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                  <Ticket size={36} strokeWidth={1.5} className="text-[#a2b6a7]" aria-hidden="true" />
                  <p className="text-sm font-medium text-[#52616b]">{query ? "Không tìm thấy mã voucher phù hợp." : "Chưa có voucher nào."}</p>
                  <p className="text-xs text-[#839099]">{query ? "Thử tìm bằng mã khác." : "Tạo voucher đầu tiên bằng biểu mẫu phía trên."}</p>
                </div>
                : <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <caption className="sr-only">Voucher cửa hàng và trạng thái sử dụng</caption>
                    <thead>
                      <tr className="border-b border-[#edf0f2] bg-[#fafbfb] text-[#69747e]">
                        {["Mã voucher", "Ưu đãi", "Đơn tối thiểu", "Thời hạn", "Lượt dùng", "Trạng thái"].map((label) => (
                          <th key={label} scope="col" className="px-5 py-3 font-medium">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf0f2]">
                      {visibleVouchers.map((voucher) => {
                        const status = voucherStatuses[getVoucherStatus(voucher)];
                        return (
                        <tr key={voucher._id} className="transition-colors hover:bg-[#f1f3f2]">
                          <th scope="row" className="px-5 py-4 font-mono font-semibold text-[#263b4a]">
                            <span className="break-all">{voucher.code}</span>
                          </th>
                          <td className="px-5 py-4">
                            <span className="whitespace-nowrap font-medium text-[#263b4a]">Giảm {voucher.type === "percent" ? `${voucher.value}%` : formatThousandsVnd(voucher.value)}</span>
                            {voucher.maxDiscount != null && <p className="mt-1 text-xs text-[#839099]">Tối đa {formatThousandsVnd(voucher.maxDiscount)}</p>}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-[#52616b]">{formatThousandsVnd(voucher.minSubtotal)}</td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="text-[#52616b]">{formatVoucherDate(voucher.startsAt)}</span>
                            <p className="mt-1 text-xs text-[#839099]">Đến {formatVoucherExpiryDate(voucher.expiresAt)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="whitespace-nowrap font-medium text-[#52616b]">{voucher.usedCount} / {voucher.maxUses}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <label className={`relative inline-flex shrink-0 items-center ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                                <input type="checkbox" role="switch" className="peer sr-only" checked={voucher.active} disabled={busy}
                                  onChange={() => toggle(voucher)} aria-label={`${voucher.active ? "Tắt" : "Bật"} mã voucher ${voucher.code}`} />
                                <span className="h-5 w-9 rounded-full bg-[#d6dde0] transition peer-checked:bg-[#78a782] peer-focus-visible:ring-2 peer-focus-visible:ring-[#b8d2be]" />
                                <span className="absolute left-1 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                              </label>
                              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${status.style}`}>
                                {status.label}
                              </span>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
