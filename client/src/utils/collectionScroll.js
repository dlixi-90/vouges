export function scrollToCollectionToolbar(behavior = "smooth") {
  const toolbar = document.querySelector(".inessa-collection-toolbar");
  if (!toolbar) return;
  const header = document.querySelector(".net-header");
  const headerHeight = header && /^(sticky|fixed)$/.test(window.getComputedStyle(header).position)
    ? header.offsetHeight
    : 97;
  const gap = Number.parseFloat(window.getComputedStyle(toolbar).scrollMarginTop) || 16;
  const targetTop = window.scrollY + toolbar.getBoundingClientRect().top - headerHeight - gap;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: reducedMotion ? "instant" : behavior,
  });
}
