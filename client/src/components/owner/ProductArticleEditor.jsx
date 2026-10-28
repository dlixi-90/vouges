import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eye, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Trash2, Underline, Undo2, Unlink } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import ProductArticle from "../ProductArticle";
import { ARTICLE_FONT_SIZES, ARTICLE_LIMITS, articleToPlainText, getArticleDocument, isArticleUrl } from "../../utils/productArticle";

const ArticleImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), articleWidth: {
      default: 100,
      parseHTML: element => [50, 75, 100].includes(Number(element.dataset.articleWidth)) ? Number(element.dataset.articleWidth) : 100,
      renderHTML: attrs => ({ "data-article-width": attrs.articleWidth, style: `width: ${attrs.articleWidth}%` }),
    } };
  },
});

export default function ProductArticleEditor({ value, text, onChange, onUploadingChange, disabled = false }) {
  const { axios, getToken } = useAppContext();
  const [preview, setPreview] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false), [linkUrl, setLinkUrl] = useState("");
  const linkRef = useRef(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, link: { openOnClick: false, autolink: false, isAllowedUri: url => isArticleUrl(url) } }),
      ArticleImage.configure({ allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyleKit.configure({ backgroundColor: false, fontFamily: false, lineHeight: false }),
    ],
    content: getArticleDocument(value, text),
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "product-article product-article-editable", role: "textbox", "aria-label": "Trình soạn thảo mô tả sản phẩm", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => {
      const content = current.getJSON();
      onChange(content, articleToPlainText(content).trim().slice(0, 5000));
    },
  });
  useEffect(() => { editor?.setEditable(!disabled && !uploading, false); }, [editor, disabled, uploading]);
  useEffect(() => { if (linkOpen) linkRef.current?.focus(); }, [linkOpen]);

  if (!editor) return <p role="status">Đang tải trình soạn thảo…</p>;
  const busy = disabled || uploading;
  const content = editor.getJSON();
  let imageCount = 0;
  editor.state.doc.descendants(node => { if (node.type.name === "image") imageCount++; });
  const textLength = editor.getText().length;
  const selectedImage = editor.isActive("image");
  const imageAttrs = selectedImage ? editor.getAttributes("image") : {};
  const tool = (label, Icon, action, active = false, unavailable = false) => <button type="button" title={label} aria-label={label} aria-pressed={active}
    disabled={busy || unavailable} onMouseDown={event => event.preventDefault()} onClick={action}><Icon size={17} strokeWidth={1.7} /></button>;
  const upload = async (files, replace = false) => {
    if (!files.length || busy) return;
    setError("");
    if (files.length > 4 || files.some(file => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("Chọn tối đa 4 ảnh PNG, JPEG hoặc WebP, mỗi ảnh không quá 5 MB."); return;
    }
    if (imageCount + (replace ? 0 : files.length) > ARTICLE_LIMITS.images) { setError("Bài viết tối đa 30 ảnh."); return; }
    const position = editor.state.selection.from;
    setUploading(true); onUploadingChange?.(true);
    try {
      const form = new FormData(); files.forEach(file => form.append("images", file));
      const { data } = await axios.post("/api/catalog/media", form, { headers: { Authorization: `Bearer ${await getToken()}` } });
      if (!data.success || !data.images?.length || data.images.some(url => !isArticleUrl(url, true))) throw new Error(data.message || "Không thể tải ảnh bài viết.");
      if (editor.isDestroyed) return;
      if (replace) editor.chain().focus().setNodeSelection(position).updateAttributes("image", { src: data.images[0] }).run();
      else editor.chain().focus().insertContentAt(position, data.images.flatMap(src => [{ type: "image", attrs: { src, alt: "", title: "", articleWidth: 100 } }, { type: "paragraph" }])).run();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setUploading(false); onUploadingChange?.(false); }
  };
  const applyLink = () => {
    const href = linkUrl.trim();
    if (href && !isArticleUrl(href)) { setError("Nhập liên kết HTTP, HTTPS hoặc địa chỉ email hợp lệ."); return; }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run(); else chain.unsetLink().run();
    setError(""); setLinkOpen(false);
  };

  return <div className="product-article-editor">
    <div className="article-editor-toolbar" role="group" aria-label="Định dạng bài viết">
      {!preview && <>
        <select aria-label="Kiểu đoạn văn" value={editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "p"} disabled={busy}
          onChange={event => event.target.value === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value) }).run()}>
          <option value="p">Đoạn văn</option><option value="2">Tiêu đề lớn</option><option value="3">Tiêu đề nhỏ</option>
        </select>
        <select aria-label="Cỡ chữ bài viết" value={editor.getAttributes("textStyle").fontSize || ""} disabled={busy} onChange={event => event.target.value ? editor.chain().focus().setFontSize(event.target.value).run() : editor.chain().focus().unsetFontSize().run()}>
          <option value="">Cỡ chữ</option>{ARTICLE_FONT_SIZES.map(size => <option key={size} value={`${size}px`}>{size} px</option>)}
        </select>
        {tool("Chữ đậm", Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {tool("Chữ nghiêng", Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {tool("Gạch chân", Underline, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {tool("Gạch ngang", Strikethrough, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        <label className="article-color" title="Màu chữ"><span className="sr-only">Màu chữ bài viết</span><input type="color" value={/^#[\da-f]{6}$/i.test(editor.getAttributes("textStyle").color || "") ? editor.getAttributes("textStyle").color : "#171717"} disabled={busy} onChange={event => editor.chain().focus().setColor(event.target.value).run()} /></label>
        {[["left", "Căn trái", AlignLeft], ["center", "Căn giữa", AlignCenter], ["right", "Căn phải", AlignRight], ["justify", "Căn đều", AlignJustify]].map(([alignment, label, Icon]) => <span key={alignment}>{tool(label, Icon, () => editor.chain().focus().setTextAlign(alignment).run(), editor.isActive({ textAlign: alignment }))}</span>)}
        {tool("Danh sách dấu đầu dòng", List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {tool("Danh sách đánh số", ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {tool("Trích dẫn", Quote, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        {tool("Đường phân cách", Minus, () => editor.chain().focus().setHorizontalRule().run())}
        {tool("Chèn hoặc sửa liên kết", Link2, () => { setLinkUrl(editor.getAttributes("link").href || ""); setLinkOpen(current => !current); }, editor.isActive("link"))}
        {tool("Bỏ liên kết", Unlink, () => editor.chain().focus().unsetLink().run(), false, !editor.isActive("link"))}
        <label className={`article-upload${busy ? " is-disabled" : ""}`} title="Chèn ảnh"><ImagePlus size={17} /><span>Thêm ảnh</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} aria-label="Chèn ảnh vào mô tả" onChange={event => { void upload([...event.target.files]); event.target.value = ""; }} /></label>
        {tool("Xóa định dạng", RemoveFormatting, () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
        {tool("Hoàn tác", Undo2, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {tool("Làm lại", Redo2, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
      </>}
      <button type="button" className="article-preview-toggle" disabled={busy} aria-pressed={preview} onClick={() => { setPreview(current => !current); setLinkOpen(false); }}><Eye size={16} />{preview ? "Tiếp tục soạn" : "Xem trước"}</button>
    </div>
    {linkOpen && !preview && <div className="article-link-editor" role="group" aria-label="Biên tập liên kết">
      <input ref={linkRef} type="url" value={linkUrl} aria-label="Địa chỉ liên kết" placeholder="https://…" disabled={busy} onChange={event => setLinkUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } if (event.key === "Escape") { event.preventDefault(); setLinkOpen(false); editor.commands.focus(); } }} />
      <button type="button" disabled={busy} onClick={applyLink}>Áp dụng</button><button type="button" onClick={() => { setLinkOpen(false); editor.commands.focus(); }}>Hủy</button>
    </div>}
    {selectedImage && !preview && <div className="article-image-editor" role="group" aria-label="Biên tập ảnh bài viết">
      <label>Mô tả ảnh<input value={imageAttrs.alt || ""} maxLength={500} disabled={busy} onChange={event => editor.commands.updateAttributes("image", { alt: event.target.value })} /></label>
      <label>Chú thích ảnh<input value={imageAttrs.title || ""} maxLength={500} disabled={busy} onChange={event => editor.commands.updateAttributes("image", { title: event.target.value })} /></label>
      <label>Chiều rộng<select value={imageAttrs.articleWidth || 100} disabled={busy} onChange={event => editor.commands.updateAttributes("image", { articleWidth: Number(event.target.value) })}>{[50, 75, 100].map(width => <option key={width} value={width}>{width}%</option>)}</select></label>
      <label className="article-upload">Thay ảnh<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-label="Thay ảnh trong mô tả" onChange={event => { void upload([...event.target.files], true); event.target.value = ""; }} /></label>
      <button type="button" disabled={busy} onClick={() => editor.chain().focus().deleteSelection().run()}><Trash2 size={16} />Xóa ảnh</button>
    </div>}
    {error && <p role="alert" className="article-editor-error">{error}</p>}
    {uploading && <p role="status" className="article-editor-status">Đang tải ảnh bài viết…</p>}
    <div hidden={preview}><EditorContent editor={editor} /></div>
    {preview && <div className="article-editor-preview"><ProductArticle content={content} /></div>}
    <div className="article-editor-footer"><span>{textLength.toLocaleString("vi-VN")} / 30.000 ký tự</span><span>{imageCount} / 30 ảnh</span></div>
    {textLength > ARTICLE_LIMITS.text && <p role="alert" className="article-editor-error">Bài viết vượt giới hạn 30.000 ký tự. Vui lòng rút gọn trước khi lưu.</p>}
  </div>;
}
