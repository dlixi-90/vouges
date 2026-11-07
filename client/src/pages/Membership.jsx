import { useEffect, useState } from "react";
import { useClerk } from "@clerk/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Copy,
  Crown,
  Gift,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  Settings,
  ShoppingBag,
  Ticket,
} from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAppContext } from "../context/AppContext";
import { formatVnd } from "../utils/money";
import { formatVoucherExpiryDate } from "../utils/voucherDates";
import { latestAdultBirthday } from "../utils/customerProfile";
import StorePageHeading from "../components/StorePageHeading";
import LoyaltyMemberPanel from "../components/LoyaltyMemberPanel";
import { PageSkeleton } from "../components/LoadingState";
import "../membership.css";

const focusStyles =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary";
const membershipTabs = [
  { id: "member", label: "Thành viên", Icon: Crown },
  { id: "vouchers", label: "Mã giảm giá", Icon: Ticket },
];

export default function Membership() {
  const { openUserProfile } = useClerk();
  const { user, axios, getToken, requireCartLogin, storeResources, accountLoading } =
    useAppContext();
  const userId = user?.id;
  const [data, setData] = useState(
    () => storeResources.peekMembership() || null,
  );
  const [loadedAt, setLoadedAt] = useState(Date.now);
  const [birthday, setBirthday] = useState(
    () => storeResources.peekMembership()?.profile.birthday || "",
  );
  const [phone, setPhone] = useState(() => storeResources.peekMembership()?.profile.phone || "");
  const [editingPhone, setEditingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [activeTab, setActiveTab] = useState("member");
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    // Start the loyalty summary beside the voucher request. The member panel is
    // rendered after the profile/wallet payload arrives, so preloading avoids
    // making those two API calls a serial wait.
    void storeResources.loadCatalog("/me", "/api/loyalty").catch(() => {});
    storeResources
      .loadMembership({force:attempt>0})
      .then((result) => {
        if (active) {
          setData(result);
          setLoadedAt(Date.now());
          setBirthday(result.profile.birthday || "");
          setPhone(result.profile.phone || "");
          setError("");
        }
      })
      .catch((err) => {
        if (active && err.name !== "AbortError")
          setError(err.response?.data?.message || err.message);
      });
    return () => {
      active = false;
    };
  }, [storeResources, userId, attempt]);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await axios.patch(
        "/api/users/birthday",
        { birthday },
        { headers: { Authorization: `Bearer ${await getToken()}` } },
      );
      storeResources.invalidateMembership();
      storeResources.invalidateCatalog();
      setData(await storeResources.loadMembership());
      setLoadedAt(Date.now());
      toast.success("Đã lưu ngày sinh.");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async (event) => {
    event.preventDefault();
    if (savingPhone) return;
    setSavingPhone(true);
    try {
      const {data} = await axios.patch("/api/users/profile/phone", {phone}, {
        headers:{Authorization:`Bearer ${await getToken()}`}, timeout:15000,
      });
      if (!data.success || !data.profile) throw new Error(data.message || "Không thể lưu số điện thoại.");
      setData(current => current?.userId === userId ? {...current,profile:data.profile} : current);
      setPhone(data.profile.phone || "");
      storeResources.invalidateMembership();
      setEditingPhone(false);
      toast.success("Đã cập nhật số điện thoại.");
    } catch (err) {
      toast.error(err.response?.data?.errors?.phone || err.response?.data?.message || err.message);
    } finally {
      setSavingPhone(false);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Đã sao chép mã.");
    } catch {
      toast.error("Hãy chọn và sao chép mã hiển thị.");
    }
  };

  const current = data?.userId === userId ? data : null;
  const vouchers = (current?.vouchers || []).filter(
    (voucher) => new Date(voucher.expiresAt).getTime() > loadedAt,
  );
  const displayName =
    current?.profile.username || user?.fullName || "Thành viên Velours";
  const today = latestAdultBirthday();

  return (
    <main className="net-membership store-account-page text-secondary">
      <div className="max-padd-container store-page-container">
        <StorePageHeading title="Thành viên & mã giảm giá" className="net-member-header">
          <Link
            to="/collection"
            className={`btn-outline inline-flex w-fit shrink-0 items-center gap-2 px-5 py-3 text-sm font-medium transition ${focusStyles}`}
          >
            Khám phá sản phẩm
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </StorePageHeading>
        {accountLoading ? <PageSkeleton compact label="Đang tải tài khoản…" /> : !user ? (
          <section className="net-member-panel flex flex-col items-center px-6 py-16 text-center">
            <span className="net-member-empty-icon mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
              <Ticket size={30} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">Ưu đãi của bạn đang chờ</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">
              Đăng nhập để xem hạng thành viên, điểm thưởng và quyền lợi theo các chiến dịch đang mở.
            </p>
            <button
              type="button"
              onClick={requireCartLogin}
              className={`mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-medium text-white transition hover:bg-secondary/90 ${focusStyles}`}
            >
              Đăng nhập
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        ) : error ? (
          <div role="alert" className="net-member-panel px-6 py-10 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setData(null);
                setAttempt((value) => value + 1);
              }}
              className={`mx-auto mt-4 flex cursor-pointer items-center gap-2 rounded-full border border-secondary/20 px-5 py-2.5 text-sm font-medium ${focusStyles}`}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Thử lại
            </button>
          </div>
        ) : !current ? (
          <PageSkeleton compact label="Đang tải ưu đãi của bạn…" />
        ) : (
          <div className="membership-content min-w-0">
            <div className="membership-tabs" role="tablist" aria-label="Thành viên và mã giảm giá">
              {membershipTabs.map(({ id, label, Icon }, index) => (
                <button key={id} id={`membership-tab-${id}`} type="button" role="tab"
                  aria-selected={activeTab === id} aria-controls={`membership-panel-${id}`}
                  tabIndex={activeTab === id ? 0 : -1} onClick={() => setActiveTab(id)}
                  onKeyDown={event => {
                    let next;
                    if (event.key === "ArrowRight") next = (index + 1) % membershipTabs.length;
                    else if (event.key === "ArrowLeft") next = (index + membershipTabs.length - 1) % membershipTabs.length;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End") next = membershipTabs.length - 1;
                    else return;
                    event.preventDefault();
                    const nextId = membershipTabs[next].id;
                    setActiveTab(nextId);
                    document.getElementById(`membership-tab-${nextId}`)?.focus();
                  }}>
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />{label}
                  {id === "vouchers" && <span className="membership-tab-count">{vouchers.length}</span>}
                </button>
              ))}
            </div>
            <div id="membership-panel-member" role="tabpanel" aria-labelledby="membership-tab-member"
              className="membership-tab-panel" hidden={activeTab !== "member"} tabIndex={0}>
            <div className="store-member-layout">
            <div className="min-w-0">
              <section
                aria-labelledby="member-profile-title"
                className="net-member-panel membership-profile overflow-hidden"
              >
                <div className="net-member-profile-cover">
                  <div className="membership-identity">
                    <div className="net-member-avatar flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border">
                      {user.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-medium">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2
                        id="member-profile-title"
                        className="break-words text-xl font-semibold"
                      >
                        {displayName}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => openUserProfile()}
                      aria-label="Quản lý tài khoản"
                      title="Quản lý tài khoản"
                      className={`net-member-settings ${focusStyles}`}
                    >
                      <Settings size={17} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <dl className="net-member-details space-y-5 p-6">
                  <div className="flex items-start gap-3">
                    <Mail
                      size={17}
                      className="net-member-icon mt-1 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <dt className="text-xs text-gray-500">Email</dt>
                      <dd className="mt-1 break-all text-sm">
                        {current.profile.email || "Chưa cập nhật"}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone
                      size={17}
                      className="net-member-icon mt-1 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <dt className="text-xs text-gray-500">Số điện thoại</dt>
                      <dd className="mt-1 break-words text-sm">
                        {editingPhone ? <form onSubmit={savePhone} className="membership-phone-form">
                          <label className="sr-only" htmlFor="membership-phone">Số điện thoại</label>
                          <input id="membership-phone" name="phone" type="tel" autoComplete="tel" required maxLength={30}
                            value={phone} disabled={savingPhone} onChange={event => setPhone(event.target.value)} />
                          <button type="submit" disabled={savingPhone}>{savingPhone ? "Đang lưu…" : "Lưu"}</button>
                          <button type="button" disabled={savingPhone} onClick={() => { setPhone(current.profile.phone || ""); setEditingPhone(false); }}>Hủy</button>
                        </form> : <div className="membership-phone-value">
                          <span>{current.profile.phone || "Chưa cập nhật"}</span>
                          <button type="button" onClick={() => setEditingPhone(true)} aria-label="Chỉnh sửa số điện thoại">Chỉnh sửa</button>
                        </div>}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays
                      size={17}
                      className="net-member-icon mt-1 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs text-gray-500">Ngày sinh</dt>
                      <dd className="mt-1 text-sm">
                        {current.profile.birthday ? (
                          current.profile.birthday
                            .split("-")
                            .reverse()
                            .join("/")
                        ) : (
                          <form onSubmit={save} className="space-y-3 pt-1">
                            <label htmlFor="birthday" className="sr-only">
                              Ngày sinh
                            </label>
                            <input
                              id="birthday"
                              type="date"
                              required
                              min="1900-01-01"
                              max={today}
                              value={birthday}
                              disabled={saving}
                              aria-describedby="birthday-once"
                              onChange={(event) =>
                                setBirthday(event.target.value)
                              }
                              className="net-member-date block min-w-0 w-full rounded-lg border px-3 py-2 text-sm outline-none transition disabled:opacity-50"
                            />
                            <p
                              id="birthday-once"
                              className="text-xs text-gray-500"
                            >
                              Ngày sinh chỉ được lưu một lần.
                            </p>
                            <button
                              type="submit"
                              disabled={saving}
                              className={`store-member-save inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium text-white transition hover:bg-secondary/90 disabled:cursor-wait disabled:opacity-60 ${focusStyles}`}
                            >
                              {saving && (
                                <LoaderCircle
                                  size={14}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              )}
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

              <LoyaltyMemberPanel key={`${userId}:${current.profile.birthday}`} onChange={() => setAttempt(value => value + 1)} />
            </div>
            </div>
            <div id="membership-panel-vouchers" role="tabpanel" aria-labelledby="membership-tab-vouchers"
              className="membership-tab-panel" hidden={activeTab !== "vouchers"} tabIndex={0}>
              <section
                aria-labelledby="member-wallet-title"
                className="net-member-panel membership-wallet overflow-hidden"
              >
                <div className="net-member-wallet-header flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5">
                  <div>
                    <h2
                      id="member-wallet-title"
                      className="flex items-center gap-2.5 text-lg font-semibold"
                    >
                      <Ticket size={21} strokeWidth={1.7} aria-hidden="true" />
                      Mã giảm giá của bạn
                    </h2>
                    <p className="membership-wallet-caption">Ưu đãi còn hiệu lực, sẵn sàng cho lần mua sắm tiếp theo.</p>
                  </div>
                  <span className="net-member-wallet-count rounded-full px-3 py-1.5 text-xs font-medium">
                    {vouchers.length} mã khả dụng
                  </span>
                </div>
                {vouchers.length === 0 ? (
                  <div className="membership-wallet-empty">
                    <span className="net-member-empty-icon mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
                      <Ticket size={32} strokeWidth={1.3} aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-semibold">Chưa có mã giảm giá khả dụng</h3>
                    <p className="membership-wallet-caption">Mã còn hiệu lực và chưa sử dụng sẽ xuất hiện tại đây.</p>
                    <Link
                      to="/collection"
                      className={`mt-5 inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium underline decoration-secondary/25 underline-offset-4 ${focusStyles}`}
                    >
                      Tìm sản phẩm yêu thích
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <div className="membership-vouchers p-5 sm:p-6">
                    {vouchers.map((voucher) => (
                      <article
                        key={voucher._id}
                        className="net-member-voucher overflow-hidden rounded-2xl border sm:flex"
                      >
                        <div className="net-member-voucher-value flex shrink-0 items-center justify-between gap-4 border-b border-dashed px-5 py-4 sm:w-36 sm:flex-col sm:justify-center sm:gap-1 sm:border-b-0 sm:border-r sm:px-3">
                          <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
                            Giảm
                          </span>
                          <p
                            className={`font-semibold tracking-tight ${voucher.type === "percent" ? "text-3xl" : "text-xl"}`}
                          >
                            {voucher.type === "percent"
                              ? `${voucher.value}%`
                              : formatVnd(voucher.value)}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1 p-5">
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            {voucher.kind === "birthday" && (
                              <Gift size={15} aria-hidden="true" />
                            )}
                            {voucher.kind === "birthday"
                              ? "Mừng sinh nhật bạn"
                              : "Ưu đãi từ Velours"}
                          </h3>
                          <p className="mt-2 text-xs leading-5 text-gray-500">
                            Đơn từ {formatVnd(voucher.minSubtotal)}
                            {voucher.maxDiscount != null &&
                              ` · Giảm tối đa ${formatVnd(voucher.maxDiscount)}`}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Hết hạn {formatVoucherExpiryDate(voucher.expiresAt)}
                          </p>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-secondary/15 pt-3">
                            <code className="net-member-voucher-code min-w-0 select-all break-all rounded-md px-2 py-1 text-xs font-semibold tracking-wide">
                              {voucher.code}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyCode(voucher.code)}
                              aria-label={`Sao chép mã ${voucher.code}`}
                              className={`net-member-copy inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition ${focusStyles}`}
                            >
                              <Copy size={13} aria-hidden="true" />
                              Sao chép mã
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <div className="net-member-wallet-footer flex flex-col gap-4 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to="/cart"
                    className={`store-member-cart inline-flex w-fit items-center justify-center gap-2 rounded-full bg-secondary px-5 py-3 text-xs font-medium text-white transition hover:bg-secondary/90 ${focusStyles}`}
                  >
                    <ShoppingBag size={15} aria-hidden="true" />
                    Đến giỏ hàng
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
