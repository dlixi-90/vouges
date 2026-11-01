import { Link } from "react-router-dom";
import "./breadcrumbs.css";

export default function Breadcrumbs({ items, className = "", onNavigate }) {
  const trail = [{ label: "Trang chủ", to: "/" }, ...items];
  const navigate = event => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate?.();
  };
  return <nav aria-label="Đường dẫn" className={`store-page-breadcrumb ${className}`}>
    <ol>{trail.map((item, index) => <li key={`${index}:${item.label}`}>
      {index > 0 && <span aria-hidden="true" className="breadcrumb-separator">/</span>}
      {index < trail.length - 1 && item.to
        ? <Link to={item.to} onClick={navigate}>{item.label}</Link>
        : <span aria-current={index === trail.length - 1 ? "page" : undefined}>{item.label}</span>}
    </li>)}</ol>
  </nav>;
}
