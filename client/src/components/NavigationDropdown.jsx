import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import "./navigation-dropdown.css";

export default function NavigationDropdown({ title, links, compact, onNavigate }) {
  const location = useLocation(), id = useId(), root = useRef(null), trigger = useRef(null);
  const [openedAt, setOpenedAt] = useState(null);
  const open = openedAt === location.key;
  const active = links.some(link => location.pathname === link.path || location.pathname.startsWith(`${link.path}/`));
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpenedAt(null); };
    const escape = event => { if (event.key === "Escape") { setOpenedAt(null); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} className={`store-info-menu${compact ? " is-compact" : ""}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpenedAt(null); }}>
    <button ref={trigger} type="button" className={`store-brand-trigger${active ? " is-active" : ""}`} aria-expanded={open} aria-controls={id}
      onClick={() => setOpenedAt(open ? null : location.key)} onKeyDown={event => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpenedAt(location.key); requestAnimationFrame(() => root.current?.querySelector("a")?.focus()); }
      }}>{title}<ChevronDown size={13} aria-hidden="true" /></button>
    {open && <div id={id} className="store-info-dropdown" aria-label={title}>{links.map(link => <NavLink key={link.path} to={link.path} onClick={() => { setOpenedAt(null); onNavigate?.(); }}>{link.title}</NavLink>)}</div>}
  </div>;
}
