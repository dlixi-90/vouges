import { useCallback, useLayoutEffect, useRef } from "react";

// Wait for the selected page's rows, rather than scrolling to a loading stub.
// The hook lives with the list so it survives a temporarily hidden pager.
export default function usePaginationScroll({ page, onPageChange, ready = true, resetKey }) {
  const listRef = useRef(null);
  const requestedPage = useRef(null);
  const focusList = useRef(true);
  const previousResetKey = useRef(resetKey);
  const changePage = useCallback((nextPage) => {
    if (nextPage === page) return;
    requestedPage.current = nextPage;
    focusList.current = true;
    onPageChange(nextPage);
  }, [onPageChange, page]);

  useLayoutEffect(() => {
    // A new filter result also starts at the list, even if the page stays at 1.
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey;
      requestedPage.current = page;
      focusList.current = false;
    }
    if (!ready || requestedPage.current !== page) return;
    let frame;
    const paint = window.requestAnimationFrame(() => { frame = window.requestAnimationFrame(() => {
      if (requestedPage.current !== page || !listRef.current) return;
      requestedPage.current = null;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const list = listRef.current;
      // Filters keep focus on their controls so typing a price/search can continue.
      if (focusList.current) list.focus({ preventScroll: true });
      const margin = Number.parseFloat(window.getComputedStyle(list).scrollMarginTop) || 24;
      let container = list.parentElement;
      while (container && container !== document.body) {
        if (/(auto|scroll)/.test(window.getComputedStyle(container).overflowY) && container.scrollHeight > container.clientHeight + 1) break;
        container = container.parentElement;
      }
      const nested = container && container !== document.body;
      const scroller = nested ? container : window;
      const current = nested ? container.scrollTop : window.scrollY;
      const top = current + list.getBoundingClientRect().top - (nested ? container.getBoundingClientRect().top : 0) - margin;
      // Cancel any earlier animation before handling a rapid page change.
      scroller.scrollTo({ top: current, behavior: "instant" });
      scroller.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? "instant" : "smooth" });
    }); });
    return () => { window.cancelAnimationFrame(paint); window.cancelAnimationFrame(frame); };
  }, [page, ready, resetKey]);

  return { listRef, changePage };
}
