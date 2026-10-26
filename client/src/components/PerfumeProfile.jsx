import FragranceCharts from "./FragranceCharts";

export default function PerfumeProfile({product}) {
  const fragrance = product.fragrance;
  if (!fragrance) return null;
  const facts = [["Thương hiệu",product.brand],["Xuất xứ",product.origin],["Nồng độ",product.concentration],["Giới tính",product.gender],["Nhóm hương",fragrance.group],["Phong cách",fragrance.style]].filter(([,value])=>value);
  return <section className="perfume-profile mt-12 border-t border-gray-200 pt-8" aria-label="Hồ sơ nước hoa">
    <h2 className="mb-6 text-3xl">Hồ sơ nước hoa</h2>
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{facts.map(([label,value])=><div key={label}><dt className="text-xs uppercase tracking-wider text-gray-500">{label}</dt><dd className="mt-1 text-base">{value}</dd></div>)}</dl>
    {Object.values(fragrance.notes||{}).some(list=>list.length>0)&&<div className="my-8 grid gap-5 sm:grid-cols-3">{[["top","Hương đầu"],["middle","Hương giữa"],["base","Hương cuối"]].map(([key,label])=><div className="rounded-lg border border-gray-200 p-5" key={key}><h3 className="mb-3 text-xl">{label}</h3><p className="text-sm leading-7 text-gray-600">{fragrance.notes?.[key]?.map(note=>note.name).join(", ")||"Chưa có dữ liệu"}</p></div>)}</div>}
    {fragrance.accords?.length>0&&<div className="my-8"><h3 className="mb-4 text-xl">Các sắc thái mùi hương</h3><div className="flex flex-wrap gap-2">{fragrance.accords.map((accord,index)=><span key={`${accord.label}-${index}`} className="rounded-md border border-gray-200 px-3 py-2 text-sm">{accord.label}</span>)}</div></div>}
    {fragrance.assessmentsVisible&&<div className="mt-8"><h3 className="mb-4 text-xl">Lưu hương, tỏa hương và thời điểm sử dụng</h3><FragranceCharts fragrance={fragrance}/><p className="mt-4 text-xs leading-5 text-gray-500">Số liệu tham khảo được ghi nhận từ Apaniche. Phương pháp tổng hợp chưa được xác minh; trải nghiệm có thể thay đổi theo da và môi trường.</p></div>}
  </section>;
}
