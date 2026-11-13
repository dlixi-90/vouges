import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import FragranceAccords from "./FragranceAccords";
import { libraryNamePath, splitFragranceGroups } from "../utils/fragranceLibrary";
import { prefetchRoute } from "../utils/prefetchRoute";

export default function ProductFacts({ product }) {
  const { setSearchQuery, publicCatalog } = useAppContext();
  const prefetchGroup = groupName => {
    prefetchRoute("/knowledge");
    if (groupName) void publicCatalog?.library?.("group", { name: groupName, page: 1 }).catch(() => {});
  };
  const fragrance = product.fragrance || {};
  const accessory = fragrance.profileKind === 'accessory';
  const fragranceGroups = splitFragranceGroups(fragrance.group);
  const rows = [
    ["Thương hiệu", product.brand],
    ["Xuất xứ", product.origin],
    ["Giới tính", product.gender],
    ["Nhóm hương", fragranceGroups.length ? fragranceGroups.join(", ") : (accessory && fragrance.notApplicable?.group ? 'Không áp dụng — tùy lõi hương hoặc nước hoa đi kèm' : '')],
    ["Phong cách", product.fragrance?.style],
    [fragrance.profileKind === 'diffuser' ? 'Dạng sản phẩm' : 'Nồng độ', product.concentration || (accessory && fragrance.notApplicable?.concentration ? 'Không áp dụng cho phụ kiện' : '')],
  ];
  return <dl className="product-detail-facts" aria-label="Thông tin nước hoa">
    {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>
      {value ? label === "Thương hiệu" ? <Link to={`/collection?brand=${encodeURIComponent(value)}`} onClick={() => setSearchQuery("")}>{value}</Link> : label === "Nhóm hương" && fragranceGroups.length ? fragranceGroups.map((groupName, index) => <span key={`${groupName}-${index}`}>{index > 0 && ", "}<Link to={libraryNamePath("group", groupName)} state={{ initialTerm: { name: groupName, kind: "group" } }} onPointerEnter={() => prefetchGroup(groupName)} onFocus={() => prefetchGroup(groupName)}>{groupName}</Link></span>) : value : <span className="product-fact-missing">Đang cập nhật</span>}
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
