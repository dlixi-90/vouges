import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { categoryNamePattern, normalizeCategoryName } from "../services/categoryService.js";

const serializeCategory = (category) => ({
  _id: category._id,
  name: category.name,
  types: (category.types || []).map((type) => ({ _id: type._id, name: type.name })),
});

const sendError = (res, error) => {
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "Tên danh mục đã tồn tại" });
  }
  if (!error.statusCode) console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Không thể lưu danh mục",
  });
};

const readName = (req, label = "Tên danh mục", field = "name") => {
  const name = normalizeCategoryName(req.body?.[field]);
  if (!name || name.length > 100) {
    throw Object.assign(new Error(`${label} phải có từ 1 đến 100 ký tự`), {
      statusCode: 400,
    });
  }
  return name;
};

export const listCategories = async (_req, res) => {
  try {
    const categories = await Category.find({})
      .select("name types._id types.name")
      .sort({ createdAt: -1, _id: -1 });
    return res.json({ success: true, categories });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Không thể tải danh mục" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const name = readName(req);
    const typeName = readName(req, "Tên loại sản phẩm", "typeName");
    const category = await Category.create({
      name,
      nameKey: name.toLowerCase(),
      types: [{ name: typeName, nameKey: typeName.toLowerCase() }],
    });
    return res.status(201).json({
      success: true,
      message: "Đã thêm danh mục thành công",
      category: serializeCategory(category),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateCategory = async (req, res) => {
  try {
    const name = readName(req);
    const { categoryId } = req.params;
    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ success: false, message: "Mã danh mục không hợp lệ" });
    }

    // Keep the category and existing products consistent if either write fails.
    const category = await mongoose.connection.transaction(async (session) => {
      const current = await Category.findById(categoryId).session(session);
      if (!current) {
        throw Object.assign(new Error("Không tìm thấy danh mục"), { statusCode: 404 });
      }
      const oldName = current.name;
      current.name = name;
      current.nameKey = name.toLowerCase();
      await current.save({ session });
      if (oldName !== name) {
        await Product.updateMany(
          { category: categoryNamePattern(oldName) },
          { $set: { category: name } },
          { session },
        );
      }
      return serializeCategory(current);
    });

    return res.json({ success: true, message: "Đã cập nhật danh mục thành công", category });
  } catch (error) {
    return sendError(res, error);
  }
};

const saveCategoryType = async (req, res, isEditing) => {
  try {
    const name = readName(req, "Tên loại sản phẩm");
    const { categoryId, typeId } = req.params;
    if (!mongoose.isValidObjectId(categoryId) ||
      (isEditing && !mongoose.isValidObjectId(typeId))) {
      return res.status(400).json({ success: false, message: "Mã danh mục hoặc mã loại sản phẩm không hợp lệ" });
    }
    const category = await mongoose.connection.transaction(async (session) => {
      const current = await Category.findById(categoryId).session(session);
      if (!current) {
        throw Object.assign(new Error("Không tìm thấy danh mục"), { statusCode: 404 });
      }
      const type = isEditing ? current.types.id(typeId) : null;
      if (isEditing && !type) {
        throw Object.assign(new Error("Không tìm thấy loại sản phẩm trong danh mục này"), { statusCode: 404 });
      }
      const nameKey = name.toLowerCase();
      if (current.types.some((item) => item.nameKey === nameKey &&
        String(item._id) !== typeId)) {
        throw Object.assign(new Error("Tên loại sản phẩm đã tồn tại trong danh mục này"), { statusCode: 409 });
      }
      const oldName = type?.name;
      if (type) {
        type.name = name;
        type.nameKey = nameKey;
      } else {
        current.types.push({ name, nameKey });
      }
      await current.save({ session });
      if (isEditing && oldName !== name) {
        await Product.updateMany(
          { category: categoryNamePattern(current.name), type: categoryNamePattern(oldName) },
          { $set: { type: name } },
          { session },
        );
      }
      return serializeCategory(current);
    });
    return res.status(isEditing ? 200 : 201).json({
      success: true,
      message: isEditing ? "Đã cập nhật loại sản phẩm thành công" : "Đã thêm loại sản phẩm thành công",
      category,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createCategoryType = (req, res) => saveCategoryType(req, res, false);
export const updateCategoryType = (req, res) => saveCategoryType(req, res, true);

const removeCategoryEntry = async (req, res, isType) => {
  try {
    const { categoryId, typeId } = req.params;
    if (!mongoose.isValidObjectId(categoryId) ||
      (isType && !mongoose.isValidObjectId(typeId))) {
      return res.status(400).json({ success: false, message: "Mã danh mục hoặc mã loại sản phẩm không hợp lệ" });
    }
    const category = await mongoose.connection.transaction(async (session) => {
      const current = await Category.findById(categoryId).session(session);
      if (!current) {
        throw Object.assign(new Error("Không tìm thấy danh mục"), { statusCode: 404 });
      }
      const type = isType ? current.types.id(typeId) : null;
      if (isType && !type) {
        throw Object.assign(new Error("Không tìm thấy loại sản phẩm trong danh mục này"), { statusCode: 404 });
      }
      const used = await Product.exists({
        isDeleted: { $ne: true },
        category: categoryNamePattern(current.name),
        ...(isType && { type: categoryNamePattern(type.name) }),
      }).session(session);
      if (used) {
        throw Object.assign(new Error(
          isType
            ? "Có sản phẩm đang sử dụng loại này. Hãy đổi loại của các sản phẩm đó trong Danh sách sản phẩm trước khi xóa."
            : "Có sản phẩm thuộc danh mục này. Hãy chuyển các sản phẩm đó sang danh mục khác trong Danh sách sản phẩm trước khi xóa.",
        ), { statusCode: 409 });
      }
      if (isType) {
        type.deleteOne();
        await current.save({ session });
        return serializeCategory(current);
      }
      await current.deleteOne({ session });
      return null;
    });
    return res.json({
      success: true,
      message: isType ? "Đã xóa loại sản phẩm thành công" : "Đã xóa danh mục thành công",
      ...(isType ? { category } : { categoryId: req.params.categoryId }),
    });
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Không thể xóa danh mục hoặc loại sản phẩm",
    });
  }
};

export const deleteCategory = (req, res) => removeCategoryEntry(req, res, false);
export const deleteCategoryType = (req, res) => removeCategoryEntry(req, res, true);
