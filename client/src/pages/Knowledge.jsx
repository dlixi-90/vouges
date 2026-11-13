import { useEffect, useMemo } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import useCachedResource from "../hooks/useCachedResource";
import usePaginationScroll from "../hooks/usePaginationScroll";
import { LIBRARY_KINDS, libraryPath, librarySlug } from "../utils/fragranceLibrary";
import { knowledgePresentation } from "../utils/knowledgePresentation";
import { getProductImageUrl } from "../utils/productImage";
import ProductArticle from "../components/ProductArticle";
import KnowledgeDirectory from "../components/KnowledgeDirectory";
import StorePageHeading from "../components/StorePageHeading";
import Pagination from "../components/Pagination";
import Item from "../components/Item";
import { LoadingStatus } from "../components/LoadingState";
import "./knowledge.css";

function formatSlugToName(rawSlug) {
  if (!rawSlug) return "";
  try {
    const text = decodeURIComponent(rawSlug).replace(/[-_+]+/g, " ").trim();
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  } catch {
    return String(rawSlug).replace(/[-_+]+/g, " ");
  }
}

function KnowledgeHero({ image, title }) {
  return (
    <figure className="knowledge-hero">
      <a className="knowledge-hero-image" href={image.attrs.src} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh đầy đủ: ${title}`}>
        <img src={getProductImageUrl(image.attrs.src, 1200)} alt={image.attrs.alt || title} width={image.attrs.width} height={image.attrs.height} loading="eager" fetchPriority="high" decoding="async" />
      </a>
      {image.attrs.title && <figcaption>{image.attrs.title}</figcaption>}
    </figure>
  );
}

function AccordFacts({ sections }) {
  return sections.map((section, index) => (
    <section className="knowledge-accord-facts" key={index} aria-labelledby={`accord-facts-${index}`}>
      <h2 id={`accord-facts-${index}`}>{section.title}</h2>
      <ul>
        {section.fields.map(field => (
          <li key={field.label}>
            <ProductArticle content={{ ...field.content, content: field.content.content.map((node, position) => position === 0 ? {
              ...node, content: [{ type: "text", text: `${field.label} ` }, ...node.content],
            } : node) }} library />
          </li>
        ))}
      </ul>
    </section>
  ));
}

export default function Knowledge() {
  const { kind, slug } = useParams(), [search, setSearch] = useSearchParams();
  const location = useLocation();
  const { publicCatalog } = useAppContext();
  const config = Object.hasOwn(LIBRARY_KINDS, kind || "") ? LIBRARY_KINDS[kind] : null;
  const name = search.get("name") || "", q = search.get("q") || "", origin = search.get("origin") || "", page = Math.max(1, Number(search.get("page")) || 1);
  const detail = Boolean(slug || name);
  const requestPage = detail ? page : 1;
  const resource = useMemo(() => {
    if (!config) return null;
    const params = detail ? { ...(slug ? { slug } : { name }), page: requestPage } : { view: "directory" };
    return { peek: () => publicCatalog.peekLibrary(kind, params), load: options => publicCatalog.library(kind, params, options) };
  }, [config, detail, slug, name, requestPage, publicCatalog, kind]);
  const { data, loading, error, reload } = useCachedResource(resource, { scope: `library:${kind}:${slug || name || "directory"}`, keepPrevious: true });

  const cachedDirectory = publicCatalog.peekLibrary(kind, { view: "directory" });
  const directoryTerm = useMemo(() => {
    if (!detail || !cachedDirectory?.terms?.length) return null;
    const targetSlug = slug ? decodeURIComponent(slug).toLowerCase() : "";
    const targetName = name ? name.toLowerCase() : "";
    return cachedDirectory.terms.find(t => {
      const s = (t.slug || librarySlug(t)).toLowerCase();
      const n = (t.name || "").toLowerCase();
      return (targetSlug && (s === targetSlug || n === targetSlug)) ||
             (targetName && n === targetName);
    }) || null;
  }, [detail, cachedDirectory, slug, name]);

  const stateTerm = location.state?.initialTerm;
  const fallbackTerm = useMemo(() => {
    if (!detail) return null;
    const resolvedName = name || (slug ? formatSlugToName(slug) : "");
    if (!resolvedName) return null;
    return { name: resolvedName, kind, slug };
  }, [detail, name, slug, kind]);

  const term = data?.term || stateTerm || directoryTerm || fallbackTerm;
  const presentation = useMemo(() => {
    if (!term) return null;
    const res = knowledgePresentation(term);
    if (!res.hero && term.image) {
      res.hero = { attrs: { src: term.image, alt: term.name } };
    }
    if (res.hero && !res.layout) {
      res.layout = (term.kind === "accord" || kind === "accord")
        ? "accord"
        : (term.kind === "group" || kind === "group")
        ? "banner"
        : "banner";
    }
    return res;
  }, [term, kind]);

  const openingLayoutClass = useMemo(() => {
    if (presentation?.layout === "accord" || kind === "accord") return "accord";
    if (presentation?.layout === "banner" || kind === "group") return "banner";
    if (presentation?.layout === "portrait") {
      return presentation.intro?.content?.length ? "split" : "portrait";
    }
    if (presentation?.layout) return presentation.layout;
    if (kind === "note") return "banner";
    return "banner";
  }, [presentation?.layout, presentation?.intro?.content?.length, kind]);

  const pageTitle = presentation ? (
    <>
      {presentation.title}
      {presentation.secondaryTitle && (
        <> <span lang="en">({presentation.secondaryTitle})</span></>
      )}
    </>
  ) : (
    fallbackTerm?.name || config?.title
  );
  const breadcrumbLabel = presentation?.label || fallbackTerm?.name || "Đang tải…";

  const change = next => { const params = new URLSearchParams(search); params.set("page", next); setSearch(params); };
  const { listRef, changePage } = usePaginationScroll({ page: data?.page || page, onPageChange: change, ready: !loading });

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [kind, slug, name]);
  useEffect(() => {
    if (!detail || !config || !data?.page || !data?.totalPages || data.page >= data.totalPages) return;
    const nextParams = { ...(slug ? { slug } : { name }), page: data.page + 1 };
    void publicCatalog.library(kind, nextParams).catch(() => {});
  }, [detail, config, data?.page, data?.totalPages, slug, name, kind, publicCatalog]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${presentation?.label || config?.title || "Kiến thức"} | Velours`;
    return () => { document.title = previous; };
  }, [presentation?.label, config?.title]);

  if (kind === "brand") return <Navigate to={name ? `/collection?brand=${encodeURIComponent(name)}` : "/collection"} replace />;
  if (!config) return <div className="knowledge-page max-padd-container"><StorePageHeading title="Không tìm thấy thư viện" /><Link to="/knowledge/group">Khám phá kiến thức hương thơm</Link></div>;
  if (name && data?.term) return <Navigate to={`${libraryPath(data.term)}${page > 1 ? `?page=${page}` : ""}`} replace />;

  const selectOrigin = value => { const params = new URLSearchParams(search); params.delete("page"); if (value) params.set("origin", value); else params.delete("origin"); setSearch(params); };
  const setQuery = value => { const params = new URLSearchParams(search); params.delete("page"); if (value) params.set("q", value); else params.delete("q"); setSearch(params, { replace: true }); };

  return (
    <div className={`knowledge-page max-padd-container store-page-container${detail ? ` knowledge-detail-page knowledge-detail-page--${kind}` : ""}`}>
      {detail && (
        <StorePageHeading
          className="knowledge-heading"
          title={pageTitle}
          breadcrumbs={[
            { label: config.title, to: `/knowledge/${kind}` },
            { label: breadcrumbLabel },
          ]}
        />
      )}
      {error && <div role="alert" className="knowledge-empty">{error}<button onClick={reload} type="button">Thử lại</button></div>}
      <LoadingStatus active={loading} label="Đang tải thư viện…" />
      {!detail && <KnowledgeDirectory kind={kind} config={config} data={data} loading={loading} query={q} origin={origin} onSearch={setQuery} onOrigin={selectOrigin} />}
      {detail && !data?.term && loading && (
        <div className="knowledge-reading-layout" aria-busy="true">
          <article className="knowledge-article">
            {openingLayoutClass === "accord" || openingLayoutClass === "split" ? (
              <div className={`knowledge-opening knowledge-opening--${openingLayoutClass}`}>
                <figure className="knowledge-hero">
                  <div className="knowledge-hero-image">
                    {term?.image ? (
                      <img
                        src={getProductImageUrl(term.image, 600)}
                        alt={term.name || ""}
                        width="400"
                        height="400"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                      />
                    ) : (
                      <div className="skeleton-surface aspect-square w-full" />
                    )}
                  </div>
                </figure>
                <div className="knowledge-opening-copy">
                  <div className="space-y-3.5">
                    <div className="skeleton-line h-4 w-full" />
                    <div className="skeleton-line h-4 w-11/12" />
                    <div className="skeleton-line h-4 w-4/5" />
                    <div className="skeleton-line h-4 w-3/4" />
                  </div>
                </div>
              </div>
            ) : openingLayoutClass === "portrait" ? (
              <>
                <div className="knowledge-opening knowledge-opening--portrait">
                  <figure className="knowledge-hero">
                    <div className="knowledge-hero-image">
                      {term?.image ? (
                        <img
                          src={getProductImageUrl(term.image, 600)}
                          alt={term.name || ""}
                          width="400"
                          height="400"
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                        />
                      ) : (
                        <div className="skeleton-surface aspect-square w-full" />
                      )}
                    </div>
                  </figure>
                </div>
                <div className="mt-8 space-y-3.5">
                  <div className="skeleton-line h-4 w-full" />
                  <div className="skeleton-line h-4 w-11/12" />
                  <div className="skeleton-line h-4 w-4/5" />
                  <div className="skeleton-line h-4 w-3/4" />
                </div>
              </>
            ) : (
              <>
                <div className="knowledge-opening knowledge-opening--banner">
                  <figure className="knowledge-hero">
                    <div className="knowledge-hero-image">
                      {term?.image ? (
                        <img
                          src={getProductImageUrl(term.image, 1200)}
                          alt={term.name || ""}
                          width="1200"
                          height={kind === "note" ? "260" : "350"}
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                        />
                      ) : (
                        <div className="skeleton-surface h-full w-full" />
                      )}
                    </div>
                  </figure>
                </div>
                <div className="mt-8 space-y-3.5">
                  <div className="skeleton-line h-4 w-full" />
                  <div className="skeleton-line h-4 w-11/12" />
                  <div className="skeleton-line h-4 w-4/5" />
                  <div className="skeleton-line h-4 w-3/4" />
                </div>
              </>
            )}
          </article>
        </div>
      )}
      {detail && data?.term && (
        <>
          <div className="knowledge-reading-layout">
            <article className="knowledge-article" aria-label={`Giới thiệu ${data.term.name}`}>
              {data.term.description?.trim() || data.term.descriptionContent ? (
                <>
                  {presentation.hero && (
                    <div className={`knowledge-opening knowledge-opening--${openingLayoutClass}`}>
                      <KnowledgeHero image={presentation.hero} title={presentation.title} />
                      {(presentation.intro.content.length > 0 || presentation.facts.length > 0) && (
                        <div className="knowledge-opening-copy">
                          {presentation.intro.content.length > 0 && <ProductArticle content={presentation.intro} library />}
                          <AccordFacts sections={presentation.facts} />
                        </div>
                      )}
                    </div>
                  )}
                  {presentation.body.content.length > 0 && <ProductArticle content={presentation.body} library />}
                </>
              ) : (
                <>
                  {data.term.image && <img className="knowledge-empty-image" src={getProductImageUrl(data.term.image, 320)} alt={data.term.name} width="160" height="160" loading="lazy" decoding="async"/>}
                  <p className="knowledge-empty">Phần giới thiệu đang được cập nhật. Bạn có thể khám phá các sản phẩm liên quan bên dưới.</p>
                </>
              )}
            </article>
          </div>
          <section className="knowledge-related" aria-labelledby="knowledge-related-heading">
            <div ref={listRef} tabIndex={-1} className="knowledge-related-heading">
              <h2 id="knowledge-related-heading">{data.term.relatedHeading || "Sản phẩm liên quan"}</h2>
              <p>{data.total.toLocaleString("vi-VN")} sản phẩm</p>
            </div>
            {data.products?.length ? (
              <div className="knowledge-product-grid" aria-busy={loading}>
                {data.products.map(product => <Item key={product._id} product={product} />)}
              </div>
            ) : (
              <p className="knowledge-empty">Chưa có sản phẩm liên quan trong bộ sưu tập.</p>
            )}
          </section>
        </>
      )}
      {detail && data && <Pagination page={data.page} totalPages={data.totalPages} disabled={loading} onPageChange={changePage} label="Phân trang sản phẩm liên quan" />}
    </div>
  );
}
