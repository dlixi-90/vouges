import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

const secondaryButton =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#cfdad2] bg-white px-3 py-2 text-sm font-medium text-[#496852] transition hover:bg-[#f2f7f3] disabled:opacity-60";

const CategoryTypes = ({ category, disabled, onSave, onDelete }) => {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const types = category.types || [];

  const submit = async (event, typeId = null) => {
    event.preventDefault();
    if (await onSave(category, typeId ? editName : name, typeId)) {
      if (typeId) {
        setEditingId(null);
        setEditName("");
      } else {
        setName("");
      }
    }
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-[#334957]">
        Loại sản phẩm ({types.length})
      </h3>
      <ul className="mt-3 divide-y divide-[#e2e7e4] overflow-hidden rounded-lg border border-[#e2e7e4] bg-white empty:hidden">
        {types.map((type) => (
          <li key={type._id} className="px-3 py-2">
            {editingId === type._id ? (
              <form
                onSubmit={(event) => submit(event, type._id)}
                className="space-y-3"
              >
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-[#334957]">
                    Tên loại sản phẩm
                  </span>
                  <input
                    className="admin-input"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    maxLength={100}
                    required
                    autoFocus
                    disabled={disabled}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="admin-primary-button"
                    disabled={disabled}
                  >
                    <Check size={15} /> Lưu
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={disabled}
                    onClick={() => setEditingId(null)}
                  >
                    <X size={15} /> Hủy
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 break-words text-sm text-[#52616a]">
                  {type.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-[#496852] hover:bg-[#edf6ee] disabled:opacity-60"
                    disabled={disabled}
                    aria-label={`Chỉnh sửa loại sản phẩm ${type.name} trong danh mục ${category.name}`}
                    onClick={() => {
                      setEditingId(type._id);
                      setEditName(type.name);
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDelete(category, type)}
                    aria-label={`Xóa loại sản phẩm ${type.name} trong danh mục ${category.name}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {types.length === 0 && (
        <p className="mt-3 text-xs text-[#839099]">
          Chưa có loại sản phẩm nào. Hãy thêm loại đầu tiên bên dưới.
        </p>
      )}
      <form
        onSubmit={submit}
        className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-end"
      >
        <label className="block min-w-0 flex-1">
          <span className="mb-2 block text-xs font-medium text-[#334957]">
            Loại sản phẩm mới
          </span>
          <input
            className="admin-input"
            placeholder="Ví dụ: Sữa dưỡng thể"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
            disabled={disabled}
          />
        </label>
        <button
          type="submit"
          className="admin-primary-button shrink-0 justify-center"
          disabled={disabled}
        >
          <Plus size={15} /> Thêm loại sản phẩm
        </button>
      </form>
    </div>
  );
};

export default CategoryTypes;
