import palette from "../data/accordColors.json" with { type: "json" };

const nameKey = value => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const byName = new Map(Object.values(palette).flatMap(color => [color.label, color.english].filter(Boolean).map(name => [nameKey(name), color])));
const fallback = Object.freeze({ background: "#e7e7e7", foreground: "#171717" });

export const getAccordColors = accord => {
  let slug;
  try {
    const url = new URL(accord.url);
    if (url.origin === "https://apaniche.vn") slug = url.pathname.replace(/^\/|\/$/g, "");
  } catch { /* Manually entered accords can have a name without a source URL. */ }
  return (Object.hasOwn(palette, slug) ? palette[slug] : null) || byName.get(nameKey(accord.label)) || fallback;
};

export const getAccordPercent = accord => typeof accord.displayedPercent === "number" && Number.isFinite(accord.displayedPercent) && accord.displayedPercent >= 0 && accord.displayedPercent <= 100 ? accord.displayedPercent : null;
