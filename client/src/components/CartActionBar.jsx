import { useEffect, useRef } from "react";

const CartActionBar = ({ contentRef, children }) => {
  const actionsRef = useRef(null);

  useEffect(() => {
    const content = contentRef.current;
    const actions = actionsRef.current;
    if (!content || !actions) return undefined;

    let frameId = null;
    const updatePosition = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      // Keep the bar above the footer once the end of this section is visible.
      const offset = Math.max(0, window.innerHeight - content.getBoundingClientRect().bottom);
      actions.style.bottom = `${offset}px`;
    };
    const schedulePosition = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updatePosition);
    };
    const updateLayout = () => {
      content.style.paddingBottom = `${Math.ceil(actions.getBoundingClientRect().height) + 20}px`;
      updatePosition();
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(actions);
    observer.observe(content);
    window.addEventListener("scroll", schedulePosition, { passive: true });
    window.addEventListener("resize", schedulePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedulePosition);
      window.removeEventListener("resize", schedulePosition);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      content.style.paddingBottom = "";
    };
  }, [contentRef]);

  return (
    <div ref={actionsRef} className="max-padd-container fixed inset-x-0 bottom-0 z-40">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-t-xl border border-secondary/10 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:p-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
};

export default CartActionBar;
