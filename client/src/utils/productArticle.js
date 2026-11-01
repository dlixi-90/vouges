export const ARTICLE_LIMITS = { text: 30000, images: 30, nodes: 2000, depth: 12, json: 120000 };
export const LIBRARY_ARTICLE_LIMITS = { text: 60000, images: 120, nodes: 8000, depth: 20, json: 800000, library: true };
export const ARTICLE_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
const fail = () => { throw Object.assign(new Error("Bài viết không hợp lệ hoặc vượt giới hạn 30.000 ký tự / 30 ảnh."), { statusCode: 400 }); };
const isObject = value => value && typeof value === "object" && !Array.isArray(value);

export function isArticleUrl(value, image = false) {
  if (typeof value !== "string" || !value || value.length > 2000 || /[\s\\]/u.test(value) || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false;
  if (/^\/(?!\/)/.test(value)) return !image || value.startsWith("/images/");
  if (!image && (/^#[\w-]+$/.test(value) || /^mailto:[^<>]+@[^<>]+$/i.test(value))) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function safeColor(value) {
  if (/^#[\da-f]{3}([\da-f]{3})?$/i.test(value)) return value.toLowerCase();
  const match = /^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/.exec(value);
  if (match && match.slice(1).every(part => Number(part) <= 255)) return `#${match.slice(1).map(part => Number(part).toString(16).padStart(2, "0")).join("")}`;
  fail();
}

export function sanitizeArticle(document, limits = ARTICLE_LIMITS) {
  if (document === null) return null;
  if (!isObject(document) || document.type !== "doc") fail();
  if (JSON.stringify(document).length > limits.json) fail();
  let nodes = 0, textLength = 0, images = 0;
  const inline = ["text", "hardBreak"], blocks = ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "horizontalRule", "image", ...(limits.library ? ["libraryCards"] : [])];
  const visit = (node, parent, depth) => {
    if (!isObject(node) || ++nodes > limits.nodes || depth > limits.depth) fail();
    const type = node.type;
    if (parent && !(parent === "bulletList" || parent === "orderedList" ? type === "listItem" : parent === "paragraph" || parent === "heading" ? inline.includes(type) : blocks.includes(type))) fail();
    const result = { type };
    if (type === "text") {
      if (typeof node.text !== "string" || !node.text || (textLength += node.text.length) > limits.text) fail();
      result.text = node.text;
      if (node.marks !== undefined) {
        if (!Array.isArray(node.marks) || node.marks.length > 7) fail();
        result.marks = node.marks.map(mark => {
          if (!isObject(mark)) fail();
          if (["bold", "italic", "underline", "strike", "code"].includes(mark.type)) return { type: mark.type };
          if (mark.type === "link") {
            if (!isArticleUrl(mark.attrs?.href)) fail();
            return { type: "link", attrs: { href: mark.attrs.href, target: "_blank", rel: "noopener noreferrer nofollow" } };
          }
          if (mark.type === "textStyle") {
            const attrs = {};
            if (mark.attrs?.color) attrs.color = safeColor(mark.attrs.color);
            if (mark.attrs?.fontSize) {
              if (!ARTICLE_FONT_SIZES.some(size => mark.attrs.fontSize === `${size}px`)) fail();
              attrs.fontSize = mark.attrs.fontSize;
            }
            return { type: "textStyle", attrs };
          }
          fail();
        });
      }
      return result;
    }
    if (type === "image") {
      if (++images > limits.images || !isArticleUrl(node.attrs?.src, true)) fail();
      const attrs = { src: node.attrs.src, alt: "", title: "", articleWidth: 100 };
      for (const key of ["alt", "title"]) {
        if (node.attrs[key] != null) {
          if (typeof node.attrs[key] !== "string" || node.attrs[key].length > 500) fail();
          attrs[key] = node.attrs[key];
        }
      }
      if (node.attrs.articleWidth != null) {
        if (![50, 75, 100].includes(node.attrs.articleWidth)) fail();
        attrs.articleWidth = node.attrs.articleWidth;
      }
      if (node.attrs.width != null || node.attrs.height != null) {
        const { width, height } = node.attrs;
        if (![width, height].every(value => Number.isSafeInteger(value) && value > 0 && value <= 20000) || width * height > 40000000) fail();
        attrs.width = width; attrs.height = height;
      }
      return { type, attrs };
    }
    if (type === "libraryCards" && limits.library) {
      if (!Array.isArray(node.attrs?.items) || !node.attrs.items.length || node.attrs.items.length > 200) fail();
      const columns = node.attrs.columns ?? 4;
      if (![2, 3, 4, 6].includes(columns)) fail();
      const items = node.attrs.items.map(item => {
        if (!isObject(item) || typeof item.name !== "string" || !item.name.trim() || item.name.length > 500 || !isArticleUrl(item.href)) fail();
        const safe = { name: item.name, href: item.href };
        for (const key of ["englishName", "description"]) if (item[key]) {
          if (typeof item[key] !== "string" || item[key].length > (key === "description" ? 15000 : 500)) fail();
          safe[key] = item[key];
        }
        textLength += [safe.name, safe.englishName, safe.description].filter(Boolean).join(" ").length;
        if (textLength > limits.text) fail();
        if (item.image) {
          if (!isArticleUrl(item.image, true) || ++images > limits.images) fail();
          safe.image = item.image;
          if (item.width != null && item.height != null) {
            if (![item.width, item.height].every(value => Number.isSafeInteger(value) && value > 0 && value <= 20000) || item.width * item.height > 40000000) fail();
            safe.width = item.width; safe.height = item.height;
          }
        }
        return safe;
      });
      return { type, attrs: { columns, items } };
    }
    if (["hardBreak", "horizontalRule"].includes(type)) return result;
    if (!["doc", "listItem", ...blocks].includes(type)) fail();
    const attrs = {};
    if (type === "heading") {
      if (![2, 3].includes(node.attrs?.level)) fail();
      attrs.level = node.attrs.level;
    }
    if (["paragraph", "heading"].includes(type) && node.attrs?.textAlign != null) {
      if (!["left", "center", "right", "justify"].includes(node.attrs.textAlign)) fail();
      attrs.textAlign = node.attrs.textAlign;
    }
    if (type === "orderedList") {
      const start = node.attrs?.start ?? 1;
      if (!Number.isSafeInteger(start) || start < 1 || start > 10000) fail();
      attrs.start = start;
    }
    if (Object.keys(attrs).length) result.attrs = attrs;
    if (node.content !== undefined && !Array.isArray(node.content)) fail();
    result.content = (node.content || []).map(child => visit(child, type, depth + 1));
    if (["bulletList", "orderedList"].includes(type) && !result.content.length) fail();
    if (type === "listItem" && result.content[0]?.type !== "paragraph") fail();
    if (type === "doc" && !result.content.length) result.content = [{ type: "paragraph", content: [] }];
    return result;
  };
  return visit(document, null, 0);
}

export function articleToPlainText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text;
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") return node.attrs?.title || node.attrs?.alt || "";
  if (node.type === "libraryCards") return node.attrs.items.map(item => [item.name, item.englishName, item.description].filter(Boolean).join("\n")).join("\n");
  return (node.content || []).map(articleToPlainText).join(["paragraph", "heading"].includes(node.type) ? "" : "\n");
}

export function articleFromText(text = "") {
  return { type: "doc", content: String(text).split(/\r?\n/).map(line => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) };
}

export function getArticleDocument(content, text = "", limits = ARTICLE_LIMITS) {
  try { return sanitizeArticle(content, limits) || articleFromText(text); } catch { return articleFromText(text); }
}
