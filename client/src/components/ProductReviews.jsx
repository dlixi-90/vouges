import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import ProductReviewForm from "./ProductReviewForm";
import Pagination from "./Pagination";
import usePaginationScroll from "../hooks/usePaginationScroll";

export default function ProductReviews({ productId, onSummaryChange }) {
  const { user, storeResources } = useAppContext();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(() => storeResources.peekReviews(productId) || null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => storeResources.loadReviews(productId, page), [storeResources, productId, page]);

  useEffect(() => {
    let active = true;
    load().then((result) => {
      if (active) {
        setData(result);
        setError("");
        // Share the existing request's aggregate with the product header.
        onSummaryChange?.({ productId, count: result.count, average: result.average });
      }
    }).catch((err) => {
      if (active && err.name !== "AbortError") {
        const message = err.response?.data?.message || err.message;
        setError(message);
        onSummaryChange?.({ productId, error: message });
      }
    });
    return () => { active = false; };
  }, [load, attempt, productId, onSummaryChange]);

  const { listRef, changePage } = usePaginationScroll({ page, ready: Boolean(data), onPageChange: (nextPage) => {
    setData(storeResources.peekReviews(productId, nextPage) || null);
    setError("");
    setPage(nextPage);
  } });

  return (
    <section id="reviews" className="mt-10 scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Đánh giá & nhận xét sản phẩm</h2>
        {data && <div className="flex items-center gap-2 text-sm">
          <Star size={21} className="fill-amber-400 text-amber-400" aria-hidden="true" />
          <span className="font-semibold">{data.count ? `${data.average.toFixed(1)}/5` : "Chưa có đánh giá"}</span>
          {data.count > 0 && <span className="text-gray-500">({data.count} đánh giá)</span>}
        </div>}
      </div>
      <div className="my-6 rounded-lg bg-primary/60 p-4 sm:p-5">
        <ProductReviewForm key={`${productId}::${user?.id || "guest"}`} productId={productId}
          onSaved={() => { setPage(1); setAttempt((value) => value + 1); }} />
      </div>
      {error && <div role="alert" className="mt-3 text-sm text-red-600">{error}
        <button type="button" onClick={() => setAttempt((value) => value + 1)} className="ml-2 cursor-pointer underline">Thử lại</button>
      </div>}
      {!data && !error && <p role="status" className="mt-4 text-sm text-gray-500">Đang tải đánh giá…</p>}
      <div ref={listRef} tabIndex={-1} className="pagination-list-start mt-5 divide-y divide-gray-100">{data?.reviews.map((review) => (
        <article key={review._id} className="py-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold">{review.authorName || "Khách hàng"}</p>
            <span aria-label={`${review.rating} trên 5 sao`} className="text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
            <span className="text-xs text-gray-500">Đã mua hàng · {new Date(review.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{review.comment}</p>
        </article>
      ))}</div>
      {data?.count > 10 && <Pagination className="mt-5" label="Phân trang đánh giá" page={page} totalPages={Math.ceil(data.count / 10)} onPageChange={changePage} />}
    </section>
  );
}
