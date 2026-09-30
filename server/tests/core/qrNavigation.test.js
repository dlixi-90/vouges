import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createQrCancellation, shouldCancelQrNavigation } from "../../../client/src/utils/qrNavigation.js";

const clientRequire = createRequire(new URL("../../../client/package.json", import.meta.url));
const { createMemoryRouter } = clientRequire("react-router-dom");
const pendingOrder = { status: "Awaiting Payment", isPaid: false };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const settle = () => new Promise((done) => setImmediate(done));
const setup = (t, order = pendingOrder) => {
  const router = createMemoryRouter([{ path: "*", element: null }], {
    initialEntries: ["/collection", "/cart"], initialIndex: 1,
  });
  router.getBlocker("qr", (transition) => shouldCancelQrNavigation(order, transition));
  t.after(() => router.dispose());
  return router;
};

test("all page destinations wait for QR cancellation before navigation proceeds", async (t) => {
  for (const target of ["/", "/collection", "/collection/product", "/blog", "/contact", "/owner", "/my-orders"]) {
    const router = setup(t);
    const cancellation = createQrCancellation();
    const response = deferred();
    await router.navigate(target);
    assert.equal(router.state.location.pathname, "/cart");
    assert.equal(router.state.blockers.get("qr").state, "blocked");
    const task = cancellation.run(() => response.promise);
    assert.equal(router.state.location.pathname, "/cart");
    response.resolve(true);
    if (await task) router.state.blockers.get("qr").proceed();
    await settle();
    assert.equal(router.state.location.pathname, target);
  }
});

test("failed cancellation leaves the QR page active and allows retry", async (t) => {
  const router = setup(t);
  const cancellation = createQrCancellation();
  await router.navigate("/blog");
  assert.equal(await cancellation.run(async () => false), false);
  router.state.blockers.get("qr").reset();
  assert.equal(router.state.location.pathname, "/cart");
  await router.navigate("/blog");
  assert.equal(await cancellation.run(async () => true), true);
  router.state.blockers.get("qr").proceed();
  await settle();
  assert.equal(router.state.location.pathname, "/blog");
});

test("Back and repeated link clicks share one cancellation; latest destination wins", async (t) => {
  const router = setup(t);
  const cancellation = createQrCancellation();
  const response = deferred();
  let requests = 0;
  const cancel = () => { requests++; return response.promise; };
  const button = cancellation.run(cancel);
  await router.navigate("/blog");
  const firstLink = cancellation.run(cancel);
  await router.navigate("/contact");
  const latestLink = cancellation.run(cancel);
  assert.equal(firstLink, button);
  assert.equal(latestLink, button);
  response.resolve(true);
  await latestLink;
  router.state.blockers.get("qr").proceed();
  await settle();
  assert.equal(requests, 1);
  assert.equal(router.state.location.pathname, "/contact");
  await cancellation.run(cancel);
  assert.equal(requests, 1);
});

test("history Back and Forward wait for cancellation just like a link", async (t) => {
  const router = createMemoryRouter([{ path: "*", element: null }], {
    initialEntries: ["/collection", "/cart", "/blog"], initialIndex: 1,
  });
  router.getBlocker("qr", (transition) => shouldCancelQrNavigation(pendingOrder, transition));
  t.after(() => router.dispose());
  await router.navigate(-1);
  await settle();
  assert.equal(router.state.location.pathname, "/cart");
  assert.equal(router.state.blockers.get("qr").location.pathname, "/collection");
  router.state.blockers.get("qr").reset();
  await router.navigate(1);
  await settle();
  assert.equal(router.state.location.pathname, "/cart");
  assert.equal(router.state.blockers.get("qr").location.pathname, "/blog");
  router.state.blockers.get("qr").proceed();
  await settle();
  assert.equal(router.state.location.pathname, "/blog");
});

test("paid, review, expired and cancelled orders navigate without cancellation", async (t) => {
  for (const order of [
    { status: "Order Placed", isPaid: true },
    { status: "Awaiting Payment", isPaid: true },
    { status: "Payment Review", isPaid: false },
    { status: "Payment Expired", isPaid: false },
    { status: "Payment Cancelled", isPaid: false },
  ]) {
    const router = setup(t, order);
    await router.navigate("/my-orders");
    assert.equal(router.state.location.pathname, "/my-orders");
    assert.notEqual(router.state.blockers.get("qr")?.state, "blocked");
  }
});

test("same-page anchors do not cancel QR; route replacement is guarded", async (t) => {
  const router = setup(t);
  await router.navigate("/cart#payment");
  assert.equal(router.state.location.hash, "#payment");
  assert.notEqual(router.state.blockers.get("qr")?.state, "blocked");
  await router.navigate("/owner", { replace: true });
  assert.equal(router.state.location.pathname, "/cart");
  assert.equal(router.state.blockers.get("qr").state, "blocked");
});
