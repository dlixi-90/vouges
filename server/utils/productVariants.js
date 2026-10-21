export const isValidSizeName = (size) =>
  typeof size === "string" && size.length > 0 && size.length <= 50 &&
  !size.includes(".") && !size.startsWith("$") &&
  !["__proto__", "constructor", "prototype"].includes(size);

export const getSizeRenames = (raw, current, sizes) => {
  const renames = raw.sizeRenames ?? [];
  const invalid = () => {
    throw Object.assign(new Error("Tên dung tích mới không hợp lệ. Vui lòng tải lại sản phẩm và thử lại."), { statusCode: 400 });
  };
  if (!Array.isArray(renames) || renames.length > 50) invalid();
  const sources = new Set();
  const targets = new Set();
  for (const rename of renames) {
    if (!rename || !isValidSizeName(rename.from) || !isValidSizeName(rename.to) ||
        rename.from === rename.to || !current?.sizes.includes(rename.from) ||
        !sizes.includes(rename.to) || sources.has(rename.from) || targets.has(rename.to)) invalid();
    sources.add(rename.from);
    targets.add(rename.to);
  }
  // An existing row may be renamed, but cannot also remain as a copy of itself.
  for (const from of sources) {
    if (sizes.includes(from) && !targets.has(from)) invalid();
  }
  return renames;
};

export const buildCartSizeRename = (productId, renames) => {
  const path = (size) => `cartData.${productId}.${size}`;
  const sources = new Set(renames.map(({ from }) => from));
  const targets = new Set(renames.map(({ to }) => to));
  const values = {};
  for (const { from, to } of renames) {
    values[path(to)] = {
      $add: [
        { $ifNull: [`$${path(from)}`, 0] },
        sources.has(to) ? 0 : { $ifNull: [`$${path(to)}`, 0] },
      ],
    };
  }
  const removed = [...sources].filter((size) => !targets.has(size)).map(path);
  return {
    filter: { $or: [...sources].map((size) => ({ [path(size)]: { $exists: true } })) },
    pipeline: [{ $set: values }, ...(removed.length ? [{ $unset: removed }] : [])],
  };
};
