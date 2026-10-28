import { lazy, Suspense, useState } from "react";
import { ArrowUpRight, Banknote, CalendarDays, ChevronRight, Database, Layers3, Library, Package, ShoppingBag, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { CatalogPage, CatalogState, RefreshButton, useCatalog, Badge, issueLabels } from "../../components/owner/CatalogUI";
import ProductImage from "../../components/ProductImage";
import { usePopularProducts } from "../../hooks/usePopularProducts";
import { formatVnd } from "../../utils/money";

const RevenueChart = lazy(() => import("../../components/owner/RevenueChart"));
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const count = value => value == null ? "—" : Number(value).toLocaleString("vi-VN");
const priceFrom = product => {
  const prices = Object.values(product.price || {}).filter(value => Number.isFinite(value) && value > 0);
  return prices.length ? formatVnd(Math.min(...prices)) : "Chưa có giá";
};

function MetricCard({ label, value, detail, to, icon: Icon, primary }) {
  return <Link to={to} className={`admin-metric-card${primary ? " is-primary" : ""}`}>
    <div className="admin-metric-top"><span className="admin-metric-icon"><Icon size={18} strokeWidth={1.7} /></span><span>{label}</span><ArrowUpRight size={15} className="admin-metric-arrow" /></div>
    <strong>{value}</strong><p>{detail}</p>
  </Link>;
}

function CatalogDistribution({ metrics }) {
  const published = Number(metrics.published || 0);
  const available = Math.min(published, Number(metrics.available || 0));
  const hidden = Number(metrics.hidden || 0);
  const total = Number(metrics.total || 0);
  const parts = [
    { label: "Đang mở bán", value: available, color: "#181818" },
    { label: "Hiển thị · hết hàng", value: published - available, color: "#999999" },
    { label: "Đang ẩn", value: hidden, color: "#dedede" },
  ];
  let offset = 0;
  return <div className="admin-distribution">
    <div className="admin-donut" role="img" aria-label={`Tổng ${count(metrics.total)} sản phẩm: ${parts.map(part => `${part.label} ${count(part.value)}`).join(", ")}`}>
      <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="61" fill="none" stroke="#f0f0f0" strokeWidth="17" />{parts.map(part => {
        const length = total ? part.value / total * 100 : 0;
        const start = offset; offset += length;
        return <circle key={part.label} cx="80" cy="80" r="61" fill="none" stroke={part.color} strokeWidth="17" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 80 80)" />;
      })}</svg>
      <div><strong>{count(metrics.total)}</strong><span>Sản phẩm</span></div>
    </div>
    <ul>{parts.map(part => <li key={part.label}><span><i style={{ background: part.color }} />{part.label}</span><strong>{count(part.value)}</strong></li>)}</ul>
  </div>;
}

export default function PerfumeOverview() {
  const query = useCatalog("/summary");
  const recent = useCatalog("/products?page=1&pageSize=12&sort=newest");
  const quality = useCatalog("/products?page=1&pageSize=12&quality=issues");
  const sales = useCatalog(`/dashboard?page=1&pageSize=10&timezone=${encodeURIComponent(timezone)}`, "/api/orders");
  const { popularProducts, popularProductsError, fetchPopularProducts } = usePopularProducts();
  const [months, setMonths] = useState(6);
  const { data } = query;
  const metrics = data?.metrics || {};
  const monthlyData = (sales.data?.dashboardData?.monthlyData || []).slice(-months);
  const hasSales = monthlyData.some(month => month.total > 0 || month.successful > 0);
  const ranking = popularProducts.length > 0;
  const products = (ranking ? popularProducts : recent.data?.products || []).slice(0, 5);
  const libraries = Object.fromEntries((data?.libraries || []).map(item => [item._id, item]));
  const refresh = () => { query.reload(); recent.reload(); quality.reload(); sales.reload(); void fetchPopularProducts(); };

  return <CatalogPage title="Tổng quan dashboard" actions={<><RefreshButton onClick={refresh} disabled={query.loading || sales.loading} /><Link to="/owner/list-product" className="perfume-button primary"><Package size={15} />Quản lý sản phẩm</Link></>}>
    <CatalogState {...query} />
    <div className="admin-metric-grid">
      <MetricCard primary label="Tổng doanh thu" value={data ? formatVnd(data.orders.revenue) : "—"} detail="Từ các đơn đã xác nhận thanh toán" to="/owner/orders" icon={Banknote} />
      <MetricCard label="Tổng đơn hàng" value={count(data?.orders?.count)} detail="Đơn hàng thực tế của Velours" to="/owner/orders" icon={ShoppingBag} />
      <MetricCard label="Tổng sản phẩm" value={count(metrics.total)} detail={`${count(metrics.published)} sản phẩm đang hiển thị`} to="/owner/list-product" icon={Package} />
      <MetricCard label="Có thể đặt hàng" value={count(metrics.available)} detail="Đang hiển thị và còn hàng" to="/owner/list-product?stock=true&published=true" icon={Layers3} />
    </div>

    <div className="admin-overview-grid">
      <section className="admin-dashboard-panel admin-revenue-panel">
        <header className="admin-panel-heading"><div><h2>Doanh thu & giá trị đơn hàng</h2><p>Đơn vị: VND · Theo thời điểm tạo đơn</p></div><label className="admin-period-control"><CalendarDays size={15} /><select aria-label="Khoảng thời gian biểu đồ" value={months} onChange={event => setMonths(Number(event.target.value))}><option value={6}>6 tháng</option><option value={3}>3 tháng</option></select></label></header>
        <CatalogState {...sales} />
        {!sales.loading && !sales.error && <div className="admin-revenue-chart"><Suspense fallback={<p className="perfume-loading">Đang tải biểu đồ…</p>}><RevenueChart data={monthlyData} currency="₫" /></Suspense>{!hasSales && <div className="admin-chart-empty"><Banknote size={23} strokeWidth={1.4} /><strong>Chưa có giao dịch trong kỳ</strong><span>Biểu đồ sẽ cập nhật khi phát sinh đơn hàng.</span></div>}</div>}
      </section>
      <section className="admin-dashboard-panel">
        <header className="admin-panel-heading"><div><h2>Trạng thái danh mục</h2><p>Phân bổ catalog hiện tại</p></div><Link to="/owner/inventory" aria-label="Xem trạng thái hàng" className="admin-panel-arrow"><ArrowUpRight size={16} /></Link></header>
        <CatalogDistribution metrics={metrics} />
      </section>

      <section className="admin-dashboard-panel admin-products-panel">
        <header className="admin-panel-heading"><div><h2>{ranking ? "Sản phẩm bán chạy" : "Sản phẩm mới cập nhật"}</h2><p>{ranking ? "Theo số lượng đã thanh toán" : "Những hồ sơ mới nhất trong catalog"}</p></div><Link to="/owner/list-product" className="admin-view-all">Xem tất cả <ChevronRight size={13} /></Link></header>
        <CatalogState {...recent} />
        {popularProductsError && <p role="alert" className="perfume-muted admin-inline-message">{popularProductsError}</p>}
        <div className="perfume-table-scroll"><table className="admin-overview-table"><thead><tr><th>Sản phẩm</th><th>{ranking ? "Đã bán" : "Phân loại"}</th><th>Giá từ</th><th>Trạng thái</th></tr></thead><tbody>{products.map(product => <tr key={product._id}><td><Link className="admin-table-product" to={`/owner/edit-product/${product._id}`}><span className="admin-product-image">{product.images?.[0] ? <ProductImage src={product.images[0]} alt="" imageWidth={100} /> : <Package size={21} />}</span><span><strong>{product.title}</strong><small>{product.brand || product.category}</small></span></Link></td><td>{ranking ? count(product.soldQuantity) : `${product.sizes?.length || 0} dung tích`}</td><td className="admin-price-cell">{priceFrom(product)}</td><td><Badge>{product.inStock ? "Còn hàng" : "Hết hàng"}</Badge></td></tr>)}</tbody></table></div>
        {!recent.loading && !recent.error && !products.length && <p className="perfume-empty">Chưa có sản phẩm trong catalog.</p>}
      </section>
      <section className="admin-dashboard-panel admin-attention-panel">
        <header className="admin-panel-heading"><div><h2>Hồ sơ cần hoàn thiện</h2><p>{count(metrics.issues)} sản phẩm cần kiểm tra</p></div><Link to="/owner/quality" className="admin-view-all">Xem tất cả</Link></header>
        <CatalogState {...quality} />
        <div className="admin-attention-list">{(quality.data?.products || []).slice(0, 4).map(product => <Link key={product._id} to={`/owner/edit-product/${product._id}`}><span className="admin-product-image">{product.images?.[0] ? <ProductImage src={product.images[0]} alt="" imageWidth={100} /> : <Package size={20} />}</span><span><strong>{product.title}</strong><small>{issueLabels[product.qualityIssues?.[0]] || "Cần kiểm tra thông tin"}</small></span><Badge>{product.qualityIssues?.length || 0} mục</Badge></Link>)}</div>
        {!quality.loading && !quality.error && !quality.data?.products?.length && <p className="perfume-empty">Các hồ sơ đã có đủ trường thông tin cơ bản.</p>}
        <Link to="/owner/quality" className="admin-attention-footer"><Sparkles size={15} />Hoàn thiện trải nghiệm sản phẩm<ArrowUpRight size={14} /></Link>
      </section>
    </div>

    <section className="admin-catalog-footer" aria-label="Thư viện và dữ liệu">
      <div className="admin-library-links"><div className="admin-footer-title"><Library size={17} /><strong>Thư viện mùi hương</strong></div><div>{[{ kind: "brand", label: "Thương hiệu" }, { kind: "group", label: "Nhóm hương" }, { kind: "accord", label: "Kiểu mùi" }, { kind: "note", label: "Note hương" }].map(({ kind, label }) => <Link key={kind} to={kind === "brand" ? "/owner/brands" : `/owner/library?kind=${kind}`}><span>{label}</span><strong>{count(libraries[kind]?.count)}</strong><ArrowUpRight size={14} /></Link>)}</div></div>
      <Link className="admin-source-summary" to="/owner/data"><span className="admin-metric-icon"><Database size={20} /></span><div><strong className="perfume-source-count">{count(data?.sourceCount)}</strong><span>Bản ghi Apaniche · VND</span></div><ArrowUpRight size={17} /></Link>
    </section>
  </CatalogPage>;
}
