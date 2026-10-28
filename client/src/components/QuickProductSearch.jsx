import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import "./quick-product-search.css";

export default function QuickProductSearch({ className = "", onSearch }) {
  const [search, setSearch] = useState("");

  return <form className={`quick-product-search ${className}`} role="search" onSubmit={event => {
    event.preventDefault();
    const query = search.trim();
    if (query) onSearch(query);
  }}>
    <Search size={17} aria-hidden="true" />
    <input type="search" value={search} onChange={event => setSearch(event.target.value)}
      placeholder="Tìm sản phẩm, thương hiệu…" aria-label="Tìm nhanh sản phẩm" />
    <button type="submit" aria-label="Tìm kiếm"><ArrowUpRight size={15} aria-hidden="true" /></button>
  </form>;
}
