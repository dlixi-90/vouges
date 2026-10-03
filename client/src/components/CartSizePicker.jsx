import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { getSizeQuantity, isSizeAvailable } from "../utils/productStock";

const CartSizePicker = ({ product, size, quantity, quantities, disabled, onConfirm }) => {
  const popupId = useId();
  const titleId = useId();
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [draftSize, setDraftSize] = useState(size);
  const [isOpen, setIsOpen] = useState(false);
  const requiredQuantity = quantity + (draftSize === size ? 0 : Number(quantities?.[draftSize] ?? 0));
  const canConfirm = draftSize === size || (
    product.sizes.includes(draftSize) &&
    isSizeAvailable(product, draftSize) &&
    requiredQuantity <= getSizeQuantity(product, draftSize)
  );

  const positionPopup = () => {
    const popup = popupRef.current;
    const trigger = triggerRef.current;
    if (!popup || !trigger) return;
    const anchor = trigger.getBoundingClientRect();
    const bounds = popup.getBoundingClientRect();
    const left = Math.max(16, Math.min(anchor.left, window.innerWidth - bounds.width - 16));
    const below = anchor.bottom + 12;
    const top = below + bounds.height <= window.innerHeight - 16
      ? below
      : Math.max(16, anchor.top - bounds.height - 12);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  };

  useLayoutEffect(() => {
    if (isOpen) positionPopup();
  }, [isOpen, draftSize, disabled]);

  useEffect(() => {
    if (!isOpen) return undefined;
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
    };
  }, [isOpen]);

  const closePopup = () => {
    popupRef.current?.hidePopover();
    triggerRef.current?.focus();
  };

  const togglePopup = () => {
    if (popupRef.current.matches(":popover-open")) {
      closePopup();
      return;
    }
    setDraftSize(size);
    popupRef.current.showPopover();
    positionPopup();
    popupRef.current.querySelector(`button[aria-pressed="true"]:not(:disabled), button:not(:disabled)`)?.focus();
  };

  const confirmSize = async () => {
    if (disabled || !canConfirm) return;
    if (draftSize === size) return closePopup();
    const result = await onConfirm(draftSize);
    if (result?.success) closePopup();
  };

  return (
    <div className="min-w-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={popupId}
        aria-label={`Change size for ${product.title}, currently ${size}`}
        onClick={togglePopup}
        className="flex max-w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-500 transition hover:bg-primary focus-visible:outline-2 focus-visible:outline-secondary disabled:opacity-50"
      >
        <span className="min-w-0">
          <span className="block">Variation</span>
          <span className="mt-1 block truncate font-medium text-secondary">Size: {size}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <div
        ref={popupRef}
        id={popupId}
        popover="auto"
        role="dialog"
        aria-labelledby={titleId}
        aria-busy={disabled}
        onToggle={(event) => setIsOpen(event.newState === "open")}
        className="fixed inset-auto m-0 max-h-[calc(100dvh-32px)] w-[420px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-0 text-sm text-tertiary shadow-xl"
      >
        <div className="p-5 sm:p-6">
          <h3 id={titleId} className="font-semibold">Choose variation</h3>
          <p className="mt-1 truncate">{product.title}</p>
          <div className="mt-5 flex items-start gap-4">
            <span className="pt-2 text-gray-500">Size:</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Available sizes">
              {Array.from(new Set([size, ...product.sizes])).map((option) => {
                const required = quantity + (option === size ? 0 : Number(quantities?.[option] ?? 0));
                const available = product.sizes.includes(option) && isSizeAvailable(product, option);
                const enoughStock = required <= getSizeQuantity(product, option);
                const reason = !available ? "Out of stock" : !enoughStock ? "Insufficient stock" : "";
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={draftSize === option}
                    aria-label={`Size ${option}${reason ? `, ${reason}` : ""}`}
                    title={reason || `Size ${option}`}
                    disabled={disabled || (option !== size && !available)}
                    onClick={() => setDraftSize(option)}
                    className={`relative min-w-14 cursor-pointer rounded-md border px-4 py-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${draftSize === option ? "border-secondary bg-secondary/5 font-semibold text-secondary" : "border-gray-200 hover:border-secondary"}`}
                  >
                    {option}
                    {draftSize === option && <Check size={11} className="absolute bottom-0.5 right-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-5" aria-live="polite">Stock: {isSizeAvailable(product, draftSize) ? getSizeQuantity(product, draftSize) : 0}</p>
          {draftSize !== size && isSizeAvailable(product, draftSize) && !canConfirm && (
            <p className="mt-2 text-red-600" role="alert">
              This change requires {requiredQuantity} items of {draftSize}, but only {getSizeQuantity(product, draftSize)} are in stock.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 p-5">
          <button type="button" onClick={closePopup} disabled={disabled} className="btn-outline !rounded-md disabled:opacity-50">Back</button>
          <button type="button" onClick={confirmSize} disabled={disabled || !canConfirm} className="btn-dark !rounded-md disabled:cursor-not-allowed disabled:opacity-50">
            {disabled ? "Updating..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartSizePicker;
