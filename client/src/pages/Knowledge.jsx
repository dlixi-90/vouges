import { useEffect, useMemo } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import useCachedResource from "../hooks/useCachedResource";
import usePaginationScroll from "../hooks/usePaginationScroll";
import { LIBRARY_KINDS, libraryPath } from "../utils/fragranceLibrary";
import ProductArticle from "../components/ProductArticle";
import StorePageHeading from "../components/StorePageHeading";
import Pagination from "../components/Pagination";
import Item from "../components/Item";
import { LoadingStatus, PageSkeleton } from "../components/LoadingState";
import "./knowledge.css";

export default function Knowledge() {
  const { kind, slug } = useParams(), [search, setSearch] = useSearchParams();
  const { publicCatalog, setSearchQuery } = useAppContext();
  const config = Object.hasOwn(LIBRARY_KINDS, kind || "") ? LIBRARY_KINDS[kind] : null;
  const name = search.get("name") || "", q = search.get("q") || "", page = Math.max(1, Number(search.get("page")) || 1);
  const detail = Boolean(slug || name);
  const resource = useMemo(() => {
    if (!config) return null;
    const params = detail ? { ...(slug ? { slug } : { name }), page } : { q, page };
    return { peek: () => publicCatalog.peekLibrary(kind, params), load: options => publicCatalog.library(kind, params, options) };
  }, [config, detail, slug, name, q, page, publicCatalog, kind]);
  const { data, loading, error, reload } = useCachedResource(resource, { scope: `library:${kind}:${slug || name || "directory"}`, keepPrevious: true, delay: detail ? 0 : 180 });
  const change = next => { const params = new URLSearchParams(search); params.set("page", next); setSearch(params); };
  const { listRef, changePage } = usePaginationScroll({ page: data?.page || page, onPageChange: change, ready: !loading });
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [kind, slug, name]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${data?.term?.name || config?.title || "Kiến thức"} | Velours`;
    return () => { document.title = previous; };
  }, [data?.term?.name, config?.title]);
  if (!config) return <div className="knowledge-page max-padd-container"><StorePageHeading title="Không tìm thấy thư viện" /><Link to="/knowledge/group">Khám phá kiến thức hương thơm</Link></div>;
  if (name && data?.term) return <Navigate to={`${libraryPath(data.term)}${page > 1 ? `?page=${page}` : ""}`} replace />;
  const term = data?.term;
  return <div className="knowledge-page max-padd-container">
    <StorePageHeading title={term?.name || config.title}>
      {detail && <Link className="knowledge-back" to={`/knowledge/${kind}`}>Tất cả {config.title.toLocaleLowerCase("vi-VN")}</Link>}
    </StorePageHeading>
    {error && <div role="alert" className="knowledge-empty">{error}<button onClick={reload} type="button">Thử lại</button></div>}
    <LoadingStatus active={loading} label="Đang tải thư viện…" />
    {!detail && <>
      <div className="knowledge-directory-heading"><p>{config.intro}</p><label className="knowledge-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label={`Tìm ${config.title.toLocaleLowerCase("vi-VN")}`} placeholder={`Tìm ${config.title.toLocaleLowerCase("vi-VN")}…`} value={q} onChange={event => { const params = new URLSearchParams(); if (event.target.value) params.set("q", event.target.value); setSearch(params, { replace: true }); }} /></label></div>
      {data && <p className="knowledge-count">{data.total.toLocaleString("vi-VN")} {config.title.toLocaleLowerCase("vi-VN")}</p>}
      {loading && !data ? <PageSkeleton /> : <div ref={listRef} tabIndex={-1} className="knowledge-directory" aria-busy={loading}>{data?.terms?.map(row => <Link className="knowledge-card" to={libraryPath(row)} key={row.id}><span><small>{config.title}</small><strong>{row.name}</strong></span><ArrowRight size={19} aria-hidden="true" /></Link>)}</div>}
      {data?.total === 0 && <p className="knowledge-empty">Không tìm thấy nội dung phù hợp. Thử một từ khóa khác.</p>}
    </>}
    {detail && !term && loading && <PageSkeleton />}
    {term && <>
      <div className="knowledge-reading-layout">
        <article className="knowledge-article" aria-label={`Giới thiệu ${term.name}`}><p className="knowledge-eyebrow">Thư viện Velours · {config.title}</p>
          {term.description?.trim() || term.descriptionContent ? <ProductArticle content={term.descriptionContent} text={term.description} /> : <p className="knowledge-empty">Phần giới thiệu đang được biên soạn. Bạn có thể khám phá các sản phẩm liên quan bên dưới.</p>}
        </article>
        <aside className="knowledge-reading-aside"><BookOpen size={24} strokeWidth={1.3} aria-hidden="true" /><h2>Khám phá thêm</h2><nav aria-label="Thư viện hương thơm">{Object.entries(LIBRARY_KINDS).map(([key, value]) => <Link key={key} to={`/knowledge/${key}`}>{value.title}<ArrowRight size={15} aria-hidden="true" /></Link>)}</nav>
          {kind === "brand" && <Link className="inessa-button" to={`/collection?brand=${encodeURIComponent(term.name)}`} onClick={() => setSearchQuery("")}>Xem bộ sưu tập</Link>}
        </aside>
      </div>
      <section className="knowledge-related" aria-labelledby="knowledge-related-heading"><div ref={listRef} tabIndex={-1} className="knowledge-related-heading"><h2 id="knowledge-related-heading">Sản phẩm liên quan</h2><p>{data.total.toLocaleString("vi-VN")} sản phẩm</p></div>
        {data.products?.length ? <div className="knowledge-product-grid" aria-busy={loading}>{data.products.map(product => <Item key={product._id} product={product} />)}</div> : <p className="knowledge-empty">Chưa có sản phẩm liên quan trong bộ sưu tập.</p>}
      </section>
    </>}
    {data && <Pagination page={data.page} totalPages={data.totalPages} disabled={loading} onPageChange={changePage} label={detail ? "Phân trang sản phẩm liên quan" : "Phân trang thư viện"} />}
  </div>;
}
