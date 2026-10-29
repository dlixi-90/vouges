import { getAccordColors, getAccordPercent } from "../utils/accordColors";
import "../fragrance-accords.css";

export default function FragranceAccords({ accords = [] }) {
  return <ul className="perfume-accord-meters" aria-label="Các sắc thái mùi hương chính">{accords.map((accord, index) => {
    const value = getAccordPercent(accord), colors = getAccordColors(accord);
    const text = `${accord.label} (${value === null ? "Chưa có dữ liệu" : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 20 })}%`})`;
    return <li className="perfume-accord-meter" key={`${accord.label}-${index}`} title={text}>
      <span className="perfume-accord-label">{text}</span>
      <span className="perfume-accord-fill" aria-hidden="true" style={{ width: `${value ?? 0}%`, backgroundColor: colors.background }}>
        <span className="perfume-accord-label" style={{ color: colors.foreground }}>{text}</span>
      </span>
    </li>;
  })}</ul>;
}
