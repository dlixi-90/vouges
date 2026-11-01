import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import FragranceAccords from "./FragranceAccords";
import { libraryNamePath } from "../utils/fragranceLibrary";

export default function ProductFacts({ product }) {
  const { setSearchQuery } = useAppContext();
  const fragrance = product.fragrance || {};
  const accessory = fragrance.profileKind === 'accessory';
  const rows = [
    ["Thương hiệu", product.brand],
    ["Xuất xứ", product.origin],
    ["Giới tính", product.gender],
    ["Nhóm hương", fragrance.group || (accessory && fragrance.notApplicable?.group ? 'Không áp dụng — tùy lõi hương hoặc nước hoa đi kèm' : '')],
    ["Phong cách", product.fragrance?.style],
    [fragrance.profileKind === 'diffuser' ? 'Dạng sản phẩm' : 'Nồng độ', product.concentration || (accessory && fragrance.notApplicable?.concentration ? 'Không áp dụng cho phụ kiện' : '')],
  ];
  return <dl className="product-detail-facts" aria-label="Thông tin nước hoa">
    {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>
      {value ? label === "Thương hiệu" ? <Link to={`/collection?brand=${encodeURIComponent(value)}`} onClick={() => setSearchQuery("")}>{value}</Link> : label === "Nhóm hương" && fragrance.group ? <Link to={libraryNamePath("group", value)}>{value}</Link> : value : <span className="product-fact-missing">Đang cập nhật</span>}
    </dd></div>)}
    {!accessory && <div className="product-detail-accords">
      <dt>Mùi hương chính</dt>
      <dd>
        {product.fragrance?.accords?.length > 0
          ? <FragranceAccords accords={product.fragrance.accords} />
          : <span className="product-fact-missing">Đang cập nhật</span>}
      </dd>
    </div>}
  </dl>;
}
