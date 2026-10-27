import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function OperationsDrawer({ title, description, busy, onClose, children, footer }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="admin-operation-drawer" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby={titleId}><header><div><p>VELOURS / QUẢN TRỊ</p><h2 id={titleId}>{title}</h2>{description && <span>{description}</span>}</div><button type="button" className="perfume-icon-button" disabled={busy} onClick={onClose} aria-label="Đóng biểu mẫu"><X size={18} /></button></header><div className="admin-operation-drawer-body">{children}</div>{footer && <footer>{footer}</footer>}</dialog>;
}
