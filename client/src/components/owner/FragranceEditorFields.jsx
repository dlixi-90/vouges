import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { assessmentGroups } from "../../utils/fragrance";
import FragranceCharts from "../FragranceCharts";
import FragranceAccords from "../FragranceAccords";

export function AccordEditor({ accords, terms = [], onChange, listId }) {
  const update = (index, patch) => onChange(accords.map((row, i) => i === index ? { ...row, ...patch } : row));
  const move = (index, direction) => {
    const rows = [...accords];
    [rows[index], rows[index + direction]] = [rows[index + direction], rows[index]];
    onChange(rows);
  };
  return <section className="perfume-accord-editor" aria-label="Chỉnh sửa các kiểu mùi chính">
    <div className="perfume-section-heading"><div><h3>Các kiểu mùi chính</h3><p className="perfume-muted">Chọn từ thư viện hoặc nhập tên riêng. Tỷ lệ mỗi kiểu mùi từ 0–100%, không bắt buộc cộng thành 100%.</p></div><button type="button" className="perfume-button" disabled={accords.length >= 30} onClick={() => onChange([...accords, { label: "", displayedPercent: null, url: null }])}><Plus size={15} />Thêm kiểu mùi</button></div>
    <datalist id={listId}>{terms.map(term => <option key={term._id} value={term.name} />)}</datalist>
    {!accords.length && <p className="perfume-empty">Chưa có kiểu mùi. Chọn “Thêm kiểu mùi” để bổ sung.</p>}
    <div className="perfume-accord-inputs">{accords.map((accord, index) => <div className="perfume-accord-input-row" key={index}>
      <label className="perfume-field"><span>Kiểu mùi {index + 1}</span><input list={listId} required maxLength={160} value={accord.label} aria-label={`Tên kiểu mùi ${index + 1}`} placeholder="Ví dụ: Gỗ, Cam chanh…" onChange={event => update(index, { label: event.target.value, url: terms.find(term => term.name.toLocaleLowerCase("vi-VN") === event.target.value.trim().toLocaleLowerCase("vi-VN"))?.sourceUrl || null })} /></label>
      <label className="perfume-field perfume-percent-input"><span>Tỷ lệ (%)</span><input type="number" min={0} max={100} step="any" value={accord.displayedPercent ?? ""} aria-label={`Tỷ lệ kiểu mùi ${index + 1}`} placeholder="Chưa có" onChange={event => update(index, { displayedPercent: event.target.value === "" ? null : Number(event.target.value) })} /></label>
      <div className="perfume-accord-actions"><button type="button" className="perfume-icon-button" aria-label={`Đưa kiểu mùi ${index + 1} lên`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button type="button" className="perfume-icon-button" aria-label={`Đưa kiểu mùi ${index + 1} xuống`} disabled={index === accords.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button type="button" className="perfume-icon-button" aria-label={`Xóa kiểu mùi ${index + 1}`} onClick={() => onChange(accords.filter((_, i) => i !== index))}><X size={14} /></button></div>
    </div>)}</div>
    {accords.length > 0 && <div className="perfume-editor-preview"><h4>Xem trước kiểu mùi</h4><FragranceAccords accords={accords.filter(row => row.label.trim())} /></div>}
  </section>;
}

export function AssessmentEditor({ fragrance, onChange }) {
  const update = (key, index, field, value) => onChange(key, fragrance[key].map((row, i) => i === index ? { ...row, [field]: value === "" ? null : Number(value) } : row));
  return <>
    <div className="perfume-assessment-editor">{assessmentGroups.map(group => <section className="perfume-assessment-group" key={group.key}>
      <h3>{group.title}</h3><div className="perfume-table-scroll"><table><thead><tr><th>Mức đánh giá</th>{group.counts && <th>Số lượt</th>}<th>Tỷ lệ (%)</th></tr></thead><tbody>{fragrance[group.key].map((row, index) => <tr key={row.label}><th scope="row">{row.label}</th>{group.counts && <td><input type="number" min={0} step={1} aria-label={`Số lượt ${group.title} ${row.label}`} value={row.displayedCount ?? ""} placeholder="—" onChange={event => update(group.key, index, "displayedCount", event.target.value)} /></td>}<td><input type="number" min={0} max={100} step="any" aria-label={`Tỷ lệ ${group.title} ${row.label}`} value={row.displayedPercent ?? ""} placeholder="—" onChange={event => update(group.key, index, "displayedPercent", event.target.value)} /></td></tr>)}</tbody></table></div>
    </section>)}</div>
    <p className="perfume-muted">Để trống khi chưa có dữ liệu; nhập 0 khi giá trị thực sự bằng 0. Tỷ lệ và số lượt được quản lý riêng, không tự suy ra phương pháp tính của nguồn.</p>
    <div className="perfume-editor-preview"><h3>Xem trước đánh giá trải nghiệm</h3><FragranceCharts fragrance={fragrance} showSourceIssues /></div>
  </>;
}
