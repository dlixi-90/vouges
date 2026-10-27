export default function VariantStockSummary({ product, expanded = false }) {
  const sizes = product.sizes || [];
  const quantity = size => Number(product.stockBySize?.[size]) || 0;
  const total = sizes.reduce((sum, size) => sum + quantity(size), 0);
  return <details className="perfume-variant-stock" open={expanded}><summary>{product.inventoryMode === "source" ? "Kho nội bộ" : "Tồn kho"}: {total.toLocaleString("vi-VN")}</summary><ul>{sizes.map(size => <li key={size}><span>{size}</span><strong>{quantity(size).toLocaleString("vi-VN")} sp</strong></li>)}</ul>{product.inventoryMode === "source" && <small>Đặt hàng theo trạng thái còn / hết.</small>}</details>;
}
