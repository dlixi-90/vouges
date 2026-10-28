import { getArticleDocument } from "../utils/productArticle";

function ArticleNode({ node }) {
  const children = node.content?.map((child, index) => <ArticleNode key={index} node={child} />);
  if (node.type === "text") {
    let text = node.text;
    for (const mark of node.marks || []) {
      const attrs = mark.attrs || {};
      const Tag = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code" }[mark.type];
      if (Tag) text = <Tag>{text}</Tag>;
      else if (mark.type === "link") text = <a href={attrs.href} target="_blank" rel="noopener noreferrer nofollow">{text}</a>;
      else if (mark.type === "textStyle") text = <span style={{ color: attrs.color, fontSize: attrs.fontSize }}>{text}</span>;
    }
    return text;
  }
  if (node.type === "hardBreak") return <br />;
  if (node.type === "horizontalRule") return <hr />;
  if (node.type === "image") return <figure style={{ width: `${node.attrs.articleWidth}%` }}>
    <img src={node.attrs.src} alt={node.attrs.alt} loading="lazy" />
    {node.attrs.title && <figcaption>{node.attrs.title}</figcaption>}
  </figure>;
  if (node.type === "doc") return children;
  const Tag = node.type === "heading" ? `h${node.attrs.level}` : { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote" }[node.type];
  return Tag ? <Tag style={{ textAlign: node.attrs?.textAlign }} {...(node.type === "orderedList" ? { start: node.attrs?.start } : {})}>{children}</Tag> : null;
}

export default function ProductArticle({ content, text }) {
  const document = getArticleDocument(content, text || "Nội dung mô tả sản phẩm đang được cập nhật.");
  return <div className="product-article"><ArticleNode node={document} /></div>;
}
