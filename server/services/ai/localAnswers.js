import {
  DELIVERY_CHARGE,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_METHODS,
} from "../../utils/orderPricing.js";

const fold = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const money = (value) => `${Number(value).toLocaleString("vi-VN")}đ`;
const containsAny = (text, phrases) => phrases.some((phrase) => text.includes(phrase));

const standardShipping = SHIPPING_METHODS.find((method) => method.id === "standard");
const expressShipping = SHIPPING_METHODS.find((method) => method.id === "express");
const urgentShipping = SHIPPING_METHODS.find((method) => method.id === "urgent");

const answerStandardShipping = () => {
  const fee = standardShipping?.fee ?? DELIVERY_CHARGE;
  const freeFrom = standardShipping?.freeFrom ?? FREE_SHIPPING_THRESHOLD;
  return `Giao tiêu chuẩn ${standardShipping?.description || ""}: phí ${money(fee)}; miễn phí khi tiền hàng từ ${money(freeFrom)} trước voucher.`;
};

const answerExpressShipping = () =>
  `Giao nhanh ${expressShipping?.description || ""}: phí ${money(expressShipping?.fee ?? 50000)}.`;

const answerUrgentShipping = () =>
  `Giao hỏa tốc ${urgentShipping?.description || ""}; đơn vị vận chuyển báo phí riêng và khách thanh toán khoản này sau.`;

const getShippingAnswer = (text) => {
  const asksAboutShipping = containsAny(text, [
    "phi giao hang", "phi van chuyen", "phi ship", "tien ship", "ship bao nhieu",
    "mien phi ship", "freeship", "giao hang bao lau", "bao lau giao hang",
    "bao lau ship", "ship mat bao lau", "bao lau nhan duoc", "thoi gian giao hang",
    "ship the nao", "giao hang nhanh", "giao nhanh", "hoa toc", "giao tieu chuan",
  ]);

  if (!asksAboutShipping) return null;
  if (containsAny(text, ["hoa toc", "2 tieng", "trong 2 tieng"])) return answerUrgentShipping();
  if (containsAny(text, ["giao nhanh", "ship nhanh", "express"])) return answerExpressShipping();
  if (containsAny(text, ["tieu chuan", "mien phi ship", "freeship", "mien phi giao hang"])) {
    return answerStandardShipping();
  }

  return [answerStandardShipping(), answerExpressShipping(), answerUrgentShipping()].join(" ");
};

const getPerfumeGlossaryAnswer = (text) => {
  if (containsAny(text, ["note la gi", "not la gi", "tang huong la gi", "huong dau la gi", "huong giua la gi", "huong cuoi la gi"])) {
    return "Note là cách mô tả các giai đoạn mùi hương: hương đầu, hương giữa và hương cuối. Đây là cách diễn tả mùi theo thời gian, không phải danh sách hay tỷ lệ chính xác của mọi thành phần.";
  }

  if (containsAny(text, ["accord la gi", "hop huong la gi"])) {
    return "Accord là một sắc thái hoặc tổ hợp mùi được cảm nhận như một tổng thể, chẳng hạn sắc thái gỗ hay hoa. Accord mô tả cảm nhận hương, không đồng nghĩa với tỷ lệ nguyên liệu.";
  }

  if (containsAny(text, ["edp va edt", "khac nhau giua edp", "so sanh edp", "edp khac edt", "edt khac edp"])) {
    return "EDT và EDP là các mức nồng độ được ghi trên từng sản phẩm. Độ lưu hương thực tế còn tùy công thức, da và cách sử dụng; hãy xem thông tin của đúng sản phẩm để biết nồng độ, không thể đảm bảo EDP luôn lưu lâu hơn EDT.";
  }

  return null;
};

export const getLocalAIAnswer = (message) => {
  const text = fold(message);
  if (!text) return null;

  if (/^(xin chao|chao|chao shop|chao ban|hello|hi|alo|hey)( shop)?$/.test(text)) {
    return "Velours xin chào! Mình có thể giúp bạn tìm nước hoa, xem thông tin sản phẩm, phí giao hàng hoặc hướng dẫn theo dõi đơn.";
  }

  if (containsAny(text, ["ban giup duoc gi", "ban co the giup gi", "giup gi cho toi", "co the hoi gi", "ban lam duoc gi", "tro ly co the lam gi", "tu van giup toi"])) {
    return "Mình có thể tìm và so sánh nước hoa trong cửa hàng, tra cứu giỏ hàng hoặc đơn hàng của bạn, và giải đáp thông tin giao hàng. Bạn cứ mô tả mùi hương, ngân sách hoặc điều muốn biết.";
  }

  if (text === "giup toi chon nuoc hoa theo ngan sach") {
    return "Bạn muốn tìm nước hoa trong khoảng ngân sách bao nhiêu (ví dụ: dưới 500.000đ, 1–2 triệu hay tầm 3 triệu) và dành cho nam, nữ hay unisex? Bạn cho mình biết mức giá để mình lọc ngay các lựa chọn đang còn hàng nhé.";
  }

  const shippingAnswer = getShippingAnswer(text);
  if (shippingAnswer) return shippingAnswer;

  if (containsAny(text, ["huy don", "doi don", "sua don", "tra hang", "doi tra", "phan anh san pham"])) {
    return "Để yêu cầu đổi hoặc hủy đơn, hoặc phản ánh sản phẩm đã nhận, vui lòng liên hệ Velours tại trang Liên hệ (hello@velours.com) và cung cấp mã đơn hàng để nhân viên kiểm tra.";
  }

  const asksHowToTrackOrder = containsAny(text, [
    "cach theo doi don", "theo doi don hang o dau", "xem tinh trang don o dau",
    "kiem tra don hang o dau", "cach xem don hang",
  ]);
  const asksForPersonalOrder = containsAny(text, [
    "don hang cua toi", "don cua toi", "don gan nhat", "don hang nao", "ma don",
    "don hang da dat", "trang thai don",
  ]);
  if (asksHowToTrackOrder && !asksForPersonalOrder) {
    return "Bạn có thể đăng nhập rồi mở mục Đơn hàng của tôi để xem tình trạng xử lý và thanh toán.";
  }

  return getPerfumeGlossaryAnswer(text);
};
