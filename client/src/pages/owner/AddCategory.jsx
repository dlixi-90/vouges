import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import CategoryTypes from "../../components/owner/CategoryTypes";
import DeleteCategoryDialog from "../../components/owner/DeleteCategoryDialog";
import { Badge, CatalogPage, RefreshButton } from "../../components/owner/CatalogUI";
import { OperationsEmptyState, OperationsPanel } from "../../components/owner/OperationsUI";

const AddCategory = () => {
  const {
    axios,
    getToken,
    categories,
    categoriesLoading,
    categoriesError,
    fetchCategories,
    replaceCategory,
    removeCategory,
    fetchProducts,
    navigate,
  } = useAppContext();
  const { state: navigationState } = useLocation();
  const returnTo = /^\/owner\/(add-product|edit-product\/[a-f0-9]{24})$/.test(navigationState?.returnTo || "")
    ? navigationState.returnTo : null;
  const [returnSelection, setReturnSelection] = useState(null);
  const [name, setName] = useState("");
  const [typeName, setTypeName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [expandedId, setExpandedId] = useState(navigationState?.categoryId || null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const busy = saving || savingType || deleting;
  const query = search.trim().toLowerCase();
  const visibleCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(query) ||
      (category.types || []).some((type) =>
        type.name.toLowerCase().includes(query),
      ),
  );

  const requestDelete = (category, type = null) => {
    setDeleteError("");
    setDeleteTarget({ category, type });
  };

  const confirmDelete = async () => {
    if (busy || !deleteTarget) return;
    const { category, type } = deleteTarget;
    setDeleting(true);
    setDeleteError("");
    try {
      const url = `/api/categories/${category._id}${type ? `/types/${type._id}` : ""}`;
      const { data } = await axios.delete(url, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!data.success) throw new Error(data.message || "Không thể xóa");
      if (type) {
        replaceCategory(data.category);
      } else {
        removeCategory(category._id);
        if (expandedId === category._id) setExpandedId(null);
        if (editingId === category._id) setEditingId(null);
      }
      setDeleteTarget(null);
      toast.success(data.message);
    } catch (error) {
      setDeleteError(
        error.response?.data?.message || error.message || "Không thể xóa",
      );
    } finally {
      setDeleting(false);
    }
  };

  const saveType = async (category, value, typeId) => {
    if (busy) return false;
    const nextName = value.trim().replace(/\s+/g, " ");
    if (!nextName || nextName.length > 100) {
      toast.error("Tên loại sản phẩm phải có từ 1 đến 100 ký tự");
      return false;
    }
    if (
      (category.types || []).some(
        (type) =>
          type._id !== typeId &&
          type.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      toast.error("Tên loại sản phẩm đã tồn tại trong danh mục này");
      return false;
    }
    setSavingType(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${await getToken()}` },
      };
      const url = `/api/categories/${category._id}/types`;
      const { data } = typeId
        ? await axios.put(`${url}/${typeId}`, { name: nextName }, config)
        : await axios.post(url, { name: nextName }, config);
      if (!data.success) throw new Error(data.message || "Không thể lưu loại sản phẩm");
      replaceCategory(data.category);
      const savedType = data.category.types.find((item) => item.name.toLowerCase() === nextName.toLowerCase());
      setReturnSelection({ categoryId: data.category._id, typeId: savedType?._id });
      if (typeId) await fetchProducts();
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Không thể lưu loại sản phẩm",
      );
      return false;
    } finally {
      setSavingType(false);
    }
  };

  const saveCategory = async (event, categoryId = null) => {
    event.preventDefault();
    if (busy) return;
    const nextName = (categoryId ? editName : name).trim().replace(/\s+/g, " ");
    if (!nextName || nextName.length > 100) {
      toast.error("Tên danh mục phải có từ 1 đến 100 ký tự");
      return;
    }
    const firstTypeName = typeName.trim().replace(/\s+/g, " ");
    if (!categoryId && (!firstTypeName || firstTypeName.length > 100)) {
      toast.error("Loại sản phẩm phải có từ 1 đến 100 ký tự");
      return;
    }
    if (
      categories.some(
        (item) =>
          item._id !== categoryId &&
          item.name.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      toast.error("Tên danh mục đã tồn tại");
      return;
    }

    setSaving(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${await getToken()}` },
      };
      const { data } = categoryId
        ? await axios.put(
            `/api/categories/${categoryId}`,
            { name: nextName },
            config,
          )
        : await axios.post("/api/categories", { name: nextName, typeName: firstTypeName }, config);
      if (!data.success)
        throw new Error(data.message || "Không thể lưu danh mục");
      replaceCategory(data.category);
      if (categoryId) {
        setEditingId(null);
        setEditName("");
        await fetchProducts();
      } else {
        setName("");
        setTypeName("");
        setReturnSelection({ categoryId: data.category._id, typeId: data.category.types[0]?._id });
        setSearch("");
        setExpandedId(data.category._id);
      }
      toast.success(data.message);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Không thể lưu danh mục",
      );
    } finally {
      setSaving(false);
    }
  };

  return <CatalogPage className="admin-operations-page admin-categories-page" title="Danh mục" actions={<><RefreshButton onClick={fetchCategories} disabled={categoriesLoading || busy} />{returnTo && <button type="button" disabled={busy} onClick={() => navigate(returnTo, { state: { categorySelection: returnSelection } })} className="perfume-button primary">Quay lại sản phẩm</button>}</>}>
    <div className="admin-management-grid admin-categories-grid">
      <div className="admin-form-column"><OperationsPanel title="Thêm danh mục" description="Tạo danh mục và loại sản phẩm đầu tiên.">
        <form onSubmit={saveCategory} className="admin-operation-form">
          <label className="perfume-field"><span>Tên danh mục <i>*</i></span><input type="text" value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Nước hoa unisex" maxLength={100} autoComplete="off" required disabled={busy} /></label>
          <label className="perfume-field"><span>Loại sản phẩm <i>*</i></span><input type="text" value={typeName} onChange={event => setTypeName(event.target.value)} placeholder="Ví dụ: Eau de Parfum" maxLength={100} autoComplete="off" required disabled={busy} /></label>
          <button type="submit" disabled={busy || categoriesLoading || Boolean(categoriesError)} className="perfume-button primary admin-form-submit"><Plus size={15} />{saving && !editingId ? "Đang thêm danh mục…" : "Thêm danh mục"}</button>
        </form>
        <p className="admin-form-help">Có thể thêm loại sản phẩm khác, đổi tên và quản lý danh mục ở danh sách bên cạnh.</p>
      </OperationsPanel><div className="admin-operation-tip"><Tags size={19} strokeWidth={1.5} /><div><strong>Danh mục rõ ràng, dễ tìm kiếm</strong><p>Dùng tên nhất quán để khách dễ chọn nước hoa và tìm thấy sản phẩm phù hợp.</p></div></div></div>
      <OperationsPanel className="admin-categories-list" title="Danh sách danh mục" description="Quản lý tên danh mục và các loại sản phẩm bên trong." actions={<Badge>{categoriesLoading ? "—" : categories.length} danh mục</Badge>}>
        <div className="admin-operation-toolbar"><label className="perfume-search"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm danh mục hoặc loại sản phẩm…" aria-label="Tìm danh mục hoặc loại sản phẩm" /></label>{query && <span role="status">{visibleCategories.length}/{categories.length} danh mục</span>}</div>
        <div aria-busy={categoriesLoading}>
          {categoriesLoading ? <p role="status" className="perfume-loading">Đang tải danh mục…</p> : categoriesError ? <div role="alert" className="perfume-alert">{categoriesError}<button type="button" onClick={fetchCategories}>Thử lại</button></div> : !categories.length ? <OperationsEmptyState icon={Tags} title="Chưa có danh mục nào" description="Thêm danh mục đầu tiên bằng biểu mẫu bên cạnh." /> : !visibleCategories.length ? <OperationsEmptyState icon={Search} title="Không tìm thấy danh mục phù hợp" description="Thử tên danh mục hoặc loại sản phẩm khác."><button type="button" className="perfume-button" onClick={() => setSearch("")}>Xóa nội dung tìm kiếm</button></OperationsEmptyState> : <ul className="admin-category-list">
            {visibleCategories.map(category => {
              const expanded = expandedId === category._id;
              const types = category.types || [];
              return <li key={category._id}>
                <div className={`admin-category-row${expanded ? " is-expanded" : ""}`}>
                  <button type="button" className="admin-category-toggle" aria-expanded={expanded} aria-controls={`category-types-${category._id}`} onClick={() => setExpandedId(expanded ? null : category._id)}><span className="admin-category-icon"><Tags size={17} strokeWidth={1.5} /></span><span><strong>{category.name}</strong><small>{types.length} loại sản phẩm</small></span><ChevronDown size={15} className={expanded ? "is-rotated" : ""} /></button>
                  <div className="perfume-toolbar-buttons"><button type="button" disabled={busy} className="perfume-icon-button" aria-label={`Chỉnh sửa danh mục ${category.name}`} onClick={() => { setEditingId(category._id); setEditName(category.name); setExpandedId(category._id); }}><Pencil size={14} /></button><button type="button" disabled={busy} className="perfume-icon-button admin-danger-action" aria-label={`Xóa danh mục ${category.name}`} onClick={() => requestDelete(category)}><Trash2 size={14} /></button></div>
                </div>
                <div id={`category-types-${category._id}`} hidden={!expanded} className="admin-category-expanded">
                  {editingId === category._id && <form onSubmit={event => saveCategory(event, category._id)} className="admin-category-rename admin-operation-form"><label className="perfume-field"><span>Tên danh mục</span><input type="text" aria-label="Tên danh mục đang sửa" value={editName} onChange={event => setEditName(event.target.value)} maxLength={100} required autoFocus disabled={busy} /></label><div className="perfume-toolbar-buttons"><button type="submit" disabled={busy} className="perfume-button primary"><Check size={14} />{saving ? "Đang lưu…" : "Lưu thay đổi"}</button><button type="button" disabled={busy} className="perfume-button" onClick={() => { setEditingId(null); setEditName(""); }}><X size={14} />Hủy</button></div></form>}
                  <CategoryTypes category={category} disabled={busy} onSave={saveType} onDelete={requestDelete} />
                </div>
              </li>;
            })}
          </ul>}
        </div>
      </OperationsPanel>
    </div>
    {deleteTarget && <DeleteCategoryDialog target={deleteTarget} busy={deleting} error={deleteError} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
  </CatalogPage>;
};

export default AddCategory;
