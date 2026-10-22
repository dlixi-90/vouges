import { useEffect, useState } from "react";
import { useClerk } from "@clerk/react";
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Copy, Gift, LoaderCircle, Mail, Phone, RefreshCw, Settings, ShoppingBag, Sparkles, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { formatThousandsVnd } from "../utils/money";
import { formatVoucherExpiryDate } from "../utils/voucherDates";

const focusStyles = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary";

export default function Membership() {
  const { openUserProfile } = useClerk();
  const { user, axios, getToken, requireCartLogin, storeResources } = useAppContext();
  const userId = user?.id;
  const [data, setData] = useState(() => storeResources.peekMembership() || null);
  const [loadedAt, setLoadedAt] = useState(Date.now);
  const [birthday, setBirthday] = useState(() => storeResources.peekMembership()?.profile.birthday || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    storeResources.loadMembership().then((result) => {
      if (active) {
        setData(result);
        setLoadedAt(Date.now());
        setBirthday(result.profile.birthday || "");
        setError("");
      }
    }).catch((err) => {
      if (active && err.name !== "AbortError") setError(err.response?.data?.message || err.message);
    });
    return () => { active = false; };
  }, [storeResources, userId, attempt]);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await axios.patch("/api/users/birthday", { birthday }, { headers: { Authorization: `Bearer ${await getToken()}` } });
      storeResources.invalidateMembership();
      setData(await storeResources.loadMembership());
      setLoadedAt(Date.now());
      toast.success("Đã lưu ngày sinh.");
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setSaving(false); }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Đã sao chép mã.");
    } catch { toast.error("Hãy chọn và sao chép mã hiển thị."); }
  };

  const current = data?.userId === userId ? data : null;
  const vouchers = (current?.vouchers || []).filter((voucher) => new Date(voucher.expiresAt).getTime() > loadedAt);
  const displayName = user?.fullName || current?.profile.username || "Thành viên Velours";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return (
    <main className="net-membership min-h-screen pb-16 pt-28 text-secondary sm:pb-20">
      <div className="max-padd-container">
        <header className="net-member-header mb-8 flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="net-member-eyebrow mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <Sparkles size={15} aria-hidden="true" />Chương trình thành viên Velours
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Thành viên & mã giảm giá</h1>
            <p className="net-member-muted mt-3 max-w-xl text-sm leading-6">Góc nhỏ dành riêng cho bạn. Lưu giữ thông tin và khám phá những ưu đãi từ Velours.</p>
          </div>
          <Link to="/collection" className={`btn-outline inline-flex w-fit shrink-0 items-center gap-2 px-5 py-3 text-sm font-medium transition ${focusStyles}`}>
            Khám phá sản phẩm<ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </header>

        {!user ? (
          <section className="net-member-panel flex flex-col items-center px-6 py-16 text-center">
            <span className="net-member-empty-icon mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"><Ticket size={30} strokeWidth={1.5} aria-hidden="true" /></span>
            <h2 className="text-xl font-semibold">Ưu đãi của bạn đang chờ</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">Đăng nhập để xem ví mã giảm giá và lưu ngày sinh nhận quà hằng năm.</p>
            <button type="button" onClick={requireCartLogin} className={`mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-medium text-white transition hover:bg-secondary/90 ${focusStyles}`}>
              Đăng nhập<ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        ) : error ? (
          <div role="alert" className="net-member-panel px-6 py-10 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={() => { setError(""); setData(null); setAttempt((value) => value + 1); }}
              className={`mx-auto mt-4 flex cursor-pointer items-center gap-2 rounded-full border border-secondary/20 px-5 py-2.5 text-sm font-medium ${focusStyles}`}>
              <RefreshCw size={15} aria-hidden="true" />Thử lại
            </button>
          </div>
        ) : !current ? (
          <div role="status" className="net-member-panel net-member-muted flex items-center justify-center gap-3 py-24 text-sm">
            <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />Đang tải ưu đãi của bạn…
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
            <div className="min-w-0">
              <section aria-labelledby="member-profile-title" className="net-member-panel overflow-hidden">
                <div className="net-member-profile-cover p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="net-member-brand text-[10px] font-semibold uppercase tracking-[0.2em]">Velours</span>
                    <button type="button" onClick={() => openUserProfile()} aria-label="Quản lý tài khoản" title="Quản lý tài khoản"
                      className={`net-member-settings -m-2 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition ${focusStyles}`}>
                      <Settings size={20} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-6 flex items-center gap-4">
                    <div className="net-member-avatar flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border">
                      {user.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xl font-medium">{displayName.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0">
                      <h2 id="member-profile-title" className="break-words text-xl font-semibold">{displayName}</h2>
                      <p className="net-member-muted mt-1 text-xs">Thành viên của Velours</p>
                    </div>
                  </div>
                </div>
                <dl className="net-member-details space-y-5 p-6">
                  <div className="flex items-start gap-3">
                    <Mail size={17} className="net-member-icon mt-1 shrink-0" aria-hidden="true" />
                    <div className="min-w-0"><dt className="text-xs text-gray-500">Thư điện tử</dt><dd className="mt-1 break-all text-sm">{current.profile.email || "Chưa cập nhật"}</dd></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone size={17} className="net-member-icon mt-1 shrink-0" aria-hidden="true" />
                    <div className="min-w-0"><dt className="text-xs text-gray-500">Số điện thoại</dt><dd className="mt-1 break-words text-sm">{current.profile.phone || "Chưa cập nhật"}</dd></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays size={17} className="net-member-icon mt-1 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs text-gray-500">Ngày sinh</dt>
                      <dd className="mt-1 text-sm">
                        {current.profile.birthday ? current.profile.birthday.split("-").reverse().join("/") : (
                          <form onSubmit={save} className="space-y-3 pt-1">
                            <label htmlFor="birthday" className="sr-only">Ngày sinh</label>
                            <input id="birthday" type="date" required min="1900-01-01" max={today} value={birthday} disabled={saving}
                              aria-describedby="birthday-once" onChange={(event) => setBirthday(event.target.value)}
                              className="net-member-date block min-w-0 w-full rounded-lg border px-3 py-2 text-sm outline-none transition disabled:opacity-50" />
                            <p id="birthday-once" className="text-xs text-gray-500">Ngày sinh chỉ được lưu một lần.</p>
                            <button type="submit" disabled={saving} className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium text-white transition hover:bg-secondary/90 disabled:cursor-wait disabled:opacity-60 ${focusStyles}`}>
                              {saving && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
                              {saving ? "Đang lưu…" : "Lưu ngày sinh"}
                            </button>
                          </form>
                        )}
                      </dd>
                    </div>
                  </div>
                </dl>
              </section>
            </div>

            <div className="min-w-0 space-y-6">
              <section aria-labelledby="birthday-gift-title" className="net-member-gift overflow-hidden rounded-[20px] border p-6 sm:p-7">
                <div className="net-member-gift-layout flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <span className="net-member-gift-label mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"><Gift size={13} aria-hidden="true" />Quà sinh nhật</span>
                    <h2 id="birthday-gift-title" className="max-w-sm text-xl font-semibold leading-snug sm:text-2xl">Một ngày đặc biệt.<br />Một món quà dành riêng bạn.</h2>
                    <p className="net-member-muted mt-3 text-sm leading-6">Giảm tối đa 100.000đ cho đơn từ 300.000đ.</p>
                  </div>
                  <div className="net-member-gift-value shrink-0 text-center">
                    <p className="net-member-muted text-[11px] font-medium">Ưu đãi</p>
                    <p className="net-member-discount mt-1 font-semibold tracking-tighter">10<span>%</span></p>
                  </div>
                </div>
                <p className="net-member-gift-note net-member-muted mt-6 border-t pt-4 text-xs leading-5">Có hiệu lực 7 ngày từ ngày sinh nhật, một lần mỗi năm. Sinh ngày 29/2 nhận quà ngày 28/2 trong năm không nhuận.</p>
              </section>

              <section aria-labelledby="member-wallet-title" className="net-member-panel overflow-hidden">
                <div className="net-member-wallet-header flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5">
                  <h2 id="member-wallet-title" className="flex items-center gap-2.5 text-lg font-semibold"><Ticket size={21} strokeWidth={1.7} aria-hidden="true" />Ví mã giảm giá</h2>
                  <span className="net-member-wallet-count rounded-full px-3 py-1.5 text-xs font-medium">{vouchers.length} mã khả dụng</span>
                </div>
                {vouchers.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-12 text-center sm:py-14">
                    <span className="net-member-empty-icon mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"><Ticket size={32} strokeWidth={1.3} aria-hidden="true" /></span>
                    <h3 className="text-base font-semibold">Hẹn bạn ở ưu đãi tiếp theo</h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">Mã giảm giá còn hiệu lực và bạn chưa sử dụng sẽ xuất hiện tại đây.</p>
                    <Link to="/collection" className={`mt-5 inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium underline decoration-secondary/25 underline-offset-4 ${focusStyles}`}>
                      Tìm sản phẩm yêu thích<ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4 p-5 sm:p-6">
                    {vouchers.map((voucher) => (
                      <article key={voucher._id} className="net-member-voucher overflow-hidden rounded-2xl border sm:flex">
                        <div className="net-member-voucher-value flex shrink-0 items-center justify-between gap-4 border-b border-dashed px-5 py-4 sm:w-36 sm:flex-col sm:justify-center sm:gap-1 sm:border-b-0 sm:border-r sm:px-3">
                          <span className="text-[10px] font-medium uppercase tracking-[0.16em]">Giảm</span>
                          <p className={`font-semibold tracking-tight ${voucher.type === "percent" ? "text-3xl" : "text-xl"}`}>{voucher.type === "percent" ? `${voucher.value}%` : formatThousandsVnd(voucher.value)}</p>
                        </div>
                        <div className="min-w-0 flex-1 p-5">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">{voucher.kind === "birthday" && <Gift size={15} aria-hidden="true" />}{voucher.kind === "birthday" ? "Mừng sinh nhật bạn" : "Ưu đãi từ Velours"}</h3>
                          <p className="mt-2 text-xs leading-5 text-gray-500">Đơn từ {formatThousandsVnd(voucher.minSubtotal)}{voucher.maxDiscount != null && ` · Giảm tối đa ${formatThousandsVnd(voucher.maxDiscount)}`}</p>
                          <p className="mt-1 text-xs text-gray-500">Hết hạn {formatVoucherExpiryDate(voucher.expiresAt)}</p>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-secondary/15 pt-3">
                            <code className="net-member-voucher-code min-w-0 select-all break-all rounded-md px-2 py-1 text-xs font-semibold tracking-wide">{voucher.code}</code>
                            <button type="button" onClick={() => copyCode(voucher.code)} aria-label={`Sao chép mã ${voucher.code}`}
                              className={`net-member-copy inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition ${focusStyles}`}>
                              <Copy size={13} aria-hidden="true" />Sao chép mã
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <div className="net-member-wallet-footer flex flex-col gap-4 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-gray-500">Mỗi đơn dùng 1 mã.<br />Mỗi tài khoản dùng mỗi mã 1 lần.</p>
                  <Link to="/cart" className={`inline-flex w-fit items-center justify-center gap-2 rounded-full bg-secondary px-5 py-3 text-xs font-medium text-white transition hover:bg-secondary/90 ${focusStyles}`}>
                    <ShoppingBag size={15} aria-hidden="true" />Đến giỏ hàng<ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </section>
              <p className="flex items-start gap-2 px-2 text-xs leading-5 text-gray-500"><BadgeCheck size={16} className="mt-0.5 shrink-0 text-[#869d80]" aria-hidden="true" />Sao chép mã yêu thích và áp dụng tại bước thanh toán để nhận ưu đãi.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
