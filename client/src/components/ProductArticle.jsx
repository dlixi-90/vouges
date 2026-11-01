import { getArticleDocument } from "../utils/productArticle";
import "../product-article.css";

function ArticleNode({ node, imageGallery = false, expandableImage = false }) {
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
    {expandableImage?<a href={node.attrs.src} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh lớn: ${node.attrs.alt||"hình minh họa"}`}><img src={node.attrs.src} alt={node.attrs.alt} width={node.attrs.width} height={node.attrs.height} loading="lazy" decoding="async"/></a>:<img src={node.attrs.src} alt={node.attrs.alt} width={node.attrs.width} height={node.attrs.height} loading="lazy" decoding="async" />}
    {node.attrs.title && <figcaption>{node.attrs.title}</figcaption>}
  </figure>;
  if (node.type === "doc") {
    if (!imageGallery) return children;
    const groups=[];
    for(let i=0;i<(node.content||[]).length;i++){
      if(node.content[i].type!=="image"){groups.push(<ArticleNode key={i} node={node.content[i]}/>);continue;}
      const start=i,images=[];
      while(i<node.content.length&&node.content[i].type==="image"){
        images.push(<ArticleNode key={i} node={node.content[i]} expandableImage/>);i++;
      }
      groups.push(<div className="product-article-gallery" key={`gallery-${start}`}>{images}</div>);i--;
    }
    return groups;
  }
  const Tag = node.type === "heading" ? `h${node.attrs.level}` : { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote" }[node.type];
  return Tag ? <Tag style={{ textAlign: node.attrs?.textAlign }} {...(node.type === "orderedList" ? { start: node.attrs?.start } : {})}>{children}</Tag> : null;
}

export default function ProductArticle({ content, text, imageGallery = false }) {
  const document = getArticleDocument(content, text || "Nội dung mô tả sản phẩm đang được cập nhật.");
  return <div className="product-article"><ArticleNode node={document} imageGallery={imageGallery} /></div>;
}
