export default function PerfumeProfile({product, embedded = false}) {
  const fragrance = product.fragrance || {};
  const facts = [["Thương hiệu",product.brand],["Xuất xứ",product.origin],["Nồng độ",product.concentration],["Giới tính",product.gender],["Nhóm hương",fragrance.group],["Phong cách",fragrance.style]].filter(([,value])=>value);
  return <section className={`perfume-profile${embedded ? "" : " mt-12 border-t border-gray-200 pt-8"}`} aria-label="Hồ sơ nước hoa">
    {!embedded && <h2 className="mb-6 text-3xl">Hồ sơ nước hoa</h2>}
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{facts.map(([label,value])=><div key={label}><dt className="text-xs uppercase tracking-wider text-gray-500">{label}</dt><dd className="mt-1 text-base">{value}</dd></div>)}</dl>
    {Object.values(fragrance.notes||{}).some(list=>list.length>0)&&<div className="my-8 grid gap-5 sm:grid-cols-3">{[["top","Hương đầu"],["middle","Hương giữa"],["base","Hương cuối"]].map(([key,label])=><div className="rounded-lg border border-gray-200 p-5" key={key}><h3 className="mb-3 text-xl">{label}</h3><p className="text-sm leading-7 text-gray-600">{fragrance.notes?.[key]?.map(note=>note.name).join(", ")||"Chưa có dữ liệu"}</p></div>)}</div>}
  </section>;
}
