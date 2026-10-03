import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { formatThousandsVnd } from "../utils/money";

export default function Membership() {
  const { user, axios, getToken, requireCartLogin } = useAppContext();
  const [data, setData] = useState(null);
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(async (signal) => {
    const headers = { Authorization: `Bearer ${await getToken()}` };
    const [profile, wallet] = await Promise.all([
      axios.get("/api/users", { headers, signal }), axios.get("/api/vouchers/mine", { headers, signal }),
    ]);
    if (!profile.data.success || !wallet.data.success) throw new Error("Không thể tải hồ sơ thành viên.");
    return { userId: user.id, profile: profile.data.profile, vouchers: wallet.data.vouchers };
  }, [axios, getToken, user]);
  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    load(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setData(result); setBirthday(result.profile.birthday); setError(""); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || err.message); });
    return () => controller.abort();
  }, [load, user, attempt]);
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await axios.patch("/api/users/birthday", { birthday }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      setData(await load()); toast.success("Đã lưu ngày sinh.");
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setSaving(false); }
  };
  const current = data?.userId === user?.id ? data : null;
  return <div className="max-padd-container min-h-screen bg-primary pb-16 pt-28">
    <h1 className="mb-6 text-2xl font-semibold">Thành viên & voucher</h1>
    {!user ? <button onClick={requireCartLogin} className="btn-dark">Đăng nhập để xem ưu đãi</button>
      : error ? <div role="alert">{error}<button onClick={() => setAttempt((value) => value + 1)} className="ml-3 underline">Thử lại</button></div>
      : !current ? <p role="status">Đang tải…</p> : <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-6">
          <h2 className="text-lg font-semibold">Hồ sơ khách hàng</h2>
          <p className="mt-3">{current.profile.username}</p>
          <p className="text-sm text-gray-500">{current.profile.phone}</p>
          <p className="text-sm text-gray-500">{current.profile.email}</p>
          <form onSubmit={save} className="mt-5">
            <label htmlFor="birthday" className="block text-sm font-medium">Ngày sinh</label>
            <input id="birthday" type="date" required min="1900-01-01" value={birthday}
              disabled={Boolean(current.profile.birthday) || saving} onChange={(event) => setBirthday(event.target.value)}
              className="mt-2 rounded-md border p-3 disabled:bg-gray-100" />
            <p className="mt-3 text-sm text-gray-500">Lưu ngày sinh một lần để nhận ưu đãi hằng năm. Liên hệ cửa hàng nếu cần sửa.</p>
            {!current.profile.birthday && <button disabled={saving} className="btn-dark mt-4 !rounded-md">{saving ? "Đang lưu…" : "Lưu ngày sinh"}</button>}
          </form>
          <p className="mt-6 text-sm leading-6">Quà sinh nhật: giảm 10%, tối đa 100.000đ cho đơn từ 300.000đ. Có hiệu lực 7 ngày từ ngày sinh nhật, một lần mỗi năm. Sinh ngày 29/2 được nhận quà ngày 28/2 trong năm không nhuận.</p>
        </section>
        <section className="rounded-xl bg-white p-6">
          <h2 className="text-lg font-semibold">Voucher có thể sử dụng</h2>
          {!current.vouchers.length && <p className="mt-4 text-sm text-gray-500">Chưa có voucher khả dụng.</p>}
          <div className="mt-4 space-y-4">{current.vouchers.map((voucher) => <article key={voucher._id} className="rounded-lg border border-dashed border-secondary/40 p-4">
            <h3 className="font-semibold">{voucher.kind === "birthday" ? "Chúc mừng sinh nhật!" : "Ưu đãi thành viên"}</h3>
            <p className="mt-1 text-sm">Giảm {voucher.type === "percent" ? `${voucher.value}%` : formatThousandsVnd(voucher.value)}
              {voucher.maxDiscount != null && `, tối đa ${formatThousandsVnd(voucher.maxDiscount)}`}</p>
            <p className="mt-1 text-xs text-gray-500">Đơn từ {formatThousandsVnd(voucher.minSubtotal)} · Hết hạn {new Date(voucher.expiresAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
            <p className="mt-3 break-all font-mono text-sm">{voucher.code}</p>
            <button type="button" className="mt-2 text-sm text-secondary underline" onClick={async () => {
              try { await navigator.clipboard.writeText(voucher.code); toast.success("Đã sao chép mã."); }
              catch { toast.error("Hãy chọn và sao chép mã hiển thị."); }
            }}>Sao chép mã</button>
          </article>)}</div>
          <Link to="/cart" className="btn-dark mt-6 inline-block !rounded-md">Đến giỏ hàng</Link>
        </section>
      </div>}
  </div>;
}
