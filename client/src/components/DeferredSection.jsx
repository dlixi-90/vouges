import { Suspense, useEffect, useRef, useState } from "react";

// Start loading below-the-fold sections shortly before they enter the viewport.
const DeferredSection = ({ children, minHeight }) => {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "400px" });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={visible ? undefined : { minHeight }}>
      {visible && (
        <Suspense fallback={<div style={{ minHeight }} role="status" aria-label="Loading section" />}>
          {children}
        </Suspense>
      )}
    </div>
  );
};

export default DeferredSection;
