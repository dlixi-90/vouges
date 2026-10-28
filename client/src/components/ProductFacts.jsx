import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export default function ProductFacts({ product }) {
  const { setSearchQuery } = useAppContext();
  const rows = [
    ["Thương hiệu", product.brand],
    ["Xuất xứ", product.origin],
    ["Giới tính", product.gender],
    ["Nhóm hương", product.fragrance?.group],
    ["Phong cách", product.fragrance?.style],
    ["Nồng độ", product.concentration],
  ];
  return <dl className="product-detail-facts" aria-label="Thông tin nước hoa">
    {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>
      {value ? label === "Thương hiệu" ? <Link to={`/collection?brand=${encodeURIComponent(value)}`} onClick={() => setSearchQuery("")}>{value}</Link> : value : <span className="product-fact-missing">Đang cập nhật</span>}
    </dd></div>)}
  </dl>;
}
