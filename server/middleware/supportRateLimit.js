import Usage from "../models/SupportUsage.js";

export const supportRateLimit = async (req, res, next) => {
  try {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${req.user._id}:${minute}`;
    const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) } };
    let usage;
    try { usage = await Usage.findOneAndUpdate({ key }, update, { upsert: true, new: true }).lean(); }
    catch (error) {
      if (error.code !== 11000) throw error;
      usage = await Usage.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true }).lean();
    }
    if (usage.count > (req.user.role === "owner" ? 120 : 30)) {
      res.set("Retry-After", "60");
      return res.status(429).json({ success: false, message: "Bạn gửi tin quá nhanh. Vui lòng chờ một chút." });
    }
    next();
  } catch (error) { next(error); }
};
