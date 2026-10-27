import { getPublicBrands } from "../services/publicBrands.js";

export const listBrands = async (_req, res) => {
  try {
    const brands = await getPublicBrands();
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.json({ success: true, brands });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Không thể tải danh sách thương hiệu" });
  }
};
