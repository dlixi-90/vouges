export const TIER_IDS = ["signature", "prestige", "elite", "private-circle"];
export class LoyaltyError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}
export const integer = (value, label, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new LoyaltyError(`${label} không hợp lệ.`);
  return value;
};
export const text = (value, label, max = 500, required = true) => {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new LoyaltyError(`${label} không hợp lệ.`);
  return value.trim();
};
export const addMonths = (value, months = 12) => {
  const shifted = new Date(new Date(value).getTime() + 7 * 3600000);
  const last = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + months, Math.min(shifted.getUTCDate(), last), shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds(), shifted.getUTCMilliseconds()) - 7 * 3600000);
};
export const pointsFor = (amount, rate) => Number(BigInt(integer(amount, "Doanh số")) * BigInt(integer(rate, "Tỷ lệ điểm", 0, 10000)) / 1000000n);
export const eligibleAmount = order => {
  if (order.status !== "Delivery" || order.isPaid !== true) return 0;
  // Shipping never earns points or qualifying sales. Reject incomplete legacy prices.
  const subtotal = order.subtotal ?? (Number.isSafeInteger(order.shipping) ? order.amount - order.shipping + (order.discount || 0) : null);
  integer(subtotal, "Tiền hàng"); integer(order.discount || 0, "Giảm giá");
  return Math.max(0, subtotal - (order.discount || 0));
};
export const tierFor = (tiers, sales) => [...tiers].reverse().find(tier => sales >= tier.thresholdVnd) || tiers[0];
export const defaultPolicy = () => {
  const base = [
    { code: "points", title: "Tích điểm cơ bản", enabled: true, availability: "available", condition: "Đơn đã thanh toán, hoàn tất và đủ điều kiện." },
    { code: "packaging", title: "Đóng gói quà tiêu chuẩn cao cấp", enabled: true, availability: "conditional", condition: "Xác nhận khả năng cung cấp với cửa hàng khi đặt hàng." },
    { code: "rewards", title: "Truy cập Reward Catalog", enabled: true, availability: "available", condition: "Theo số điểm, hạng và tồn kho của từng quà." },
  ];
  const prestige = [
    { code: "birthday", title: "Quà sinh nhật theo danh mục", enabled: true, availability: "conditional", condition: "Tối đa một quyền lợi sinh nhật mỗi năm; theo chiến dịch đang mở." },
    { code: "news", title: "Ưu tiên biết sản phẩm mới", enabled: false, availability: "unavailable", condition: "Khi cửa hàng mở chương trình giới thiệu sản phẩm." },
    { code: "welcome", title: "Quà chào mừng nâng hạng", enabled: false, availability: "unavailable", condition: "Theo chiến dịch và tồn kho khi có thông báo." },
  ];
  const elite = [
    { code: "birthday-premium", title: "Bộ quà sinh nhật cao cấp", enabled: false, availability: "unavailable", condition: "Theo danh mục sinh nhật được cửa hàng công bố." },
    { code: "hold-48", title: "Ưu tiên giữ sản phẩm giới hạn 48 giờ", enabled: false, availability: "unavailable", condition: "Tùy tồn kho và xác nhận của cửa hàng; không tự giữ hàng." },
    { code: "events", title: "Ưu tiên tham gia sự kiện riêng", enabled: false, availability: "unavailable", condition: "Chỉ khi có sự kiện và lời mời xác nhận." },
    { code: "annual", title: "Quà tri ân thường niên", enabled: false, availability: "unavailable", condition: "Theo chiến dịch được công bố." },
  ];
  const privateBenefits = [
    ["concierge", "Nhân viên chăm sóc riêng"], ["hold-72", "Ưu tiên giữ sản phẩm giới hạn 72 giờ"],
    ["experience", "Trải nghiệm nước hoa riêng tư"], ["personal-birthday", "Quà sinh nhật cá nhân hóa"],
    ["rare", "Ưu tiên sản phẩm hiếm và các đợt ra mắt"], ["special-thanks", "Quà tri ân đặc biệt"], ["private-events", "Sự kiện dành cho Private Circle"],
  ].map(([code,title]) => ({ code,title,enabled:false,availability:"unavailable",condition:"Chỉ áp dụng khi cửa hàng công bố khả năng cung cấp và xác nhận quyền lợi." }));
  return { _id:"program", version:0, enabled:false, activatedAt:null, historicalMode:"all", tiers:[
    {id:TIER_IDS[0],name:"Signature",thresholdVnd:0,rate:10,benefits:base},
    {id:TIER_IDS[1],name:"Prestige",thresholdVnd:15000000,rate:12,benefits:[...base,...prestige]},
    {id:TIER_IDS[2],name:"Elite",thresholdVnd:40000000,rate:15,benefits:[...base,...prestige,...elite]},
    {id:TIER_IDS[3],name:"Private Circle",thresholdVnd:100000000,rate:20,benefits:[...base,...prestige,...elite,...privateBenefits]},
  ] };
};
export const validatePolicy = value => {
  if (!Array.isArray(value.tiers) || value.tiers.length !== 4 || typeof value.enabled !== "boolean") throw new LoyaltyError("Chính sách phải có đủ bốn hạng.");
  let previous = -1;
  const tiers = value.tiers.map((tier,index) => {
    if (tier.id !== TIER_IDS[index]) throw new LoyaltyError("Thứ tự hạng không hợp lệ.");
    integer(tier.thresholdVnd,"Ngưỡng doanh số");integer(tier.rate,"Tỷ lệ điểm",1,10000);
    if ((index===0&&tier.thresholdVnd!==0)||tier.thresholdVnd<=previous) throw new LoyaltyError("Các ngưỡng phải tăng dần, Signature bắt đầu từ 0.");
    previous=tier.thresholdVnd;
    if (!Array.isArray(tier.benefits)||tier.benefits.length>40) throw new LoyaltyError("Danh sách quyền lợi không hợp lệ.");
    const codes=new Set();
    return {id:tier.id,name:text(tier.name,"Tên hạng",80),thresholdVnd:tier.thresholdVnd,rate:tier.rate,benefits:tier.benefits.map(benefit=>{
      const code=text(benefit.code,"Mã quyền lợi",60);
      if(codes.has(code)||typeof benefit.enabled!=="boolean"||!["available","conditional","unavailable"].includes(benefit.availability))throw new LoyaltyError("Quyền lợi không hợp lệ hoặc bị trùng.");codes.add(code);
      return {code,title:text(benefit.title,"Quyền lợi",160),enabled:benefit.enabled,availability:benefit.availability,condition:text(benefit.condition,"Điều kiện quyền lợi",500,benefit.availability!=="available")};
    })};
  });
  return {enabled:value.enabled,tiers,historicalMode:"all"};
};
