import { getArticleDocument, articleToPlainText, LIBRARY_ARTICLE_LIMITS } from "./productArticle.js";
import { accordOpening } from "./accordOpening.js";

const clean = value => String(value || "").normalize("NFC").trim();
const key = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[đĐ]/gu, "d").toLowerCase().replace(/[^a-z0-9]/gu, "");
const vietnamese = value => /[ăâđêôơưĂÂĐÊÔƠƯ\u1ea0-\u1ef9]/u.test(clean(value));
const generic = new Set(["gioithieu", "tongquan", "noidung", "introduction", "overview", "summary", "about", "contents", "details"]);
const hasLink = node => node?.marks?.some(mark => mark.type === "link") || node?.content?.some(hasLink);
const categoryNavigation = node => node?.type === "libraryCards" && node.attrs?.items?.length > 0 && node.attrs.items.every(item => {
  if (!item.href?.startsWith("/collection?")) return false;
  return ["Nước hoa nam", "Nước hoa nữ", "Nước hoa unisex"].includes(new URLSearchParams(item.href.slice(item.href.indexOf("?") + 1)).get("category"));
});

// Compose a reading view without rewriting the stored article or its images.
export function knowledgePresentation(term) {
  const document = getArticleDocument(term.descriptionContent, term.description || "", LIBRARY_ARTICLE_LIMITS);
  const removedNavigation = [];
  const content = document.content.filter((node, index) => {
    const remove = categoryNavigation(node) || (node.type === "heading" && key(articleToPlainText(node)) === "khamphanuochoatheogioitinh" && categoryNavigation(document.content[index + 1]));
    if (remove) removedNavigation.push(node);
    return !remove;
  });
  const hero = content[0]?.type === "image" ? content.shift() : null;
  const heading = content[0]?.type === "heading" ? content[0] : null;
  const headingText = heading ? clean(articleToPlainText(heading)) : "";
  const name = clean(term.name);
  let title = name, secondaryTitle = clean(term.englishName);
  const parts = /^(.*?)\s*\(([^()]+)\)\s*$/u.exec(name);
  if (parts && key(parts[2]) === key(secondaryTitle)) title = clean(parts[1]);
  else if (parts && key(parts[1]) === key(secondaryTitle)) title = clean(parts[2]);

  const simpleHeading = hero && headingText && headingText.length <= 100 && !generic.has(key(headingText)) && !hasLink(heading);
  if (simpleHeading && key(title) === key(secondaryTitle) && vietnamese(headingText) && !vietnamese(title)) title = headingText;
  // Some imported entries have no English-name metadata. Their leading title
  // still supplies the translation; generic section headings stay in the body.
  if (!secondaryTitle && simpleHeading) {
    if (vietnamese(title) && !vietnamese(headingText)) secondaryTitle = headingText;
    else if (!vietnamese(title) && vietnamese(headingText)) { secondaryTitle = title; title = headingText; }
  }
  if (key(title) === key(secondaryTitle)) secondaryTitle = "";
  const aliases = [name, title, secondaryTitle].filter(Boolean).map(key);
  const mergedHeading = Boolean(heading && !hasLink(heading) && aliases.includes(key(headingText)));
  if (mergedHeading) content.shift();

  // Older note/group covers have no saved dimensions but use landscape images;
  // accord covers use square images. Explicit dimensions take precedence.
  const wide = hero && (hero.attrs.width && hero.attrs.height ? hero.attrs.width / hero.attrs.height > 1.8 : term.kind !== "accord");
  const layout = hero ? term.kind === "accord" ? "accord" : wide ? "banner" : "portrait" : null;
  const intro = [];
  if (hero && ["portrait", "accord"].includes(layout)) {
    while (intro.length < 2 && content[0]?.type === "paragraph") intro.push(content.shift());
  }
  const openingSource = [...intro];
  const opening = term.kind === "accord" ? accordOpening(intro) : { intro, facts: [] };
  return {
    title, secondaryTitle, label: secondaryTitle ? `${title} (${secondaryTitle})` : title,
    hero, layout, mergedHeading, removedNavigation, openingSource,
    intro: { type: "doc", content: opening.intro }, facts: opening.facts,
    body: { type: "doc", content },
  };
}
