import { useEffect, useId, useRef } from "react";
import ProductDescription from "./ProductDescription";
import ProductReviews from "./ProductReviews";

export default function ProductDetailTabs({ product, activeTab, onTabChange, reviewStats, onSummaryChange }) {
  const id = useId();
  const tabRefs = useRef([]);
  const listRef = useRef(null);
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector('[aria-selected="true"]');
    if (!selected) return;
    const left = selected.offsetLeft, right = left + selected.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = left;
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth;
  }, [activeTab]);
  const tabs = [
    { id: "description", label: "Mô tả", content: <ProductDescription product={product} /> },
    { id: "reviews", label: "Đánh giá và nhận xét sản phẩm", content: <ProductReviews productId={product._id} onSummaryChange={onSummaryChange} embedded /> },
  ];
  const moveFocus = (event, index) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onTabChange(tabs[next].id);
    tabRefs.current[next]?.focus({ preventScroll: true });
    tabRefs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  return <div className="product-detail-tabs">
    <div ref={listRef} className="product-detail-tab-list" role="tablist" aria-label="Thông tin chi tiết nước hoa">
      {tabs.map((tab, index) => <button key={tab.id} ref={element => { tabRefs.current[index] = element; }} id={`${id}-${tab.id}-tab`} type="button" role="tab" data-product-tab={tab.id} aria-selected={activeTab === tab.id} aria-controls={`${id}-${tab.id}-panel`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => onTabChange(tab.id)} onKeyDown={event => moveFocus(event, index)}>
        {tab.label}{tab.id === "reviews" && reviewStats && !reviewStats.error && <span> ({reviewStats.count.toLocaleString("vi-VN")})</span>}
      </button>)}
    </div>
    {tabs.map(tab => <div key={tab.id} id={`${id}-${tab.id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab.id}-tab`} tabIndex={0} hidden={activeTab !== tab.id} className="product-detail-tab-panel">{tab.content}</div>)}
  </div>;
}
