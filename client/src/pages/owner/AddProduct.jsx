import { lazy, Suspense, useEffect, useId, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, ImagePlus, Layers3, PackagePlus, Plus, RotateCcw, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { LoadingStatus } from "../../components/LoadingState";
import { CatalogPage, Badge, useCatalog } from "../../components/owner/CatalogUI";
import ArticleEditorShell from "../../components/owner/ArticleEditorShell";
import { LibraryTermSelect } from "../../components/owner/FragranceEditorFields";
import { BRAND_OPTIONS_PATH } from "../../utils/ownerPrefetch";
import { useLocation, useParams } from "react-router-dom";
import {
  restoreProductDraft,
  getProductTypeSelection,
} from "../../utils/productDraft";
import { saveVariantEdit } from "../../utils/productVariantEdit";
import ProductVariantRow from "../../components/owner/ProductVariantRow";
import ProductImageUpload from "../../components/owner/ProductImageUpload";
import { sanitizeArticle } from "../../utils/productArticle";
import { editableFragrance } from "../../utils/fragrance";
import NewProductFragrance from "../../components/owner/NewProductFragrance";

const ProductArticleEditor = lazy(() => import("../../components/owner/ProductArticleEditor"));

const createEmptyImages = () => ({
  1: null,
  2: null,
  3: null,
  4: null,
});

const createEmptyInputs = () => ({
  title: "",
  description: "",
  descriptionContent: null,
  ingredients: "",
  brand: "",
  origin: "",
  category: "",
  type: "",
  typeId: "",
  fragrance: editableFragrance({ group: "", style: "", notes: { top: [], middle: [], base: [] } }),
  notesText: { top: "", middle: "", base: "" },
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const AddProduct = () => {
  const { productId } = useParams();
  const { user } = useAppContext();
  return <ProductForm key={`${user?.id}:${productId || "new"}`} />;
};

const ProductForm = () => {
  const formId = useId();
  const { productId } = useParams();
  const { state: navigationState } = useLocation();

  const {
    axios,
    getToken,
    products,
    fetchProducts,
    navigate,
    categories,
    categoriesLoading,
    categoriesError,
    fetchCategories,
    user,
    productDrafts,
    saveProductDraft,
    clearProductDraft,
    storeResources,
  } = useAppContext();

  const brandLibrary = useCatalog(BRAND_OPTIONS_PATH);

  const isEditMode = Boolean(productId);
  const draftKey = `${user?.id}:${productId || "new"}`;
  const [restoredDraft] = useState(() =>
    restoreProductDraft(
      productDrafts[draftKey],
      categories,
      navigationState?.categorySelection,
    ),
  );

  const [images, setImages] = useState(
    () => restoredDraft?.images || createEmptyImages(),
  );
  const [inputs, setInputs] = useState(
    () => ({ ...createEmptyInputs(), ...restoredDraft?.inputs,
      fragrance: editableFragrance(restoredDraft?.inputs?.fragrance || {}),
    }),
  );
  const selection = getProductTypeSelection(categories, inputs);
  const selectedCategory = selection?.category;
  const selectedType = selection?.type;

  const [sizePrices, setSizePrices] = useState(
    () => restoredDraft?.sizePrices || [],
  );
  const [variantEdits, setVariantEdits] = useState(() => {
    const edits = restoredDraft?.variantEdits || {};
    const target = restoredDraft?.sizePrices?.find(
      (item) => item.originalSize === navigationState?.editSize,
    );
    return target && navigationState?.editSize
      ? { ...edits, [target.id]: edits[target.id] || { ...target } }
      : edits;
  });
  const hasVariantEdits = Object.keys(variantEdits).length > 0;
  const [newSize, setNewSize] = useState(() => restoredDraft?.newSize || "");
  const [newPrice, setNewPrice] = useState(() => restoredDraft?.newPrice || "");
  const [newQuantity, setNewQuantity] = useState(
    () => restoredDraft?.newQuantity || "",
  );
  const [newSizeImage, setNewSizeImage] = useState(() => restoredDraft?.newSizeImage || null);

  const [loading, setLoading] = useState(false);
  const [articleUploading, setArticleUploading] = useState(false);
  const [imageInputVersion, setImageInputVersion] = useState(0);

  const [loadedProductId, setLoadedProductId] = useState(
    () => restoredDraft?.loadedProductId || null,
  );
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState(
    () => restoredDraft?.loadedUpdatedAt || null,
  );

  useEffect(() => {
    if (isEditMode && loadedProductId !== productId) return;
    saveProductDraft(draftKey, {
      inputs,
      images,
      sizePrices,
      variantEdits,
      newSize,
      newPrice,
      newQuantity,
      newSizeImage,
      loadedProductId,
      loadedUpdatedAt,
      categoryId: selectedCategory?._id,
      typeId: selectedType?._id,
    });
  }, [
    categories,
    draftKey,
    images,
    inputs,
    isEditMode,
    loadedProductId,
    loadedUpdatedAt,
    newPrice,
    newQuantity,
    newSizeImage,
    newSize,
    productId,
    saveProductDraft,
    sizePrices,
    selectedCategory,
    selectedType,
    variantEdits,
  ]);

  const manageCategoryTypes = () => {
    navigate("/owner/add-category", {
      state: {
        returnTo: isEditMode
          ? `/owner/edit-product/${productId}`
          : "/owner/add-product",
        categoryId: selectedCategory?._id,
      },
    });
  };

  useEffect(() => {
    if (!isEditMode || loadedProductId === productId) {
      return;
    }

    const product = products.find((item) => item._id === productId);

    if (!product) {
      return;
    }

    // Seed the editable form once after the product arrives from context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputs({
      title: product.title || "",
      description: product.description || "",
      descriptionContent: product.descriptionContent ?? null,
      ingredients: product.ingredients || "",
      brand: product.brand || "",
      origin: product.origin || "",
      category: product.category || "",
      type: product.type || "",
      typeId: "",
      fragrance: editableFragrance(product.fragrance || {}),
      notesText: Object.fromEntries(["top", "middle", "base"].map(phase => [phase, (product.fragrance?.notes?.[phase] || []).map(note => note.name).join("\n")])),
    });

    const variants = (product.sizes || []).map((size) => ({
      id: `existing:${size}`,
      originalSize: size,
      size,
      price: Number(product.price?.[size] ?? 0),
      quantity: Number(product.stockBySize?.[size] ?? 0),
      image: product.sizeImages?.[size] || null,
    }));
    setSizePrices(variants);
    const target = variants.find(
      (item) => item.originalSize === navigationState?.editSize,
    );
    if (target) setVariantEdits({ [target.id]: { ...target } });

    const loadedImages = createEmptyImages();

    (product.images || []).slice(0, 4).forEach((imageUrl, index) => {
      loadedImages[index + 1] = imageUrl;
    });

    setImages(loadedImages);
    setLoadedProductId(productId);
    setLoadedUpdatedAt(product.updatedAt);
  }, [
    isEditMode,
    loadedProductId,
    productId,
    products,
    navigationState?.editSize,
  ]);

  const updateInput = (field, value) => {
    setInputs((currentInputs) => ({
      ...currentInputs,
      [field]: value,
    }));
  };

  const fragranceField = (field, value) => setInputs(current => ({ ...current,
    fragrance: { ...current.fragrance, [field]: value },
  }));
  const updateNotes = (phase, nextValue) =>
    setInputs((current) => {
      const existing = current.fragrance?.notes?.[phase] || [];
      const list = Array.isArray(nextValue)
        ? nextValue
            .map((item) =>
              typeof item === "string"
                ? existing.find((note) => note.name === item) || { name: item, url: null }
                : { name: String(item?.name || "").trim(), url: item?.url || null },
            )
            .filter((item) => item.name)
        : String(nextValue || "")
            .split("\n")
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name) => existing.find((note) => note.name === name) || { name, url: null });
      return {
        ...current,
        notesText: {
          ...current.notesText,
          [phase]: list.map((item) => item.name).join("\n"),
        },
        fragrance: {
          ...current.fragrance,
          notes: {
            ...current.fragrance.notes,
            [phase]: list,
          },
        },
      };
    });

  const addSizePrice = () => {
    const size = newSize.trim();
    const price = Number(newPrice);
    const quantity = Number(newQuantity);

    if (!size || newPrice === "" || newQuantity === "") {
      toast.error("Vui lòng nhập dung tích, giá và số lượng");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Giá phải lớn hơn 0");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      toast.error("Số lượng phải là số nguyên không âm");
      return;
    }

    const sizeAlreadyExists = sizePrices.some(
      (item) => item.size.trim().toLowerCase() === size.toLowerCase(),
    );

    if (sizeAlreadyExists) {
      toast.error("Dung tích này đã tồn tại");
      return;
    }

    setSizePrices((currentSizePrices) => [
      ...currentSizePrices,
      {
        id: crypto.randomUUID(),
        size,
        price,
        quantity,
        image: newSizeImage,
      },
    ]);

    setNewSize("");
    setNewPrice("");
    setNewQuantity("");
    setNewSizeImage(null);
  };

  const removeSizePrice = (id) => {
    cancelVariantEdit(id);
    setSizePrices((currentSizePrices) =>
      currentSizePrices.filter((item) => item.id !== id),
    );
  };

  const cancelVariantEdit = (id) => {
    setVariantEdits((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const commitVariantEdit = (id) => {
    try {
      setSizePrices(saveVariantEdit(sizePrices, id, variantEdits[id]));
      cancelVariantEdit(id);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSizePriceKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSizePrice();
    }
  };

  const handleImageChange = (slot, file) => {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Vui lòng chọn tệp hình ảnh");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Mỗi ảnh phải có dung lượng nhỏ hơn 5 MB");
      return;
    }

    setImages((currentImages) => ({
      ...currentImages,
      [slot]: file,
    }));
  };

  const changeSizeImage = (file, apply) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Vui lòng chọn ảnh PNG, JPEG hoặc WebP");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Mỗi ảnh phải có dung lượng nhỏ hơn 5 MB");
      return;
    }
    apply(file);
  };

  const removeImage = (slot) => {
    setImages((currentImages) => ({
      ...currentImages,
      [slot]: null,
    }));

    setImageInputVersion((version) => version + 1);
  };

  const resetForm = () => {
    clearProductDraft(draftKey);
    setInputs(createEmptyInputs());
    setSizePrices([]);
    setVariantEdits({});
    setNewSize("");
    setNewPrice("");
    setNewQuantity("");
    setNewSizeImage(null);
    setImages(createEmptyImages());
    setImageInputVersion((version) => version + 1);
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (articleUploading || loading) return;
    if (hasVariantEdits) {
      toast.error("Vui lòng lưu hoặc hủy thay đổi dung tích trước khi lưu sản phẩm");
      return;
    }

    if (!inputs.title.trim() || !selectedType) {
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }

    if (categoriesLoading || categoriesError) {
      toast.error("Vui lòng tải danh sách loại sản phẩm trước khi lưu");
      return;
    }

    if (sizePrices.length === 0) {
      toast.error("Vui lòng thêm ít nhất một dung tích kèm giá và số lượng");
      return;
    }

    const hasInvalidVariant = sizePrices.some(
      ({ size, price, quantity }) =>
        !size.trim() ||
        !Number.isFinite(Number(price)) ||
        Number(price) <= 0 ||
        !Number.isInteger(Number(quantity)) ||
        Number(quantity) < 0,
    );

    if (hasInvalidVariant) {
      toast.error("Mỗi dung tích phải có giá và số lượng hợp lệ");
      return;
    }

    const normalizedSizes = sizePrices.map(({ size }) => size.trim());
    if (
      normalizedSizes.some(
        (size) =>
          size.length > 50 ||
          size.includes(".") ||
          size.startsWith("$") ||
          ["__proto__", "constructor", "prototype"].includes(size),
      ) ||
      new Set(normalizedSizes.map((size) => size.toLowerCase())).size !==
        normalizedSizes.length
    ) {
      toast.error(
        "Tên dung tích không được trùng nhau, dài tối đa 50 ký tự, không chứa dấu chấm hoặc bắt đầu bằng dấu $.",
      );
      return;
    }

    const selectedImages = Object.values(images).filter(Boolean);

    const existingImages = selectedImages.filter(
      (image) => typeof image === "string",
    );

    const newImages = selectedImages.filter((image) => image instanceof File);

    if (selectedImages.length === 0) {
      toast.error("Vui lòng tải lên ít nhất một ảnh");
      return;
    }

    setLoading(true);

    try {
      const prices = {};
      const stockBySize = {};
      const sizes = [];
      const sizeImages = {};
      const newSizeImages = [];

      sizePrices.forEach(({ size, price, quantity, image }) => {
        const name = size.trim();
        prices[name] = Number(price);
        stockBySize[name] = Number(quantity);
        sizes.push(name);
        if (image instanceof File) {
          sizeImages[name] = newSizeImages.length;
          newSizeImages.push(image);
        } else {
          sizeImages[name] = image || null;
        }
      });

      const productData = {
        title: inputs.title.trim(),
        description: inputs.description.trim(),
        descriptionContent: sanitizeArticle(inputs.descriptionContent ?? null),
        ingredients: inputs.ingredients.trim(),
        brand: (inputs.brand || "").trim(),
        origin: (inputs.origin || "").trim(),
        fragrance: inputs.fragrance,
        typeId: selectedType._id,
        price: prices,
        stockBySize,
        sizes,
        sizeImages,
        ...(isEditMode && {
          existingImages,
          expectedUpdatedAt: loadedUpdatedAt,
          sizeRenames: sizePrices
            .filter(
              (item) =>
                item.originalSize && item.originalSize !== item.size.trim(),
            )
            .map((item) => ({ from: item.originalSize, to: item.size.trim() })),
        }),
      };

      const formData = new FormData();

      formData.append("productData", JSON.stringify(productData));

      newImages.forEach((image) => {
        formData.append("images", image);
      });
      newSizeImages.forEach((image) => formData.append("sizeImages", image));

      const token = await getToken();

      const requestConfig = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const { data } = isEditMode
        ? await axios.put(`/api/products/${productId}`, formData, requestConfig)
        : await axios.post("/api/products", formData, requestConfig);

      if (data.success) {
        clearProductDraft(draftKey);
        storeResources.invalidateCatalog();
        toast.success(
          data.message ||
            (isEditMode
              ? "Đã cập nhật sản phẩm thành công"
              : "Đã thêm sản phẩm thành công"),
        );

        await fetchProducts();

        if (isEditMode) {
          navigate("/owner/list-product");
        } else {
          if (data.productId) navigate(`/owner/edit-product/${data.productId}`);
          else resetForm();
        }
      } else {
        toast.error(
          data.message ||
            (isEditMode ? "Không thể cập nhật sản phẩm" : "Không thể thêm sản phẩm"),
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          (isEditMode ? "Không thể cập nhật sản phẩm" : "Không thể thêm sản phẩm"),
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedImageCount = Object.values(images).filter(Boolean).length;
  const submitLabel = loading
    ? isEditMode
      ? "Đang lưu thay đổi…"
      : "Đang thêm sản phẩm…"
    : isEditMode
      ? "Lưu thay đổi"
      : "Thêm sản phẩm";

  return (
    <CatalogPage
      title={isEditMode ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
      actions={
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => navigate("/owner/list-product")}
            className="perfume-button"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Danh sách sản phẩm
          </button>
          <button
            form={formId}
            type="submit"
            disabled={loading || articleUploading || hasVariantEdits}
            className="perfume-button primary"
          >
            <PackagePlus size={15} aria-hidden="true" />
            {submitLabel}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={onSubmitHandler}
        className="perfume-add-layout"
      >
        <div className="perfume-add-main">
          <section className="perfume-panel">
            <div className="perfume-section-heading">
              <div>
                <h2>Thông tin sản phẩm</h2>
                <p className="perfume-muted">
                  Nhập tên nước hoa, thương hiệu, xuất xứ và phân loại danh mục hiển thị trên cửa hàng.
                </p>
              </div>
              <button
                type="button"
                onClick={manageCategoryTypes}
                disabled={loading}
                className="perfume-button"
              >
                <Layers3 size={14} aria-hidden="true" />
                Thêm / quản lý loại sản phẩm
              </button>
            </div>

            <Field label="Tên sản phẩm" required>
              <input
                value={inputs.title}
                onChange={(event) => updateInput("title", event.target.value)}
                type="text"
                placeholder="Ví dụ: Dior Sauvage Eau de Parfum"
                autoComplete="off"
                required
              />
            </Field>

            <div className="perfume-form-grid">
              <LibraryTermSelect
                kind="brand"
                label="Thương hiệu"
                placeholder="Chọn thương hiệu"
                value={inputs.brand || ""}
                terms={brandLibrary.data?.terms || []}
                loading={brandLibrary.loading}
                disabled={loading}
                onChange={(value) => updateInput("brand", value)}
              />
              <Field label="Xuất xứ">
                <input
                  value={inputs.origin || ""}
                  onChange={(event) => updateInput("origin", event.target.value)}
                  maxLength={200}
                  placeholder="Ví dụ: Pháp"
                />
              </Field>
            </div>

            <div className="perfume-form-grid">
              <Field label="Loại sản phẩm" required>
                <select
                  value={selectedType?._id || ""}
                  onChange={(event) => {
                    const next = getProductTypeSelection(categories, {
                      typeId: event.target.value,
                    });
                    setInputs((current) => ({
                      ...current,
                      typeId: next?.type._id || "",
                      type: next?.type.name || "",
                      category: next?.category.name || "",
                    }));
                  }}
                  required
                  disabled={
                    categoriesLoading || Boolean(categoriesError) || loading
                  }
                >
                  <option value="">Chọn loại sản phẩm</option>
                  {categories
                    .filter((category) => category.types?.length)
                    .map((category) => (
                      <optgroup key={category._id} label={category.name}>
                        {category.types.map((type) => (
                          <option key={type._id} value={type._id}>
                            {type.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
                {categoriesLoading && (
                  <LoadingStatus label="Đang tải danh sách loại sản phẩm…" />
                )}
                {categoriesError && (
                  <small role="alert" className="perfume-field-error">
                    {categoriesError}{" "}
                    <button
                      type="button"
                      onClick={fetchCategories}
                      className="underline"
                    >
                      Thử lại
                    </button>
                  </small>
                )}
              </Field>
              <Field label="Danh mục">
                <input
                  type="text"
                  value={selectedCategory?.name || ""}
                  placeholder="Tự động điền khi chọn loại sản phẩm"
                  readOnly
                  aria-label="Danh mục"
                />
              </Field>
            </div>

            <Field label="Thành phần">
              <textarea
                value={inputs.ingredients}
                onChange={(event) =>
                  updateInput("ingredients", event.target.value)
                }
                placeholder="Thành phần ghi trên nhãn chai, nếu có…"
                rows={3}
              />
            </Field>
          </section>

          <section className="perfume-panel">
            <div className="perfume-section-heading">
              <div>
                <h2>Mô tả sản phẩm</h2>
                <p className="perfume-muted">
                  Biên soạn bài viết giới thiệu chi tiết, hình ảnh minh họa và định dạng văn bản cho sản phẩm.
                </p>
              </div>
            </div>
            <Suspense fallback={<ArticleEditorShell label="Đang tải trình soạn thảo…" />}>
              <ProductArticleEditor
                key={loadedProductId || "new-article"}
                value={inputs.descriptionContent}
                text={inputs.description}
                disabled={loading}
                onUploadingChange={setArticleUploading}
                onChange={(descriptionContent, description) =>
                  setInputs((current) => ({
                    ...current,
                    descriptionContent,
                    description,
                  }))
                }
              />
            </Suspense>
          </section>

          <section className="perfume-panel">
            <div className="perfume-section-heading">
              <div>
                <h2>Dung tích, giá và tồn kho</h2>
                <p className="perfume-muted">
                  Thêm các phân loại dung tích kèm giá bán (VND), số lượng tồn kho và ảnh riêng cho từng dung tích.
                </p>
              </div>
              <Badge tone={sizePrices.length > 0 ? "green" : "neutral"}>
                {sizePrices.length} phân loại
              </Badge>
            </div>

            <div className="perfume-add-variant-box">
              <div className="perfume-add-variant-row">
                <div className="perfume-add-variant-media">
                  <ProductImageUpload
                    file={newSizeImage}
                    label="Ảnh dung tích mới"
                    disabled={loading}
                    onChange={(file) => changeSizeImage(file, setNewSizeImage)}
                    onRemove={() => setNewSizeImage(null)}
                  />
                </div>
                <div className="perfume-add-variant-inputs">
                  <label className="perfume-field">
                    <span>Dung tích</span>
                    <input
                      value={newSize}
                      onChange={(event) => setNewSize(event.target.value)}
                      onKeyDown={handleSizePriceKeyDown}
                      type="text"
                      placeholder="Ví dụ: 50ml"
                      aria-label="Dung tích sản phẩm"
                    />
                  </label>

                  <label className="perfume-field">
                    <span>Giá bán (VND)</span>
                    <input
                      value={newPrice}
                      onChange={(event) => setNewPrice(event.target.value)}
                      onKeyDown={handleSizePriceKeyDown}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Ví dụ: 1250000"
                      aria-label="Giá tính bằng đồng Việt Nam"
                    />
                  </label>

                  <label className="perfume-field">
                    <span>Số lượng kho</span>
                    <input
                      value={newQuantity}
                      onChange={(event) => setNewQuantity(event.target.value)}
                      onKeyDown={handleSizePriceKeyDown}
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      placeholder="Ví dụ: 10"
                      aria-label="Số lượng tồn kho"
                    />
                  </label>

                  <div className="perfume-add-variant-action">
                    <button
                      type="button"
                      onClick={addSizePrice}
                      disabled={loading}
                      className="perfume-button primary"
                    >
                      <Plus size={15} />
                      Thêm dung tích
                    </button>
                  </div>
                </div>
              </div>
              <p className="perfume-muted">
                Có thể chọn ảnh riêng cho dung tích trước khi bấm <strong>Thêm dung tích</strong> (không bắt buộc).
              </p>
            </div>

            <div className="perfume-variant-list" aria-live="polite">
              {sizePrices.length === 0 ? (
                <div className="perfume-gallery-empty">
                  <PackagePlus size={26} strokeWidth={1.3} />
                  <p>Chưa thêm phân loại sản phẩm nào. Hãy nhập dung tích, giá và số lượng ở trên rồi bấm Thêm dung tích.</p>
                </div>
              ) : (
                sizePrices.map((item) => (
                  <ProductVariantRow
                    key={item.id}
                    item={item}
                    draft={variantEdits[item.id]}
                    loading={loading}
                    onEdit={() =>
                      setVariantEdits((current) => ({
                        ...current,
                        [item.id]: { ...item },
                      }))
                    }
                    onChange={(field, value) => {
                      const apply = (nextValue) =>
                        setVariantEdits((current) => ({
                          ...current,
                          [item.id]: { ...current[item.id], [field]: nextValue },
                        }));
                      if (field === "image" && value) changeSizeImage(value, apply);
                      else apply(value);
                    }}
                    onSave={() => commitVariantEdit(item.id)}
                    onCancel={() => cancelVariantEdit(item.id)}
                    onRemove={() => removeSizePrice(item.id)}
                  />
                ))
              )}
            </div>
          </section>

          <NewProductFragrance
            fragrance={inputs.fragrance}
            notesText={inputs.notesText}
            onChange={fragranceField}
            onNotes={updateNotes}
            disabled={loading || articleUploading}
          />
        </div>

        <aside className="perfume-add-sidebar">
          <section className="perfume-panel">
            <div className="perfume-section-heading">
              <div>
                <h2>Ảnh sản phẩm</h2>
                <p className="perfume-muted">
                  Bộ ảnh chung dùng trên thẻ sản phẩm. Ảnh theo dung tích được thêm riêng ở từng phân loại.
                </p>
              </div>
              <Badge tone={selectedImageCount > 0 ? "green" : "neutral"}>
                {selectedImageCount}/4 ảnh
              </Badge>
            </div>

            <div className="perfume-add-image-grid">
              {Object.keys(images).map((slot) => (
                <ImageUpload
                  key={slot + "-" + imageInputVersion}
                  slot={slot}
                  file={images[slot]}
                  onChange={handleImageChange}
                  onRemove={removeImage}
                />
              ))}
            </div>
          </section>

          <section className="perfume-panel perfume-publish-panel">
            <div className="perfume-section-heading">
              <div>
                <h2>Đăng sản phẩm</h2>
                <p className="perfume-muted">
                  Kiểm tra các thông tin bắt buộc trước khi lưu vào hệ thống catalog.
                </p>
              </div>
            </div>

            <ul className="perfume-publish-checklist">
              <li>
                <span>Loại & danh mục</span>
                <Badge tone={selectedType ? "green" : "amber"}>
                  {selectedType ? selectedCategory?.name : "Chưa chọn"}
                </Badge>
              </li>
              <li>
                <span>Phân loại dung tích</span>
                <Badge tone={sizePrices.length > 0 ? "green" : "amber"}>
                  {sizePrices.length > 0 ? `${sizePrices.length} dung tích` : "Cần thêm"}
                </Badge>
              </li>
              <li>
                <span>Bộ ảnh sản phẩm</span>
                <Badge tone={selectedImageCount > 0 ? "green" : "amber"}>
                  {selectedImageCount > 0 ? `${selectedImageCount} ảnh` : "Cần tải ảnh"}
                </Badge>
              </li>
            </ul>

            <button
              type="submit"
              disabled={loading || articleUploading || hasVariantEdits}
              className="perfume-button primary perfume-publish-submit"
            >
              <PackagePlus size={16} />
              {submitLabel}
            </button>

            {hasVariantEdits && (
              <p role="status" className="perfume-publish-warning">
                Vui lòng lưu hoặc hủy thay đổi dung tích đang chỉnh sửa để tiếp tục.
              </p>
            )}

            <div className="perfume-publish-secondary">
              {!isEditMode ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={resetForm}
                  className="perfume-button"
                >
                  <RotateCcw size={14} />
                  Làm mới biểu mẫu
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => navigate("/owner/list-product")}
                  className="perfume-button"
                >
                  Hủy
                </button>
              )}
            </div>
          </section>
        </aside>
      </form>
    </CatalogPage>
  );
};

const Field = ({ label, hint, required = false, children }) => {
  return (
    <label className="perfume-field">
      <span>
        {label}
        {required && <i> *</i>}
      </span>
      {children}
      {hint && <small className="perfume-muted">{hint}</small>}
    </label>
  );
};

const ImageUpload = ({ slot, file, onChange, onRemove }) => {
  const previewUrl = useMemo(() => {
    if (!file) return "";
    if (typeof file === "string") return file;

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!file || typeof file === "string") {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [file, previewUrl]);

  return (
    <div className="perfume-upload-tile">
      <label
        htmlFor={"productImage" + slot}
        className="perfume-upload-label"
      >
        <input
          id={"productImage" + slot}
          onChange={(event) => onChange(slot, event.target.files?.[0])}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
        />

        {previewUrl ? (
          <img
            src={previewUrl}
            alt={"Xem trước sản phẩm " + slot}
          />
        ) : (
          <span className="perfume-upload-placeholder">
            <span className="perfume-upload-icon">
              <ImagePlus size={18} strokeWidth={1.6} />
            </span>
            <span>Thêm ảnh {slot}</span>
          </span>
        )}
      </label>

      {file && (
        <button
          type="button"
          onClick={() => onRemove(slot)}
          className="perfume-upload-remove"
          aria-label={"Xóa ảnh " + slot}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default AddProduct;
