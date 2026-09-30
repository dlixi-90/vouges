export const shouldCancelQrNavigation = (order, { currentLocation, nextLocation, historyAction }) =>
  order.status === "Awaiting Payment" && !order.isPaid && (
    currentLocation.pathname !== nextLocation.pathname ||
    currentLocation.search !== nextLocation.search ||
    historyAction === "POP"
  );

// Back and a route change can happen together. Share the request and its result.
export const createQrCancellation = () => {
  let pending;
  let completed = false;
  return {
    run(cancel) {
      if (completed) return Promise.resolve(true);
      if (pending) return pending;
      pending = Promise.resolve().then(cancel).then((success) => {
        completed = success === true;
        return completed;
      }).finally(() => { pending = undefined; });
      return pending;
    },
  };
};
