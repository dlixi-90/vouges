const pulseCart = (cartTarget) => {
  if (!cartTarget) return;

  cartTarget.classList.remove("cart-add-feedback");
  // Restart the animation when customers add products in quick succession.
  void cartTarget.offsetWidth;
  cartTarget.classList.add("cart-add-feedback");

  window.setTimeout(() => {
    cartTarget.classList.remove("cart-add-feedback");
  }, 700);
};

export const flyProductToCart = ({ imageSrc, sourceElement }) => {
  const cartTarget = [...document.querySelectorAll("[data-cart-target]")]
    .find(target => target.getClientRects().length > 0);
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!imageSrc || !sourceElement || !cartTarget || reducedMotion) {
    pulseCart(cartTarget);
    return;
  }

  const sourceRect = sourceElement.getBoundingClientRect();
  const cartRect = cartTarget.getBoundingClientRect();
  const size = Math.min(96, Math.max(64, sourceRect.width * 0.28));
  const startX = sourceRect.left + sourceRect.width / 2 - size / 2;
  const startY = sourceRect.top + sourceRect.height / 2 - size / 2;
  const endX = cartRect.left + cartRect.width / 2 - size / 2;
  const endY = cartRect.top + cartRect.height / 2 - size / 2;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const flyingImage = document.createElement("img");

  flyingImage.src = imageSrc;
  flyingImage.alt = "";
  flyingImage.setAttribute("aria-hidden", "true");
  Object.assign(flyingImage.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    padding: "8px",
    borderRadius: "9999px",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 14px 32px rgba(36, 36, 36, 0.22)",
    pointerEvents: "none",
    zIndex: "9999",
    willChange: "transform, opacity",
  });
  document.body.appendChild(flyingImage);

  const animation = flyingImage.animate(
    [
      { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate3d(${deltaX * 0.55}px, ${Math.min(deltaY * 0.35, -90)}px, 0) scale(0.72)`,
        opacity: 1,
        offset: 0.58,
      },
      {
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.18)`,
        opacity: 0.25,
      },
    ],
    {
      duration: 720,
      easing: "cubic-bezier(0.22, 0.75, 0.25, 1)",
      fill: "forwards",
    },
  );

  animation.addEventListener("finish", () => {
    flyingImage.remove();
    pulseCart(cartTarget);
  });
  animation.addEventListener("cancel", () => flyingImage.remove());
};
