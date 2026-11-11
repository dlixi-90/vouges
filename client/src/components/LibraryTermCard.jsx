import { Link } from "react-router-dom";
import { getProductImageUrl } from "../utils/productImage";
import "./library-term-card.css";

export default function LibraryTermCard({
  to,
  name,
  englishName,
  image,
  variant,
  eager = false,
  width = 180,
  height = 180,
  state,
  onPointerEnter,
  onFocus,
}) {
  return (
    <Link
      className={`knowledge-card${variant ? ` knowledge-card--${variant}` : ""}`}
      to={to}
      state={state}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
    >
      <span className="knowledge-card-image">
        {image ? (
          <img
            src={getProductImageUrl(image, Math.max(width, height) * 2)}
            alt=""
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            width={width}
            height={height}
          />
        ) : (
          <span className="knowledge-card-letter" aria-hidden="true">
            {name.slice(0, 1)}
          </span>
        )}
      </span>
      <strong>{name}</strong>
      {englishName && <small lang="en">{englishName}</small>}
    </Link>
  );
}
