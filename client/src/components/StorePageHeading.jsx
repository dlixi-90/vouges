import { useId } from "react";
import { Link } from "react-router-dom";
import "../storefront-pages.css";

export default function StorePageHeading({ title, titleId, className = "", children }) {
  const generatedId = useId();
  return (
    <header className={`store-page-heading ${className}`}>
      <div className="store-page-heading-copy">
        <nav aria-label="Đường dẫn" className="store-page-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <h1 id={titleId || generatedId}>{title}</h1>
      </div>
      {children && <div className="store-page-heading-actions">{children}</div>}
    </header>
  );
}
