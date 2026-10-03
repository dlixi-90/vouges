import { useEffect, useId, useRef, useState } from "react";
import { Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";

const ratingLabels = ["Rất không hài lòng", "Không hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];

const ProductReviewForm = ({ productId, onSaved, onCancel, onBusyChange }) => {
  const { user, axios, getToken, requireCartLogin } = useAppContext();
  const userId = user?.id;
  const formId = useId();
  const tokenRef = useRef(getToken);
  const saveRequestRef = useRef(null);
  const [own, setOwn] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { tokenRef.current = getToken; }, [getToken]);
  useEffect(() => () => saveRequestRef.current?.abort(), [productId, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    const load = async () => {
      try {
        const token = await tokenRef.current();
        controller.signal.throwIfAborted();
        const { data } = await axios.get(`/api/products/${productId}/reviews/mine`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, timeout: 15000,
        });
        if (!data.success) throw new Error(data.message || "Không thể tải đánh giá của bạn.");
        if (controller.signal.aborted) return;
        setOwn({ ...data, userId });
        setRating(data.review?.rating || 0);
        setComment(data.review?.comment || "");
        setError("");
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.message || err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [axios, productId, userId, attempt]);

  const save = async (event) => {
    event.preventDefault();
    if (saveRequestRef.current || !own?.eligible || own.userId !== userId) return;
    if (rating < 1 || rating > 5 || !comment.trim()) return toast.error("Chọn số sao và viết nhận xét của bạn.");
    const controller = new AbortController();
    saveRequestRef.current = controller;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const token = await tokenRef.current();
      controller.signal.throwIfAborted();
      const { data } = await axios.put(`/api/products/${productId}/reviews/mine`, { rating, comment: comment.trim() }, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, timeout: 15000,
      });
      if (!data.success) throw new Error(data.message || "Không thể lưu đánh giá.");
      if (controller.signal.aborted) return;
      setOwn({ userId, eligible: true, review: data.review });
      setRating(data.review.rating);
      setComment(data.review.comment);
      toast.success("Đã lưu đánh giá sản phẩm.");
      onSaved?.(data.review);
    } catch (err) {
      if (!controller.signal.aborted) toast.error(err.response?.data?.message || err.message);
    } finally {
      saveRequestRef.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  };

  if (!userId) return <button type="button" onClick={requireCartLogin} className="btn-outline !rounded-md">Đăng nhập để đánh giá</button>;
  if (error) return <div role="alert" className="rounded-lg bg-primary p-4 text-sm">
    <p className="text-red-600">{error}</p>
    <button type="button" onClick={() => { setError(""); setOwn(null); setAttempt((value) => value + 1); }} className="mt-3 cursor-pointer text-secondary underline">Thử lại</button>
  </div>;
  if (own?.userId !== userId) return <p role="status" className="text-sm text-gray-500">Đang kiểm tra sản phẩm đã mua…</p>;
  if (!own.eligible) return <p className="text-sm text-gray-500">Bạn có thể đánh giá sản phẩm sau khi đơn hàng đã được giao. Vào My Orders để xem trạng thái đơn.</p>;

  return (
    <form onSubmit={save} className="space-y-4">
      <h3 className="font-semibold">{own.review ? "Cập nhật đánh giá của bạn" : "Chia sẻ trải nghiệm của bạn"}</h3>
      <fieldset disabled={busy}>
        <legend className="text-sm font-medium">Chất lượng sản phẩm</legend>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex gap-2">{[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className={`rounded-md p-1 ${busy ? "cursor-not-allowed" : "cursor-pointer"}`}>
              <input type="radio" name={`rating-${formId}`} value={value} required checked={rating === value} onChange={() => setRating(value)}
                className="peer sr-only" aria-label={`${value} sao: ${ratingLabels[value - 1]}`} />
              <Star size={30} aria-hidden="true" className={`rounded peer-focus-visible:ring-2 peer-focus-visible:ring-secondary ${value <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
            </label>
          ))}</div>
          <span className="text-sm text-gray-500" aria-live="polite">{rating ? `${rating}/5 · ${ratingLabels[rating - 1]}` : "Chọn từ 1 đến 5 sao"}</span>
        </div>
      </fieldset>
      <div>
        <label htmlFor={`comment-${formId}`} className="mb-2 block text-sm font-medium">Nhận xét của bạn</label>
        <textarea id={`comment-${formId}`} value={comment} onChange={(event) => setComment(event.target.value)} required maxLength={2000} rows={4} disabled={busy}
          aria-describedby={`comment-limit-${formId}`} className="w-full resize-y rounded-lg border border-gray-200 p-3 text-sm focus:outline-secondary disabled:opacity-50"
          placeholder="Chia sẻ cảm nhận về chất lượng, công dụng và trải nghiệm sử dụng sản phẩm…" />
        <p id={`comment-limit-${formId}`} className="mt-1 text-right text-xs text-gray-500">{comment.length}/2.000 ký tự</p>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className="btn-outline !rounded-md disabled:opacity-50">Để sau</button>}
        <button type="submit" disabled={busy || rating === 0 || !comment.trim()} className="btn-dark !rounded-md disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Đang lưu…" : own.review ? "Cập nhật đánh giá" : "Gửi đánh giá"}
        </button>
      </div>
    </form>
  );
};

export default ProductReviewForm;
