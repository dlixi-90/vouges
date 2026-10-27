export function OperationsPanel({ title, description, actions, children, className = "" }) {
  return <section className={`admin-dashboard-panel admin-operation-panel ${className}`}>
    {(title || actions) && <header className="admin-panel-heading"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions && <div className="perfume-toolbar-buttons">{actions}</div>}</header>}
    {children}
  </section>;
}

export function OperationsEmptyState({ icon: Icon, title, description, children }) {
  return <div className="admin-operation-empty">{Icon && <span><Icon size={25} strokeWidth={1.4} aria-hidden="true" /></span>}<strong>{title}</strong>{description && <p>{description}</p>}{children}</div>;
}

export function OperationsMetric({ icon: Icon, label, value, detail, primary = false }) {
  return <article className={`admin-metric-card${primary ? " is-primary" : ""}`}><div className="admin-metric-top"><span className="admin-metric-icon"><Icon size={18} strokeWidth={1.6} /></span><span>{label}</span></div><strong>{value}</strong><p>{detail}</p></article>;
}
