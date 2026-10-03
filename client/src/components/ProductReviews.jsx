import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import ProductReviewForm from "./ProductReviewForm";

export default function ProductReviews({ productId }) {
  const { user, axios } = useAppContext();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(async (signal) => {
    const { data } = await axios.get(`/api/products/${productId}/reviews`, { params: { page }, signal, timeout: 15000 });
    if (!data.success) throw new Error(data.message || "Không thể tải đánh giá sản phẩm.");
    return data;
  }, [axios, productId, page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setData(result); setError(""); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || err.message); });
    return () => controller.abort();
  }, [load, attempt]);

  const changePage = (nextPage) => {
    setData(null);
    setError("");
    setPage(nextPage);
  };

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
      <div className="mt-5 divide-y divide-gray-100">{data?.reviews.map((review) => (
        <article key={review._id} className="py-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold">{review.authorName || "Khách hàng"}</p>
            <span aria-label={`${review.rating} trên 5 sao`} className="text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
            <span className="text-xs text-gray-500">Đã mua hàng · {new Date(review.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{review.comment}</p>
        </article>
      ))}</div>
      {data?.count > 10 && <div className="mt-4 flex items-center gap-4 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} className="cursor-pointer underline disabled:opacity-40">Trang trước</button>
        <span>Trang {page}</span>
        <button type="button" disabled={page * 10 >= data.count} onClick={() => changePage(page + 1)} className="cursor-pointer underline disabled:opacity-40">Trang sau</button>
      </div>}
    </section>
  );
}
