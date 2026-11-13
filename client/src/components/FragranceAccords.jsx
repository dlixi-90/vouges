import { getAccordColors, getAccordPercent } from "../utils/accordColors";
import "../fragrance-accords.css";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { libraryNamePath } from "../utils/fragranceLibrary";
import { prefetchRoute } from "../utils/prefetchRoute";

export default function FragranceAccords({ accords = [] }) {
  const { publicCatalog } = useAppContext();
  const prefetchAccord = label => {
    prefetchRoute("/knowledge");
    if (label) void publicCatalog?.library?.("accord", { name: label, page: 1 }).catch(() => {});
  };
  return <ul className="perfume-accord-meters" aria-label="Các sắc thái mùi hương chính">{accords.map((accord, index) => {
    const value = getAccordPercent(accord), colors = getAccordColors(accord);
    const text = `${accord.label} (${value === null ? "Chưa có dữ liệu" : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 20 })}%`})`;
    return <li className="perfume-accord-meter" key={`${accord.label}-${index}`} title={text}>
      <Link className="perfume-accord-label" to={libraryNamePath("accord", accord.label)} state={{ initialTerm: { name: accord.label, kind: "accord" } }} onPointerEnter={() => prefetchAccord(accord.label)} onFocus={() => prefetchAccord(accord.label)}>{text}</Link>
      <span className="perfume-accord-fill" aria-hidden="true" style={{ width: `${value ?? 0}%`, backgroundColor: colors.background }}>
        <span className="perfume-accord-label" style={{ color: colors.foreground, pointerEvents: "none" }}>{text}</span>
      </span>
    </li>;
  })}</ul>;
}
