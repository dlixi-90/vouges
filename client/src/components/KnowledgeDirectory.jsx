import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowDownRight, ArrowUp, ChevronDown, Search, X } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { LIBRARY_KINDS, libraryPath } from "../utils/fragranceLibrary";
import { filterLibraryTerms, groupLibraryTerms, libraryDisplayName } from "../utils/libraryDirectory";
import { getProductImageUrl } from "../utils/productImage";
import { PageSkeleton } from "./LoadingState";
import StorePageHeading from "./StorePageHeading";
import LibraryTermCard from "./LibraryTermCard";
import "./knowledge-directory.css";

const titles = { group: "Thư viện nhóm hương", accord: "Thư viện kiểu mùi hương", note: "Nguồn gốc note hương" };
const introTitles = { group: "Nhóm hương nước hoa là gì?", accord: "Kiểu mùi hương là gì?", note: "Note hương nước hoa là gì?" };
const families = [
  ["Floral · Hoa", "Mềm mại, rực rỡ hoặc thanh thoát", "Khám phá những sắc thái từ một đóa hoa đến cả bó hoa."],
  ["Fruity · Trái cây", "Mọng nước, ngọt và tươi sáng", "Dành cho cảm hứng vui tươi, sinh động."],
  ["Citrus · Cam chanh", "Sảng khoái, sáng và hơi đắng", "Gợi ý cho những ngày cần cảm giác nhẹ nhàng, tươi mới."],
  ["Green · Xanh", "Lá cây, cỏ non và nét tự nhiên", "Khám phá cảm giác xanh mát, gần gũi thiên nhiên."],
  ["Aquatic · Thủy sinh", "Thoáng, trong và mát", "Gợi liên tưởng đến nước và không gian rộng mở."],
  ["Oriental · Phương Đông", "Ấm, sâu và giàu sắc thái", "Khám phá nhựa thơm, gia vị và những lớp hương đậm."],
  ["Woody · Gỗ", "Khô, trầm hoặc mềm ấm", "Gợi ý khi bạn thích chiều sâu và cảm giác vững chãi."],
  ["Spicy · Gia vị", "Cay, ấm hoặc sắc lạnh", "Tìm những điểm nhấn rõ nét trong một mùi hương."],
  ["Leather · Da thuộc", "Khô, khói và có độ đậm", "Khám phá những mùi hương nhiều cá tính."],
  ["Gourmand · Thực phẩm", "Ngọt, béo và gợi món ăn", "Gợi ý cho người yêu những liên tưởng ấm áp, dễ chịu."],
];

function TermCard({ term, kind, eager }) {
  return <LibraryTermCard to={libraryPath(term)} name={libraryDisplayName(term)} englishName={term.englishName}
    image={term.image} variant={kind} eager={eager} width={kind === "group" ? 360 : 180} height={kind === "group" ? 93 : 180} />;
}

function TermGrid({ terms, kind, eager = false }) {
  return <div className={`knowledge-directory knowledge-directory--${kind}`}>
    {terms.map((term, index) => <TermCard key={term.id} term={term} kind={kind} eager={eager && index < (kind === "group" ? 3 : 6)} />)}
  </div>;
}

function OriginLink({ section, search, active }) {
  const names = section.name.match(/^(.*?)\s*\(([^()]+)\)\s*$/u);
  return <Link className="knowledge-origin-link" to={{ pathname: "/knowledge/note", search, hash: `#origin-${section.id}` }} aria-current={active ? "location" : undefined} title={section.name}>
    <span className="knowledge-origin-link-copy"><strong>{names?.[1] || section.name}</strong>{names && <small lang="en">{names[2]}</small>}</span>
    <span className="knowledge-origin-link-meta"><span className="knowledge-origin-link-count" aria-label={`${section.terms.length} note hương`}>{section.terms.length}</span><ArrowDownRight size={15} aria-hidden="true" /></span>
  </Link>;
}

function DirectoryIntroduction({ kind, config, overview }) {
  return <section className="knowledge-introduction" aria-labelledby="knowledge-introduction-heading">
    <h2 id="knowledge-introduction-heading">{introTitles[kind]}</h2>
    <p>{overview?.text || config.intro}</p>
    <details className="knowledge-introduction-more">
      <summary><span>Xem thêm</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="knowledge-concept-comparison">
        <div><h3>Nhóm hương</h3><p>Cho biết hướng chủ đạo của cả mùi hương, như hoa, gỗ hay cam chanh.</p></div>
        <div><h3>Kiểu mùi</h3><p>Mô tả sắc thái khi ngửi, như sạch, phấn, cay, khói hoặc ngọt.</p></div>
        <div><h3>Note hương</h3><p>Gọi tên chất liệu hay liên tưởng tạo mùi, như hoa hồng, bergamot hoặc vani.</p></div>
      </div>
      {overview?.images?.length > 0 && <div className="knowledge-introduction-images">{overview.images.map(image => <a key={image.src} href={image.src} target="_blank" rel="noopener noreferrer"><img src={getProductImageUrl(image.src, 960)} alt={image.alt} loading="lazy" decoding="async" width={image.width} height={image.height} /></a>)}</div>}
    </details>
  </section>;
}

export default function KnowledgeDirectory({ kind, config, data, loading, query, origin, onSearch, onOrigin }) {
  const { publicCatalog } = useAppContext();
  const { hash } = useLocation();
  const [keyword, setKeyword] = useState(query || "");
  const isComposingRef = useRef(false);
  const lastSyncedQueryRef = useRef(query || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if ((query || "") !== lastSyncedQueryRef.current) {
      lastSyncedQueryRef.current = query || "";
      setKeyword(query || "");
    }
  }, [query]);

  useEffect(() => {
    if (keyword === (query || "")) return;
    const timer = setTimeout(() => {
      if (!isComposingRef.current) {
        lastSyncedQueryRef.current = keyword;
        onSearch(keyword);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [keyword, query, onSearch]);

  const terms = useMemo(() => filterLibraryTerms(data?.terms || [], keyword, origin), [data?.terms, keyword, origin]);
  const sections = useMemo(() => groupLibraryTerms(terms, data?.overview?.origins || []), [terms, data?.overview?.origins]);
  const activeOrigin = data?.overview?.origins?.find(row => row.id === origin);
  useEffect(() => {
    if (loading || !hash.startsWith("#origin-")) return;
    const section = document.getElementById(hash.slice(1));
    if (!section) return;
    const frame = window.requestAnimationFrame(() => {
      section.focus({ preventScroll: true });
      section.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, loading, data, origin]);
  const navigationSearch = keyword ? `?q=${encodeURIComponent(keyword)}` : "";
  return <div className={`knowledge-directory-page knowledge-directory-page--${kind}`}>
    <StorePageHeading
      title={titles[kind]}
      titleId="knowledge-directory-top"
      breadcrumbs={[{ label: config.title }]}
    />
    <nav className="knowledge-library-tabs" aria-label="Thư viện hương thơm">{Object.entries(LIBRARY_KINDS).map(([key, value]) => <Link key={key} to={`/knowledge/${key}`} onPointerEnter={() => { if (key !== kind) void publicCatalog?.library(key, { view: "directory" }).catch(() => {}); }} onFocus={() => { if (key !== kind) void publicCatalog?.library(key, { view: "directory" }).catch(() => {}); }} aria-current={kind === key ? "page" : undefined}>{value.title}</Link>)}</nav>
    <DirectoryIntroduction kind={kind} config={config} overview={data?.overview} />
    {kind === "group" && <section className="knowledge-family-overview" aria-labelledby="knowledge-family-heading">
      <h2 id="knowledge-family-heading">Các họ hương trong nước hoa</h2>
      <div className="knowledge-family-scroll" tabIndex={0} role="region" aria-label="Bảng tổng quan họ hương">
        <table><thead><tr><th scope="col">Họ hương</th><th scope="col">Đặc trưng</th><th scope="col">Gợi ý khám phá</th></tr></thead><tbody>{families.map(([name, character, suggestion]) => <tr key={name}><th scope="row">{name}</th><td>{character}</td><td>{suggestion}</td></tr>)}</tbody></table>
      </div>
    </section>}
    <section className="knowledge-directory-results" aria-labelledby="knowledge-directory-heading" aria-busy={loading}>
      <div className="knowledge-directory-toolbar">
        <div><h2 id="knowledge-directory-heading">{kind === "group" ? "Khám phá các nhóm hương" : kind === "accord" ? "Khám phá các kiểu mùi" : "Khám phá theo nguồn gốc"}</h2>
          {data && <p className="knowledge-count" role="status">{terms.length.toLocaleString("vi-VN")} {config.title.toLocaleLowerCase("vi-VN")}{activeOrigin ? ` · ${activeOrigin.name}` : ""}</p>}</div>
        <label className="knowledge-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            aria-label={`Tìm ${config.title.toLocaleLowerCase("vi-VN")}`}
            placeholder={`Tìm ${config.title.toLocaleLowerCase("vi-VN")}…`}
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={event => {
              isComposingRef.current = false;
              setKeyword(event.target.value);
            }}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!isComposingRef.current) {
                  lastSyncedQueryRef.current = keyword;
                  onSearch(keyword);
                }
              }
            }}
          />
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                lastSyncedQueryRef.current = "";
                onSearch("");
                inputRef.current?.focus();
              }}
              aria-label="Xóa từ khóa"
            >
              <X size={15} />
            </button>
          )}
        </label>
      </div>
      {origin && <div className="knowledge-origin-filter"><span>{activeOrigin?.name || "Nguồn gốc không còn tồn tại"}</span><button type="button" onClick={() => onOrigin("")}>Xem tất cả nguồn gốc <X size={14} aria-hidden="true" /></button></div>}
      {loading && !data ? <PageSkeleton compact label="Đang tải danh mục hương thơm…" /> : <>
        {kind === "note" && sections.length > 0 && <nav className="knowledge-origin-navigation" aria-label="Nguồn gốc note hương">
          <div className="knowledge-origin-navigation-heading"><p>Chọn nhóm nguyên liệu</p><span>{sections.length} nhóm</span></div>
          <div className="knowledge-origin-links">{sections.map(section => <OriginLink key={section.id} section={section} search={navigationSearch} active={hash === `#origin-${section.id}`} />)}</div>
        </nav>}
        {kind === "note" ? <div className="knowledge-note-sections">{sections.map((section, index) => <section key={section.id} id={`origin-${section.id}`} className="knowledge-note-section" tabIndex={-1} aria-labelledby={`origin-title-${section.id}`}>
          <header className={`knowledge-origin-banner${section.banner ? " has-image" : ""}`}>
            {section.banner && <img src={getProductImageUrl(section.banner, 1600)} alt="" width="1310" height="280" loading={index === 0 ? "eager" : "lazy"} decoding="async" />}
            <h2 id={`origin-title-${section.id}`}>{section.name}</h2>
          </header>
          <div className="knowledge-origin-description"><p>{section.description}</p><span>{section.terms.length} note hương</span></div>
          <TermGrid terms={section.terms} kind="note" eager={index === 0} />
          <a className="knowledge-back-to-origins" href="#knowledge-directory-heading">Trở lại mục lục <ArrowUp size={14} aria-hidden="true" /></a>
        </section>)}</div> : <TermGrid terms={terms} kind={kind} eager />}
        {data && !terms.length && <div className="knowledge-directory-empty"><p>Không tìm thấy nội dung phù hợp.</p><Link to={`/knowledge/${kind}`}>Xem toàn bộ {config.title.toLocaleLowerCase("vi-VN")}</Link></div>}
      </>}
    </section>
  </div>;
}
