import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eye, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2, Unlink } from "lucide-react";
import { LoadingStatus } from "../LoadingState";
import { ARTICLE_FONT_SIZES, ARTICLE_LIMITS, LIBRARY_ARTICLE_LIMITS } from "../../utils/productArticle";

const toolbarButtons = [
  ["Chữ đậm", Bold],
  ["Chữ nghiêng", Italic],
  ["Gạch chân", Underline],
  ["Gạch ngang", Strikethrough],
];
const alignmentButtons = [
  ["Căn trái", AlignLeft],
  ["Căn giữa", AlignCenter],
  ["Căn phải", AlignRight],
  ["Căn đều", AlignJustify],
];
const blockButtons = [
  ["Danh sách dấu đầu dòng", List],
  ["Danh sách đánh số", ListOrdered],
  ["Trích dẫn", Quote],
  ["Đường phân cách", Minus],
  ["Chèn hoặc sửa liên kết", Link2],
  ["Bỏ liên kết", Unlink],
];
const historyButtons = [
  ["Xóa định dạng", RemoveFormatting],
  ["Hoàn tác", Undo2],
  ["Làm lại", Redo2],
];

export default function ArticleEditorShell({ library = false, label = "Đang tải nội dung giới thiệu…" }) {
  const limits = library ? LIBRARY_ARTICLE_LIMITS : ARTICLE_LIMITS;
  const renderIconBtn = ([title, Icon]) => (
    <button key={title} type="button" title={title} aria-label={title} disabled>
      <Icon size={17} strokeWidth={1.7} />
    </button>
  );

  return (
    <div className="product-article-editor" aria-busy="true">
      <div className="article-editor-toolbar" role="group" aria-label="Định dạng bài viết">
        <select aria-label="Kiểu đoạn văn" value="p" disabled>
          <option value="p">Đoạn văn</option>
          <option value="2">Tiêu đề lớn</option>
          <option value="3">Tiêu đề nhỏ</option>
        </select>
        <select aria-label="Cỡ chữ bài viết" value="" disabled>
          <option value="">Cỡ chữ</option>
          {ARTICLE_FONT_SIZES.map(size => <option key={size} value={`${size}px`}>{size} px</option>)}
        </select>
        {toolbarButtons.map(renderIconBtn)}
        <label className="article-color" title="Màu chữ">
          <span className="sr-only">Màu chữ bài viết</span>
          <input type="color" value="#171717" disabled readOnly />
        </label>
        {alignmentButtons.map(renderIconBtn)}
        {blockButtons.map(renderIconBtn)}
        <label className="article-upload is-disabled" title="Chèn ảnh">
          <ImagePlus size={17} />
          <span>Thêm ảnh</span>
          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled aria-label="Chèn ảnh vào mô tả" />
        </label>
        {historyButtons.map(renderIconBtn)}
        <button type="button" className="article-preview-toggle" disabled aria-pressed={false}>
          <Eye size={16} />Xem trước
        </button>
      </div>
      <div className="product-article product-article-editable product-article-loading">
        <LoadingStatus label={label} />
      </div>
      <div className="article-editor-footer">
        <span>0 / {limits.text.toLocaleString("vi-VN")} ký tự</span>
        <span>0 / {limits.images} ảnh</span>
      </div>
    </div>
  );
}
