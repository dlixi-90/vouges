export const validateDeliveryPhone = (value) => {
  const compact = String(value ?? "").replace(/\s/g, "");
  const invalid = (error) => ({ valid: false, normalized: "", error });
  if (!compact) return invalid("Vui lòng nhập số điện thoại.");
  let nationalNumber;
  if (/^0\d*$/.test(compact)) {
    if (/^0[01]/.test(compact)) return invalid("Không chấp nhận số điện thoại bắt đầu bằng 00 hoặc 01.");
    if (compact.length !== 10) return invalid("Số điện thoại bắt đầu bằng 0 phải có đúng 10 chữ số.");
    nationalNumber = compact.slice(1);
  } else if (/^(?:\(\+84\)|\+84)\d*$/.test(compact)) {
    nationalNumber = compact.startsWith("(+84)") ? compact.slice(5) : compact.slice(3);
    if (nationalNumber.length !== 9) return invalid("Nhập đúng 9 chữ số sau (+84).");
    if (/^[01]/.test(nationalNumber)) return invalid("Dãy 9 chữ số sau (+84) phải bắt đầu bằng một chữ số từ 2 đến 9.");
  } else {
    return invalid("Nhập 10 chữ số bắt đầu bằng 0, hoặc +84 / (+84) kèm 9 chữ số. Có thể dùng khoảng trắng.");
  }
  const groupedNumber = `${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
  return { valid: true, normalized: `(+84) ${groupedNumber}`, error: "" };
};
