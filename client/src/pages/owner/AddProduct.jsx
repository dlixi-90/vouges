import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, ImagePlus, PackagePlus, Plus, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { useLocation, useParams } from "react-router-dom";
import {
  restoreProductDraft,
  getProductTypeSelection,
} from "../../utils/productDraft";
import { saveVariantEdit } from "../../utils/productVariantEdit";
import ProductVariantRow from "../../components/owner/ProductVariantRow";

const createEmptyImages = () => ({
  1: null,
  2: null,
  3: null,
  4: null,
});

const createEmptyInputs = () => ({
  title: "",
  description: "",
  ingredients: "",
  category: "",
  type: "",
  typeId: "",
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const AddProduct = () => {
  const { productId } = useParams();
  const { user } = useAppContext();
  return <ProductForm key={`${user?.id}:${productId || "new"}`} />;
};

const ProductForm = () => {
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
  } = useAppContext();

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
    () => restoredDraft?.inputs || createEmptyInputs(),
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

  const [loading, setLoading] = useState(false);
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
      ingredients: product.ingredients || "",
      category: product.category || "",
      type: product.type || "",
      typeId: "",
    });

    const variants = (product.sizes || []).map((size) => ({
      id: `existing:${size}`,
      originalSize: size,
      size,
      price: Number(product.price?.[size] ?? 0),
      quantity: Number(product.stockBySize?.[size] ?? 0),
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

  const addSizePrice = () => {
    const size = newSize.trim();
    const price = Number(newPrice);
    const quantity = Number(newQuantity);

    if (!size || newPrice === "" || newQuantity === "") {
      toast.error("Please enter size, price and quantity");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      toast.error("Quantity must be a non-negative integer");
      return;
    }

    const sizeAlreadyExists = sizePrices.some(
      (item) => item.size.trim().toLowerCase() === size.toLowerCase(),
    );

    if (sizeAlreadyExists) {
      toast.error("Size already exists");
      return;
    }

    setSizePrices((currentSizePrices) => [
      ...currentSizePrices,
      {
        id: crypto.randomUUID(),
        size,
        price,
        quantity,
      },
    ]);

    setNewSize("");
    setNewPrice("");
    setNewQuantity("");
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

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Each image must be smaller than 5 MB");
      return;
    }

    setImages((currentImages) => ({
      ...currentImages,
      [slot]: file,
    }));
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
    setImages(createEmptyImages());
    setImageInputVersion((version) => version + 1);
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (hasVariantEdits) {
      toast.error("Save or cancel the size edits before saving the product");
      return;
    }

    if (!inputs.title.trim() || !inputs.description.trim() || !selectedType) {
      toast.error("Please fill all required fields");
      return;
    }

    if (categoriesLoading || categoriesError) {
      toast.error("Please load product types before saving");
      return;
    }

    if (sizePrices.length === 0) {
      toast.error("Please add at least one size, price and quantity");
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
      toast.error("Every size must have a valid price and quantity");
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
        "Size names must be unique, at most 50 characters, without dots or a leading $.",
      );
      return;
    }

    const selectedImages = Object.values(images).filter(Boolean);

    const existingImages = selectedImages.filter(
      (image) => typeof image === "string",
    );

    const newImages = selectedImages.filter((image) => image instanceof File);

    if (selectedImages.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    setLoading(true);

    try {
      const prices = {};
      const stockBySize = {};
      const sizes = [];

      sizePrices.forEach(({ size, price, quantity }) => {
        const name = size.trim();
        prices[name] = Number(price);
        stockBySize[name] = Number(quantity);
        sizes.push(name);
      });

      const productData = {
        title: inputs.title.trim(),
        description: inputs.description.trim(),
        ingredients: inputs.ingredients.trim(),
        typeId: selectedType._id,
        price: prices,
        stockBySize,
        sizes,
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
        toast.success(
          data.message ||
            (isEditMode
              ? "Product updated successfully"
              : "Product added successfully"),
        );

        await fetchProducts();

        if (isEditMode) {
          navigate("/owner/list-product");
        } else {
          resetForm();
        }
      } else {
        toast.error(
          data.message ||
            (isEditMode ? "Unable to update product" : "Unable to add product"),
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          (isEditMode ? "Unable to update product" : "Unable to add product"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="m-1 h-[97vh] overflow-y-auto rounded-xl bg-primary px-3 py-6 shadow sm:m-3 sm:px-5 md:px-8 lg:w-11/12 xl:py-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#e1e6e3] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#6f9a79]">
              Products
            </p>

            <h1 className="text-2xl font-semibold tracking-tight text-[#263b4a] sm:text-3xl">
              {isEditMode ? "Edit Product" : "Add Product"}
            </h1>
          </div>
        </header>

        <form
          onSubmit={onSubmitHandler}
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <section className="rounded-2xl border border-[#e2e7e4] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#263b4a]">
                Product details
              </h2>
            </div>

            <div className="space-y-5">
              <Field label="Product name" required>
                <input
                  value={inputs.title}
                  onChange={(event) => updateInput("title", event.target.value)}
                  type="text"
                  placeholder="e.g. Nourishing Body Lotion"
                  className="admin-input"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label="Description" required>
                <textarea
                  value={inputs.description}
                  onChange={(event) =>
                    updateInput("description", event.target.value)
                  }
                  placeholder="Describe your product..."
                  rows={6}
                  className="admin-input min-h-36 resize-y"
                  required
                />
              </Field>

              <Field label="Ingredients">
                <textarea
                  value={inputs.ingredients}
                  onChange={(event) =>
                    updateInput("ingredients", event.target.value)
                  }
                  placeholder="e.g. Aqua, Glycerin, Aloe Barbadensis Leaf Juice..."
                  rows={4}
                  className="admin-input min-h-28 resize-y"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Product type" required>
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
                    className="admin-input"
                    required
                    disabled={
                      categoriesLoading || Boolean(categoriesError) || loading
                    }
                  >
                    <option value="">Select product type</option>
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
                    <span className="mt-1 block text-xs text-[#839099]">
                      Loading product types...
                    </span>
                  )}
                  {categoriesError && (
                    <span className="mt-1 block text-xs text-[#b55f5f]">
                      {categoriesError}{" "}
                      <button
                        type="button"
                        onClick={fetchCategories}
                        className="underline"
                      >
                        Retry
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={manageCategoryTypes}
                    disabled={loading}
                    className="mt-2 text-xs font-medium text-[#496852] underline disabled:opacity-50"
                  >
                    Add / manage product types
                  </button>
                </Field>
                <Field label="Category">
                  <input
                    type="text"
                    value={selectedCategory?.name || ""}
                    placeholder="Select a product type first"
                    readOnly
                    className="admin-input bg-[#f8faf8]"
                    aria-label="Category"
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-[#e2e7e4] bg-[#f8faf8] p-4 sm:p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-[#263b4a]">
                    Sizes, prices and inventory
                  </h3>
                </div>

                {/* Add variant form */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <input
                    value={newSize}
                    onChange={(event) => setNewSize(event.target.value)}
                    onKeyDown={handleSizePriceKeyDown}
                    type="text"
                    placeholder="Size, e.g. 50ml"
                    aria-label="Product size"
                    className="admin-input"
                  />

                  <input
                    value={newPrice}
                    onChange={(event) => setNewPrice(event.target.value)}
                    onKeyDown={handleSizePriceKeyDown}
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="Price, e.g. 5, 50"
                    aria-label="Price in thousands of VND"
                    className="admin-input"
                  />

                  <input
                    value={newQuantity}
                    onChange={(event) => setNewQuantity(event.target.value)}
                    onKeyDown={handleSizePriceKeyDown}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="Quantity"
                    aria-label="Stock quantity"
                    className="admin-input"
                  />

                  <button
                    type="button"
                    onClick={addSizePrice}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cfdad2] bg-white px-4 py-2.5 text-sm font-medium text-[#496852] transition hover:border-[#86a78d] hover:bg-[#f2f7f3]"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>

                {/* Added variants */}
                <div className="mt-4 space-y-2" aria-live="polite">
                  {sizePrices.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#d5ddd7] px-4 py-6 text-center">
                      <PackagePlus
                        size={20}
                        className="mx-auto text-[#8ca095]"
                      />

                      <p className="mt-2 text-sm font-medium text-[#76847c]">
                        No product variants added
                      </p>
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
                        onChange={(field, value) =>
                          setVariantEdits((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id], [field]: value },
                          }))
                        }
                        onSave={() => commitVariantEdit(item.id)}
                        onCancel={() => cancelVariantEdit(item.id)}
                        onRemove={() => removeSizePrice(item.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-[#e2e7e4] bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[#263b4a]">
                  Product images
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

            <section className="rounded-2xl border border-[#e2e7e4] bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[#263b4a]">
                  Publishing
                </h2>
              </div>

              <button
                type="submit"
                disabled={loading || hasVariantEdits}
                className="admin-primary-button w-full justify-center"
              >
                <PackagePlus size={17} />

                {loading
                  ? isEditMode
                    ? "Saving changes..."
                    : "Adding product..."
                  : isEditMode
                    ? "Save changes"
                    : "Add product"}
              </button>
              {hasVariantEdits && (
                <p role="status" className="mt-2 text-xs text-amber-700">
                  Save or cancel your size edits to continue.
                </p>
              )}
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => navigate("/owner/list-product")}
                  className="mt-3 w-full rounded-lg border border-[#dfe5e8] px-4 py-2.5 text-sm font-medium text-[#52616a] transition hover:bg-[#f7f9f8]"
                >
                  Cancel
                </button>
              )}
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
};

const Field = ({ label, hint, required = false, children }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#334957]">
        {label}

        {required && <span className="ml-1 text-[#b55f5f]">*</span>}
      </span>

      {children}

      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-[#8a969e]">
          {hint}
        </span>
      )}
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
    <div className="relative aspect-square">
      <label
        htmlFor={"productImage" + slot}
        className="group flex h-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#cfd9d2] bg-[#f8faf8] text-center transition hover:border-[#7fa087] hover:bg-[#f1f7f2]"
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
            alt={"Product preview " + slot}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex flex-col items-center px-3 text-[#71808a]">
            <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#5e8767] shadow-sm">
              <ImagePlus size={19} />
            </span>

            <span className="text-xs font-medium">Add image {slot}</span>
          </span>
        )}
      </label>

      {file && (
        <button
          type="button"
          onClick={() => onRemove(slot)}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#9c5555] shadow transition hover:bg-[#fff0f0]"
          aria-label={"Remove image " + slot}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};

export default AddProduct;
