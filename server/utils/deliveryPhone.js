export const validateDeliveryPhone = (value) => {
  const compact = String(value ?? "").replace(/\s/g, "");
  const invalid = (error) => ({ valid: false, normalized: "", error });
  if (!compact) return invalid("Phone number is required.");
  let nationalNumber;
  if (/^0\d*$/.test(compact)) {
    if (/^0[01]/.test(compact)) return invalid("Phone numbers starting with 00 or 01 are not accepted.");
    if (compact.length !== 10) return invalid("A phone number starting with 0 must contain exactly 10 digits.");
    nationalNumber = compact.slice(1);
  } else if (/^(?:\(\+84\)|\+84)\d*$/.test(compact)) {
    nationalNumber = compact.startsWith("(+84)") ? compact.slice(5) : compact.slice(3);
    if (nationalNumber.length !== 9) return invalid("Enter exactly 9 digits after (+84).");
    if (/^[01]/.test(nationalNumber)) return invalid("The 9 digits after (+84) must start with 2–9.");
  } else {
    return invalid("Use 10 digits starting with 0, or +84 / (+84) followed by 9 digits. Spaces are allowed.");
  }
  const groupedNumber = `${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
  return { valid: true, normalized: `(+84) ${groupedNumber}`, error: "" };
};
