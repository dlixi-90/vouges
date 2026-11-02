const seasonName = value => String(value || "").normalize("NFC").trim().toLocaleLowerCase("vi-VN").replace(/^mùa\s+/u, "").replace(/^hạ$/u, "hè");
const seasons = new Set(["xuân", "hè", "thu", "đông"]);
const nodeText = node => node?.text || (node?.content || []).map(nodeText).join("");

// Group only an icon followed by its short, matching season label. Editorial
// paragraphs, unrelated images and the persisted document remain untouched.
export function groupArticleSeasons(content = []) {
  const result = [];
  for (let index = 0; index < content.length;) {
    const items = [];
    while (index < content.length) {
      const image = content[index], label = content[index + 1];
      const season = seasonName(image?.attrs?.alt);
      if (image?.type !== "image" || !seasons.has(season) || label?.type !== "paragraph" || seasonName(nodeText(label)) !== season) break;
      items.push({ image, label });
      index += 2;
    }
    if (items.length) result.push({ type: "seasonRow", items });
    else result.push(content[index++]);
  }
  return result;
}
