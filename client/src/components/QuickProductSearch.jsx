import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import "./quick-product-search.css";

export default function QuickProductSearch({ className = "", value = "", onSearch }) {
  const { key: locationKey } = useLocation();
  const scope = `${locationKey}:${value}`;
  const [draft, setDraft] = useState({ scope, text: value });
  const search = draft.scope === scope ? draft.text : value;

  return <form className={`quick-product-search ${className}`} role="search" onSubmit={event => {
    event.preventDefault();
    const query = search.trim();
    if (query) onSearch(query);
  }}>
    <Search size={17} aria-hidden="true" />
    <input
      type="search"
      autoComplete="off"
      autoCorrect="off"
      spellCheck="false"
      value={search}
      onChange={event => setDraft({ scope, text: event.target.value })}
      placeholder="Tìm sản phẩm..."
      aria-label="Tìm nhanh sản phẩm"
    />
    <button type="submit" aria-label="Tìm kiếm"><ArrowUpRight size={15} aria-hidden="true" /></button>
  </form>;
}