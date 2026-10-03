import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Ticket, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { formatThousandsVnd } from "../../utils/money";

const CheckoutVoucherPicker = ({ checkout, subtotal, disabled }) => {
  const { user, axios, getToken, currency } = useAppContext();
  const popupId = useId();
  const titleId = useId();
  const codeId = useId();
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(checkout.voucherCode);
  const [wallet, setWallet] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const currentWallet = wallet?.userId === user?.id ? wallet : null;
  const formatPrice = (value) => formatThousandsVnd(value, currency);

  const positionPopup = () => {
    const popup = popupRef.current;
    const trigger = triggerRef.current;
    if (!popup || !trigger) return;
    const anchor = trigger.getBoundingClientRect();
    const bounds = popup.getBoundingClientRect();
    const left = Math.max(16, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 16));
    const below = anchor.bottom + 12;
    const top = below + bounds.height <= window.innerHeight - 16
      ? below
      : Math.max(16, anchor.top - bounds.height - 12);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };

  useLayoutEffect(() => {
    if (isOpen) positionPopup();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user?.id) return undefined;
    const controller = new AbortController();
    const loadWallet = async () => {
      try {
        const { data } = await axios.get("/api/vouchers/mine", {
          headers: { Authorization: `Bearer ${await getToken()}` },
          signal: controller.signal,
          timeout: 15000,
        });
        if (!data.success) throw new Error(data.message || "Không thể tải voucher.");
        if (!controller.signal.aborted) setWallet({ userId: user.id, vouchers: data.vouchers || [] });
      } catch (error) {
        if (!controller.signal.aborted) setWallet({ userId: user.id, error: error.response?.data?.message || error.message });
      }
    };
    loadWallet();
    return () => controller.abort();
  }, [isOpen, user?.id, axios, getToken, attempt]);

  const closePopup = () => {
    popupRef.current?.hidePopover();
    triggerRef.current?.focus();
  };
  const preparePopup = () => {
    if (popupRef.current.matches(":popover-open")) return;
    setDraft(checkout.voucherCode);
    setWallet(null);
  };
  const applyVoucher = () => {
    if (disabled || checkout.loading || !draft.trim()) return;
    checkout.setVoucherCode(draft.trim());
    checkout.refresh();
  };
  const removeVoucher = () => {
    checkout.setVoucherCode("");
    setDraft("");
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Ticket size={20} className="text-secondary" aria-hidden="true" />Voucher cửa hàng</h2>
        <button ref={triggerRef} type="button" popoverTarget={popupId} disabled={disabled} aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={popupId}
          onClick={preparePopup} className="cursor-pointer rounded-md px-2 py-2 text-sm font-medium text-secondary underline underline-offset-4 disabled:opacity-50">
          Chọn Voucher
        </button>
      </div>
      {checkout.voucherCode && <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-sm">
        <span className="break-all">{checkout.voucherCode}</span>
        {checkout.ready && <span className="text-green-700">−{formatPrice(checkout.pricing.discount)}</span>}
        <button type="button" disabled={disabled} onClick={removeVoucher} className="cursor-pointer text-secondary underline disabled:opacity-50">Bỏ mã</button>
      </div>}
      {checkout.loading && <p role="status" className="mt-2 text-sm text-gray-500">Đang tính tổng tiền…</p>}
      {checkout.error && <div role="alert" className="mt-2 text-sm text-red-600">{checkout.error}
        <button type="button" disabled={disabled} onClick={checkout.refresh} className="ml-2 cursor-pointer underline disabled:opacity-50">Thử lại</button>
      </div>}

      <div ref={popupRef} id={popupId} popover="auto" role="dialog" aria-labelledby={titleId}
        onToggle={(event) => {
          const open = event.newState === "open";
          setIsOpen(open);
          if (open) {
            positionPopup();
            popupRef.current.querySelector("input")?.focus();
          }
        }}
        className="fixed inset-auto m-0 h-[min(540px,calc(100dvh-32px))] w-[420px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-gray-200 bg-white p-0 text-sm text-tertiary shadow-xl">
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <h3 id={titleId} className="font-semibold">Voucher của Velours</h3>
            <button type="button" onClick={closePopup} aria-label="Đóng bảng voucher" className="cursor-pointer rounded-md p-1 hover:bg-primary"><X size={18} /></button>
          </div>
          <fieldset disabled={disabled} className="shrink-0 bg-primary/60 p-4">
            <legend className="sr-only">Nhập mã voucher</legend>
            <div className="flex items-center gap-2">
              <label htmlFor={codeId} className="shrink-0 text-xs">Mã Voucher</label>
              <input id={codeId} value={draft} maxLength={40} onChange={(event) => setDraft(event.target.value.toUpperCase())}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyVoucher(); } }}
                placeholder="Nhập mã voucher của cửa hàng" className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-2 text-xs focus:outline-secondary" />
              <button type="button" onClick={applyVoucher} disabled={checkout.loading || !draft.trim()}
                className="btn-outline shrink-0 !rounded-md !px-3 !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-40">ÁP DỤNG</button>
            </div>
            {checkout.loading && <p role="status" className="mt-3 text-xs text-gray-500">Đang kiểm tra voucher…</p>}
            {checkout.error && <p role="alert" className="mt-3 text-xs text-red-600">{checkout.error}</p>}
            {checkout.ready && checkout.voucherCode && <p role="status" className="mt-3 flex items-center gap-1 text-xs text-green-700"><Check size={14} />Đã áp dụng {checkout.voucherCode}: giảm {formatPrice(checkout.pricing.discount)}.</p>}
          </fieldset>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {!user ? <p className="py-12 text-center text-gray-500">Đăng nhập để xem voucher của bạn.</p>
              : !currentWallet ? <p role="status" className="py-12 text-center text-gray-500">Đang tải voucher…</p>
              : currentWallet.error ? <div role="alert" className="py-8 text-center text-gray-500">{currentWallet.error}
                <button type="button" onClick={() => { setWallet(null); setAttempt((value) => value + 1); }} className="mt-3 block w-full cursor-pointer text-secondary underline">Thử lại</button>
              </div>
              : currentWallet.vouchers.length === 0 ? <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
                <Ticket size={52} strokeWidth={1} className="text-gray-300" aria-hidden="true" />
                <p>Chưa có mã giảm giá nào của cửa hàng</p>
                <p className="max-w-64 text-xs text-gray-500">Nhập mã giảm giá có thể sử dụng vào thanh bên trên.</p>
              </div>
              : <div className="space-y-3">{currentWallet.vouchers.map((voucher) => {
                const eligible = subtotal >= voucher.minSubtotal;
                return <button key={voucher._id} type="button" disabled={disabled || !eligible} aria-pressed={draft === voucher.code}
                  onClick={() => setDraft(voucher.code)} className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border border-dashed p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${draft === voucher.code ? "border-secondary bg-secondary/5" : "border-gray-200 hover:border-secondary"}`}>
                  <Ticket size={24} className="mt-1 shrink-0 text-secondary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{voucher.kind === "birthday" ? "Quà sinh nhật" : "Ưu đãi cửa hàng"} · Giảm {voucher.type === "percent" ? `${voucher.value}%` : formatPrice(voucher.value)}</span>
                    {voucher.maxDiscount != null && <span className="mt-1 block text-xs text-gray-500">Tối đa {formatPrice(voucher.maxDiscount)}</span>}
                    <span className="mt-1 block text-xs text-gray-500">Đơn từ {formatPrice(voucher.minSubtotal)} · HSD {new Date(voucher.expiresAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
                    <span className="mt-2 block break-all text-xs font-medium text-secondary">{voucher.code}</span>
                    {!eligible && <span className="mt-1 block text-xs text-red-600">Cần thêm {formatPrice(voucher.minSubtotal - subtotal)} để sử dụng</span>}
                  </span>
                  {draft === voucher.code && <Check size={16} className="shrink-0 text-secondary" aria-hidden="true" />}
                </button>;
              })}</div>}
          </div>
          <div className="flex shrink-0 justify-end border-t border-gray-100 px-5 py-3">
            <button type="button" onClick={closePopup} className="btn-dark !rounded-md !px-5 !py-2">Xong</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckoutVoucherPicker;
