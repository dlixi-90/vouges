import { parseTree, text } from "./product-parser.mjs";

export const descendants = node => (node.children || []).filter(child => typeof child !== "string").flatMap(child => [child, ...descendants(child)]);
const hasClass = (node, name) => node.attrs?.class?.split(/\s+/).includes(name);
export const canonicalHex = value => {
  const match = value?.trim().match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map(char => char + char).join("") : hex}`;
};
export const parseAccordLibrary = html => {
  const list = descendants(parseTree(html)).find(node => hasClass(node, "list-scent"));
  if (!list) return [];
  return descendants(list).filter(node => node.tag === "a").map(node => {
    const children = descendants(node);
    return { label: text(children.find(child => child.tag === "h3")), english: text(children.find(child => child.tag === "p")), url: node.attrs.href };
  }).filter(row => row.label && /^https:\/\/apaniche\.vn\/mui-huong-[a-z0-9-]+\/?$/.test(row.url));
};
export const parseAccordColors = html => descendants(parseTree(html)).filter(node => hasClass(node, "accord-label")).map(node => {
  const label = text(node).replace(/\s*\([\d.,]+%\)\s*$/, "").trim();
  const styles = Object.fromEntries((node.attrs.style || "").split(";").map(declaration => {
    const separator = declaration.indexOf(":");
    return separator < 0 ? [] : [declaration.slice(0, separator).trim().toLowerCase(), declaration.slice(separator + 1).trim()];
  }).filter(entry => entry.length === 2));
  const background = canonicalHex(styles["background-color"]), foreground = canonicalHex(styles.color);
  return { label, url: node.attrs.href, background, foreground };
}).filter(row => row.label && row.background && row.foreground && /^https:\/\/apaniche\.vn\/mui-huong-[a-z0-9-]+\/?$/.test(row.url));
