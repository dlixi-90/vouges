// The caller locks other cart writes until this change is acknowledged.
export const persistCartSizeChange = async ({ itemId, fromSize, toSize, cartItems, cartAddedAt, addedAt, send, apply, signal }) => {
  const previous = { sizes: { ...cartItems[itemId] }, timestamps: { ...cartAddedAt[itemId] } };
  const quantity = Number(previous.sizes[fromSize]) + Number(previous.sizes[toSize] || 0);
  const next = {
    sizes: { ...previous.sizes, [toSize]: quantity },
    timestamps: { ...previous.timestamps, [toSize]: addedAt },
  };
  delete next.sizes[fromSize];
  delete next.timestamps[fromSize];
  signal.throwIfAborted();
  apply(next);
  try {
    const data = await send();
    signal.throwIfAborted();
    apply({
      sizes: { ...next.sizes, [toSize]: data.quantity ?? quantity },
      timestamps: { ...next.timestamps, [toSize]: data.addedAt ?? addedAt },
    });
    return data;
  } catch (error) {
    if (!signal.aborted) apply(previous);
    throw error;
  }
};
