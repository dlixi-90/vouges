import { useEffect, useState } from "react";

// Keep the floating help button in its corner, but hide it briefly if it would
// cover the product's size or purchase controls as the customer scrolls.
export default function usePurchaseChatAvoidance(pathname) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!pathname.startsWith("/collection/") || !("IntersectionObserver" in window)) return;
    let observer;
    const setup = () => {
      observer?.disconnect();
      const controls = document.querySelectorAll(".product-detail-size-options, .product-detail-purchase-actions");
      if (!controls.length) return;
      const nav = document.querySelector(".mobile-tab-bar");
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const navHeight = mobile ? nav?.getBoundingClientRect().height || 68 : 0;
      const intersecting = new Set();
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target);
          else intersecting.delete(entry.target);
        }
        setState({ pathname, hidden: mobile && intersecting.size > 0 });
      }, { rootMargin: `-${Math.max(0, window.innerHeight - navHeight - 72)}px 0px -${navHeight}px 0px` });
      controls.forEach(control => observer.observe(control));
      pending.disconnect();
    };
    const pending = new MutationObserver(setup);
    pending.observe(document.body, { childList: true, subtree: true });
    setup();
    window.addEventListener("resize", setup);
    return () => { observer?.disconnect(); pending.disconnect(); window.removeEventListener("resize", setup); };
  }, [pathname]);
  return state?.pathname === pathname && state.hidden;
}
