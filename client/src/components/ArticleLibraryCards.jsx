import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { getAvailableSizes } from "../utils/productStock";
import ProductCard from "./ProductCard";

const productId = item => /^\/collection\/([a-f0-9]{24})$/u.exec(item.href)?.[1];

export default function ArticleLibraryCards({ node }) {
  const { publicCatalog, currency } = useAppContext();
  const container = useRef(null);
  const [loaded, setLoaded] = useState(null);
  const ids = [...new Set(node.attrs.items.map(productId).filter(Boolean))].sort().join(",");
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
  return <div ref={container} className={`article-library-cards columns-${node.attrs.columns}`}>
    {node.attrs.items.map((item, index) => {
      const id = productId(item), product = products.get(id);
      const label = <>{item.image && <img src={item.image} alt="" loading="lazy" decoding="async" width={item.width || 180} height={item.height || 180} />}<strong>{item.name}</strong>{item.englishName && <small lang="en">{item.englishName}</small>}</>;
      return <div className={`article-library-card${id ? " article-library-product" : ""}`} key={`${index}:${item.href}`}>
        {id ? <ProductCard product={product || { _id: id, title: item.name, image: item.image }}
          currency={currency} isAvailable={!product || getAvailableSizes(product).length > 0}
          pricePending={loaded?.ids !== ids} />
          : item.href.startsWith("/") ? <Link to={item.href}>{label}</Link>
            : <a href={item.href} target="_blank" rel="noopener noreferrer nofollow">{label}</a>}
        {item.description && <p>{item.description}</p>}
      </div>;
    })}
  </div>;
}
