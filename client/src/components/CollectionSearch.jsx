import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";

export default function CollectionSearch({ value, onChange }) {
  const [open, setOpen] = useState(() => Boolean(value));
  const panelId = useId();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const valueRef = useRef(value);
  const isComposingRef = useRef(false);
  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    if (!open) return;
    if (!valueRef.current) inputRef.current?.focus({ preventScroll: true });
    const onPointerDown = event => {
      if (!containerRef.current?.contains(event.target) && !valueRef.current) setOpen(false);
    };
    const onKeyDown = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div className={`inessa-collection-search${open ? " is-open" : ""}`} ref={containerRef}>
    {open && <form id={panelId} className="inessa-collection-search-panel" role="search"
      onSubmit={event => {
        event.preventDefault();
        onChange(value);
      }}>
      <input
        ref={inputRef}
        type="search"
        value={value}
        aria-label="Tìm kiếm sản phẩm"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        placeholder="Tìm sản phẩm…"
        onChange={event => onChange(event.target.value)}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={event => {
          isComposingRef.current = false;
          onChange(event.target.value);
        }}
      />
    </form>}
    <button ref={triggerRef} type="button" className="inessa-collection-search-toggle"
      aria-label={open ? "Đóng tìm kiếm sản phẩm" : "Mở tìm kiếm sản phẩm"}
      title="Tìm kiếm sản phẩm" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(current => !current)}>
      <Search size={20} strokeWidth={1.5} aria-hidden="true" />
    </button>
  </div>;
}
