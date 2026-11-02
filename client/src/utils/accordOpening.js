import { articleToPlainText } from "./productArticle.js";

const length = node => node.type === "text" ? node.text.length : node.type === "hardBreak" ? 1 : 0;
const trim = nodes => {
  const result = nodes.map(node => ({ ...node }));
  while (result[0]?.type === "text" && !result[0].text.trim()) result.shift();
  while (result.at(-1)?.type === "text" && !result.at(-1).text.trim()) result.pop();
  if (result[0]?.type === "text") result[0].text = result[0].text.trimStart();
  if (result.at(-1)?.type === "text") result.at(-1).text = result.at(-1).text.trimEnd();
  return result;
};
// Slice text offsets without dropping links, emphasis or other inline marks.
const slice = (nodes, start, end) => {
  let offset = 0;
  return trim(nodes.flatMap(node => {
    const from = Math.max(0, start - offset), to = Math.min(length(node), end - offset);
    offset += length(node);
    if (to <= from) return [];
    return [node.type === "text" ? { ...node, text: node.text.slice(from, to) } : { ...node }];
  }));
};
const paragraphs = (node, nodes) => {
  const result = []; let group = [];
  for (const child of nodes) {
    // Imported paragraphs were joined with whitespace-only separator nodes.
    // Keep genuine inline formatting together, splitting only after a sentence.
    const previous = group.map(part => part.text || "").join("");
    if (child.type === "text" && /^\s+$/u.test(child.text) && previous.trim().length > 120 && /[.!?…]["”')]*\s*$/u.test(previous)) {
      result.push({ ...node, content: trim(group) }); group = [];
    } else group.push(child);
  }
  if (trim(group).length) result.push({ ...node, content: trim(group) });
  return result;
};

export function accordOpening(nodes) {
  const intro = [], facts = [];
  for (const node of nodes) {
    const text = articleToPlainText(node), marker = /Dữ liệu mùi hương/iu.exec(text);
    if (node.type !== "paragraph" || !marker || node.content.some(part => !["text", "hardBreak"].includes(part.type))) { intro.push(node); continue; }
    const tail = text.slice(marker.index);
    const labels = [...tail.matchAll(/(?:Loại|Nhóm hương(?: chính)?|Bộ phận sử dụng|Kết hợp ấn tượng với)\s*:/giu)].filter(match => match.index === 0 || /\s/u.test(tail[match.index - 1]));
    // Unknown or incomplete structures stay intact instead of losing text.
    if (labels.length < 2 || !/^Loại\s*:/iu.test(labels[0][0]) || !/^Kết hợp/iu.test(labels.at(-1)[0]) || new Set(labels.map(match => match[0].toLowerCase())).size !== labels.length) { intro.push(node); continue; }
    const fields = labels.map((match, index) => ({
      label: match[0].trim(),
      content: { type: "doc", content: [{ type: "paragraph", content: slice(node.content, marker.index + match.index + match[0].length, index + 1 < labels.length ? marker.index + labels[index + 1].index : text.length) }] },
      wide: /^Kết hợp/iu.test(match[0]),
    }));
    if (fields.some(field => !field.content.content[0].content.length)) { intro.push(node); continue; }
    intro.push(...paragraphs(node, slice(node.content, 0, marker.index)));
    facts.push({ title: tail.slice(0, labels[0].index).trim(), fields });
  }
  return { intro, facts };
}
