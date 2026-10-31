import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Ticket, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { formatVnd } from "../../utils/money";
import { formatVoucherExpiryDate } from "../../utils/voucherDates";

const CheckoutVoucherPicker = ({ checkout, subtotal, disabled, compact = false }) => {
  const { user, currency, storeResources } = useAppContext();
  const popupId = useId();
  const titleId = useId();
  const codeId = useId();
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(checkout.voucherCode);
  const [wallet, setWallet] = useState(null);
  const [loadedAt, setLoadedAt] = useState(Date.now);
  const [attempt, setAttempt] = useState(0);
  const currentWallet = wallet?.userId === user?.id ? wallet : null;
  const vouchers = (currentWallet?.vouchers || []).filter((voucher) => new Date(voucher.expiresAt).getTime() > loadedAt);
  const appliedCode = checkout.ready ? checkout.pricing.voucherCode : "";
  const hasAppliedVoucher = Boolean(appliedCode);
  const displayedCode = appliedCode || checkout.voucherCode;
  const isReplacingVoucher = Boolean(checkout.voucherCode && draft.trim().toUpperCase() !== checkout.voucherCode.trim().toUpperCase());
  const formatPrice = (value) => formatVnd(value, currency);

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
    let active = true;
    const loadWallet = async () => {
      try {
        const result = await storeResources.loadMembership();
        if (active) { setWallet(result); setLoadedAt(Date.now()); }
      } catch (error) {
        if (active && error.name !== "AbortError") setWallet({ userId: user.id, error: error.response?.data?.message || error.message });
      }
    };
    loadWallet();
    return () => { active = false; };
  }, [isOpen, user?.id, storeResources, attempt]);

  const closePopup = () => {
    popupRef.current?.hidePopover();
    triggerRef.current?.focus();
  };
  const preparePopup = () => {
    if (popupRef.current.matches(":popover-open")) return;
    setDraft(checkout.voucherCode);
    setWallet(storeResources.peekMembership() || null);
    setLoadedAt(Date.now());
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
  const voucherTrigger = (
    <button ref={triggerRef} type="button" popoverTarget={popupId} disabled={disabled} aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={popupId}
      aria-label={hasAppliedVoucher ? "Đổi mã giảm giá" : "Chọn mã giảm giá"}
      onClick={preparePopup} className={compact ? "inessa-cart-coupon-picker" : "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-secondary/20 bg-white px-4 py-2.5 text-sm font-medium text-secondary transition hover:bg-secondary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50"}>
      <Ticket size={compact ? 14 : 16} aria-hidden="true" />
      <span>{compact ? hasAppliedVoucher ? "Đổi mã" : "Chọn mã" : hasAppliedVoucher ? "Đổi mã giảm giá" : "Chọn mã giảm giá"}</span>
    </button>
  );

  return (
    <>
      <div className={compact ? "inessa-cart-coupon" : "flex flex-wrap items-center justify-between gap-4"}>
        {!compact && <div>
          <h2 className="flex items-center gap-2 font-semibold"><Ticket size={20} className="text-secondary" aria-hidden="true" />Mã giảm giá cửa hàng</h2>
          <p className="mt-2 text-sm text-gray-500">Mỗi đơn hàng chỉ áp dụng 1 mã giảm giá.</p>
        </div>}
        {!compact && voucherTrigger}
        {compact && <div className="inessa-cart-coupon-input">
          <div className="inessa-cart-coupon-field">
            <label htmlFor={`${codeId}-inline`} className="sr-only">Mã giảm giá</label>
            <input id={`${codeId}-inline`} value={draft} maxLength={40} disabled={disabled}
              onChange={(event) => setDraft(event.target.value.toUpperCase())}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyVoucher(); } }}
              placeholder="Mã giảm giá" />
            {voucherTrigger}
          </div>
          <button type="button" onClick={applyVoucher} disabled={disabled || checkout.loading || !draft.trim()} className="btn-dark">Áp dụng</button>
        </div>}
      </div>
      {displayedCode && <div className={`mt-4 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${hasAppliedVoucher ? "border-green-200 bg-green-50/60" : "border-gray-200 bg-primary/60"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${hasAppliedVoucher ? "bg-green-100 text-green-700" : "bg-secondary/10 text-secondary"}`}>
            <Ticket size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={`flex items-center gap-1.5 text-xs font-medium ${hasAppliedVoucher ? "text-green-700" : "text-gray-500"}`}>
              {hasAppliedVoucher && <Check size={14} aria-hidden="true" />}
              {hasAppliedVoucher ? "Đã áp dụng mã giảm giá" : checkout.loading ? "Đang kiểm tra mã" : "Mã chưa được áp dụng"}
            </p>
            <p className="mt-1 break-all font-mono text-base font-semibold tracking-wide text-secondary">{displayedCode}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6">
          {hasAppliedVoucher && <div className="sm:text-right">
            <p className="text-xs text-green-700">Bạn tiết kiệm</p>
            <p className="mt-1 whitespace-nowrap text-lg font-semibold text-green-700">{formatPrice(checkout.pricing.discount)}</p>
          </div>}
          <button type="button" disabled={disabled} onClick={removeVoucher} aria-label={`Bỏ mã giảm giá ${displayedCode}`}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <X size={15} aria-hidden="true" />Bỏ mã
          </button>
        </div>
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
            <h3 id={titleId} className="font-semibold">Mã giảm giá của Velours</h3>
            <button type="button" onClick={closePopup} aria-label="Đóng bảng mã giảm giá" className="cursor-pointer rounded-md p-1 hover:bg-primary"><X size={18} /></button>
          </div>
          <fieldset disabled={disabled} className="shrink-0 bg-primary/60 p-4">
            <legend className="sr-only">Nhập mã giảm giá</legend>
            <p className="mb-3 text-xs leading-relaxed text-gray-500">Chỉ áp dụng 1 mã cho mỗi đơn hàng. Áp dụng mã mới sẽ thay thế mã hiện tại.</p>
            <div className="flex items-center gap-2">
              <label htmlFor={codeId} className="shrink-0 text-xs">Mã Mã giảm giá</label>
              <input id={codeId} value={draft} maxLength={40} onChange={(event) => setDraft(event.target.value.toUpperCase())}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyVoucher(); } }}
                placeholder="Nhập mã giảm giá của cửa hàng" className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-2 text-xs focus:outline-secondary" />
              <button type="button" onClick={applyVoucher} disabled={checkout.loading || !draft.trim()}
                className="btn-outline shrink-0 !rounded-full !px-3 !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-40">{isReplacingVoucher ? "THAY MÃ" : "ÁP DỤNG"}</button>
            </div>
            {checkout.loading && <p role="status" className="mt-3 text-xs text-gray-500">Đang kiểm tra mã giảm giá…</p>}
            {checkout.error && <p role="alert" className="mt-3 text-xs text-red-600">{checkout.error}</p>}
            {hasAppliedVoucher && <p role="status" className="mt-3 flex items-center gap-1 text-xs text-green-700"><Check size={14} aria-hidden="true" />Đã áp dụng {appliedCode}: giảm {formatPrice(checkout.pricing.discount)}.</p>}
          </fieldset>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {!user ? <p className="py-12 text-center text-gray-500">Đăng nhập để xem mã giảm giá của bạn.</p>
              : !currentWallet ? <p role="status" className="py-12 text-center text-gray-500">Đang tải mã giảm giá…</p>
              : currentWallet.error ? <div role="alert" className="py-8 text-center text-gray-500">{currentWallet.error}
                <button type="button" onClick={() => { setWallet(null); setAttempt((value) => value + 1); }} className="mt-3 block w-full cursor-pointer text-secondary underline">Thử lại</button>
              </div>
              : vouchers.length === 0 ? <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
                <Ticket size={52} strokeWidth={1} className="text-gray-300" aria-hidden="true" />
                <p>Chưa có mã giảm giá có thể sử dụng</p>
                <p className="max-w-64 text-xs text-gray-500">Chỉ hiển thị mã đang có hiệu lực, còn lượt và bạn chưa sử dụng. Bạn có thể nhập mã ở trên để kiểm tra.</p>
              </div>
              : <div className="space-y-3">{vouchers.map((voucher) => {
                const eligible = subtotal >= voucher.minSubtotal;
                return <button key={voucher._id} type="button" disabled={disabled || !eligible} aria-pressed={draft === voucher.code}
                  onClick={() => setDraft(voucher.code)} className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border border-dashed p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${draft === voucher.code ? "border-secondary bg-secondary/5" : "border-gray-200 hover:border-secondary"}`}>
                  <Ticket size={24} className="mt-1 shrink-0 text-secondary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{voucher.kind === "birthday" ? "Quà sinh nhật" : "Ưu đãi cửa hàng"} · Giảm {voucher.type === "percent" ? `${voucher.value}%` : formatPrice(voucher.value)}</span>
                    {voucher.maxDiscount != null && <span className="mt-1 block text-xs text-gray-500">Tối đa {formatPrice(voucher.maxDiscount)}</span>}
                    <span className="mt-1 block text-xs text-gray-500">Đơn từ {formatPrice(voucher.minSubtotal)} · HSD {formatVoucherExpiryDate(voucher.expiresAt)}</span>
                    <span className="mt-2 block break-all text-xs font-medium text-secondary">{voucher.code}</span>
                    {!eligible && <span className="mt-1 block text-xs text-red-600">Cần thêm {formatPrice(voucher.minSubtotal - subtotal)} để sử dụng</span>}
                  </span>
                  {draft === voucher.code && <Check size={16} className="shrink-0 text-secondary" aria-hidden="true" />}
                </button>;
              })}</div>}
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckoutVoucherPicker;
