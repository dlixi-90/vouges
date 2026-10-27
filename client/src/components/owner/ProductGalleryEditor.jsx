import { ArrowLeft, ArrowRight, Image, Upload, X } from "lucide-react";
import ProductImage from "../ProductImage";

export default function ProductGalleryEditor({ images, uploading, onChange, onUpload }) {
  const move = (index, direction) => {
    const ordered = [...images];
    [ordered[index], ordered[index + direction]] = [ordered[index + direction], ordered[index]];
    onChange(ordered);
  };
  return <section className="perfume-panel">
    <div className="perfume-section-heading"><div><h2>Bộ ảnh sản phẩm</h2><p className="perfume-muted">Ảnh đầu tiên là ảnh đại diện và không nằm trong gallery ở trang chi tiết. Ảnh dung tích quản lý riêng trong tab Dung tích & giá.</p><p className="perfume-muted">{images.length}/30 ảnh · Tải tối đa 4 ảnh/lượt, 5 MB/ảnh.</p></div><label className="perfume-button"><Upload size={15} />Thêm ảnh<input className="sr-only" aria-label="Thêm ảnh sản phẩm" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading || images.length >= 30} onChange={event => { void onUpload([...event.target.files]); event.target.value = ""; }} /></label></div>
    {!images.length && <div className="perfume-gallery-empty"><Image size={34} strokeWidth={1.2} /><p>Chưa có ảnh sản phẩm. Thêm ảnh để đặt ảnh đại diện và xây dựng gallery.</p></div>}
    <div className="perfume-gallery">{images.map((image, index) => <div key={`${image}-${index}`}>
      <ProductImage src={image} alt={`Ảnh ${index + 1}`} imageWidth={500} />
      <div className="perfume-gallery-actions"><button type="button" className="perfume-button" disabled={index === 0 || uploading} onClick={() => onChange([image, ...images.filter((_, i) => i !== index)])}>{index === 0 ? "Ảnh đại diện" : "Đặt đại diện"}</button><label className="perfume-button">Đổi ảnh<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" aria-label={`Thay ảnh ${index + 1}`} disabled={uploading} onChange={event => { void onUpload([...event.target.files], { index }); event.target.value = ""; }} /></label><div className="perfume-gallery-order"><button type="button" className="perfume-icon-button" aria-label={`Đưa ảnh ${index + 1} lên trước`} disabled={index === 0 || uploading} onClick={() => move(index, -1)}><ArrowLeft size={14} /></button><button type="button" className="perfume-icon-button" aria-label={`Đưa ảnh ${index + 1} ra sau`} disabled={index === images.length - 1 || uploading} onClick={() => move(index, 1)}><ArrowRight size={14} /></button><button type="button" className="perfume-icon-button" aria-label={`Bỏ ảnh ${index + 1}`} disabled={uploading} onClick={() => onChange(images.filter((_, i) => i !== index))}><X size={15} /></button></div></div>
    </div>)}</div>
  </section>;
}
