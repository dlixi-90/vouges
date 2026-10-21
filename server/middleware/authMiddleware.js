import User from "../models/User.js";

const getAdminEmails = () => {
  const configuredEmails =
    process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";

  return new Set(
    configuredEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
};

export const authUser = async (req, res, next) => {
  try {
    const { userId } = req.auth();
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để tiếp tục",
      });
    }

    let user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để tiếp tục",
      });
    }

    // Auto promote to owner if the email is in the configured admin list.
    // ADMIN_EMAIL is kept as a fallback for existing deployments.
    const adminEmails = getAdminEmails();
    const userEmail = user.email?.trim().toLowerCase();
    const newRole = userEmail && adminEmails.has(userEmail) ? "owner" : "user";

    if (user.role !== newRole) {
      // return the updated doc immediately
      user = await User.findByIdAndUpdate(
        userId,
        { role: newRole },
        { new: true },
      );
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Không thể xác thực người dùng",
    });
  }
};

export const requireOwner = (req, res, next) => {
  if (req.user?.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Chỉ quản trị viên mới có quyền truy cập",
    });
  }

  return next();
};

export default authUser;
