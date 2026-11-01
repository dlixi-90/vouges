import { useId } from "react";
import Breadcrumbs from "./Breadcrumbs";
import "../storefront-pages.css";

export default function StorePageHeading({ title, titleId, className = "", breadcrumbs, onBreadcrumbNavigate, children }) {
  const generatedId = useId();
  return (
    <header className={`store-page-heading ${className}`}>
      <div className="store-page-heading-copy">
        <Breadcrumbs items={breadcrumbs || [{ label: title }]} onNavigate={onBreadcrumbNavigate} />
        <h1 id={titleId || generatedId}>{title}</h1>
      </div>
      {children && <div className="store-page-heading-actions">{children}</div>}
    </header>
  );
}
