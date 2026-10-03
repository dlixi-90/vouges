import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

export default function ProductReviews({ productId }) {
  const { user, axios, getToken, requireCartLogin } = useAppContext();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [own, setOwn] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(async (signal) => {
    const response = await axios.get(`/api/products/${productId}/reviews`, { params: { page }, signal });
    let own = null;
    if (user) {
      const mine = await axios.get(`/api/products/${productId}/reviews/mine`, {
        headers: { Authorization: `Bearer ${await getToken()}` }, signal,
      });
      own = { ...mine.data, userId: user.id };
    }
    return { data: response.data, own };
  }, [axios, getToken, productId, page, user]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setData(result.data); setOwn(result.own); setError("");
        setRating(result.own?.review?.rating || 5); setComment(result.own?.review?.comment || "");
      }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || err.message); });
    return () => controller.abort();
  }, [load, attempt]);
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await axios.put(`/api/products/${productId}/reviews/mine`, { rating, comment }, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      const result = await load(); setData(result.data); setOwn(result.own); setError("");
      toast.success("Đã lưu đánh giá.");
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };
  const eligible = own?.userId === user?.id && own?.eligible;
  return <section id="reviews" className="mt-10 rounded-xl border border-gray-200 bg-white p-5 sm:p-8">
    <h2 className="text-xl font-semibold">Đánh giá sản phẩm</h2>
    {data && <p className="mt-2 text-sm text-gray-500">{data.count ? `${data.average.toFixed(1)}/5 · ${data.count} đánh giá` : "Chưa có đánh giá."}</p>}
    {error && <div role="alert" className="mt-3 text-red-600">{error}<button onClick={() => setAttempt((value) => value + 1)} className="ml-2 underline">Thử lại</button></div>}
    {!data && !error && <p role="status" className="mt-4">Đang tải đánh giá…</p>}
    {!user ? <button onClick={requireCartLogin} className="mt-4 text-sm underline">Đăng nhập để đánh giá</button>
      : eligible ? <form onSubmit={save} className="my-6 max-w-xl space-y-3">
        <fieldset disabled={busy}><legend className="text-sm font-semibold">Số sao của bạn</legend>
          <div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="cursor-pointer">
            <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} className="peer sr-only" aria-label={`${value} sao`} />
            <Star size={27} className={`rounded peer-focus-visible:ring-2 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
          </label>)}</div>
        </fieldset>
        <label htmlFor="review-comment" className="block text-sm font-semibold">Nhận xét</label>
        <textarea id="review-comment" value={comment} onChange={(event) => setComment(event.target.value)} required maxLength={2000} rows={4} disabled={busy}
          className="w-full rounded-lg border p-3" placeholder="Chia sẻ trải nghiệm sử dụng sản phẩm" />
        <button disabled={busy} className="btn-dark !rounded-md">{busy ? "Đang lưu…" : own.review ? "Cập nhật đánh giá" : "Gửi đánh giá"}</button>
      </form> : <p className="mt-4 text-sm text-gray-500">Bạn có thể đánh giá sau khi đơn có sản phẩm này đã được giao.</p>}
    <div className="mt-5 divide-y">{data?.reviews.map((review) => <article key={review._id} className="py-4">
      <div className="flex flex-wrap items-center gap-3"><p className="font-semibold">{review.authorName}</p>
        <span aria-label={`${review.rating} trên 5 sao`} className="text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
        <span className="text-xs text-gray-500">Đã mua hàng · {new Date(review.createdAt).toLocaleDateString("vi-VN")}</span></div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{review.comment}</p>
    </article>)}</div>
    {data?.count > 10 && <div className="mt-4 flex items-center gap-4 text-sm">
      <button disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)} className="underline disabled:opacity-40">Trang trước</button>
      <span>Trang {page}</span><button disabled={page * 10 >= data.count || busy} onClick={() => setPage((value) => value + 1)} className="underline disabled:opacity-40">Trang sau</button>
    </div>}
  </section>;
}
