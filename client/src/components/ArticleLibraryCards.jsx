import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { getAvailableSizes } from "../utils/productStock";
import ProductCard from "./ProductCard";
import LibraryTermCard from "./LibraryTermCard";

const productId = item => /^\/collection\/([a-f0-9]{24})$/u.exec(item.href)?.[1];
const isCategory = item => item.href.startsWith("/collection?") && ["Nước hoa nam","Nước hoa nữ","Nước hoa unisex"].includes(new URLSearchParams(item.href.slice(item.href.indexOf("?")+1)).get("category"));

export default function ArticleLibraryCards({ node }) {
  const { publicCatalog, currency, setSearchQuery } = useAppContext();
  const container = useRef(null);
  const [loaded, setLoaded] = useState(null);
  const ids = [...new Set(node.attrs.items.map(productId).filter(Boolean))].sort().join(",");
  const categories = node.attrs.items.every(isCategory);
  const groups = node.attrs.items.every(item => item.href.startsWith("/knowledge/group/"));
  // Cap rows at four cards and balance five products into three plus two.
  const productColumns = Math.ceil(node.attrs.items.length / Math.ceil(node.attrs.items.length / 4));
  useEffect(() => {
    if (!ids) return;
    let active = true, requested = false;
    const load = async () => {
      if (requested) return;
      requested = true;
      try {
        const products = await publicCatalog.batch(ids.split(","));
        if (active) setLoaded({ ids, products });
      } catch {
        if (active) setLoaded({ ids, products: [] });
      }
    };
    if (!("IntersectionObserver" in window)) {
      void load();
      return () => { active = false; };
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void load();
    }, { rootMargin: "400px" });
    observer.observe(container.current);
    return () => { active = false; observer.disconnect(); };
  }, [ids, publicCatalog]);
  const products = new Map((loaded?.ids === ids ? loaded.products : []).map(product => [product._id, product]));
  return <div ref={container} style={ids ? { "--article-product-columns": productColumns } : undefined} className={`article-library-cards columns-${node.attrs.columns} article-library-cards--${categories ? "categories" : ids ? "products" : "terms"}${groups ? " article-library-cards--groups" : ""}`}>
    {node.attrs.items.map((item, index) => {
      const id = productId(item), product = products.get(id);
      if(categories)return <div className="article-library-card" key={item.href}><Link className="article-library-category" to={item.href} onClick={()=>setSearchQuery("")}>
        {item.image&&<img src={item.image} alt="" width={item.width||150} height={item.height||150} loading="lazy" decoding="async"/>}
        <span><strong>{item.name}</strong><small>{item.description||"Xem bộ sưu tập"}</small></span><ArrowRight size={17} aria-hidden="true"/>
      </Link></div>;
      const label = <>{item.image && <img src={item.image} alt="" loading="lazy" decoding="async" width={item.width || 180} height={item.height || 180} />}<strong>{item.name}</strong>{item.englishName && <small lang="en">{item.englishName}</small>}</>;
      return <div className={`article-library-card${id ? " article-library-product" : ""}`} key={`${index}:${item.href}`}>
        {id ? <ProductCard product={product || { _id: id, title: item.name, image: item.image }}
          currency={currency} isAvailable={!product || getAvailableSizes(product).length > 0}
          pricePending={loaded?.ids !== ids} />
          : item.href.startsWith("/knowledge/") ? <LibraryTermCard to={item.href} name={item.name} englishName={item.englishName} image={item.image} variant={item.href.startsWith("/knowledge/group/") ? "group" : undefined} width={item.width || 180} height={item.height || 180} />
            : item.href.startsWith("/") ? <Link to={item.href}>{label}</Link>
            : <a href={item.href} target="_blank" rel="noopener noreferrer nofollow">{label}</a>}
        {item.description && <p>{item.description}</p>}
      </div>;
    })}
  </div>;
}
