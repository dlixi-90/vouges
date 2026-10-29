import User from "../models/User.js";
import { customerIdentity } from "../services/customerIdentity.js";
import { mapClerkProfile } from "../utils/clerkProfile.js";
import { customerProfile } from "../utils/customerProfile.js";

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
      // A first sign-in may beat the webhook. Trust only Clerk's server response.
      const identity = await customerIdentity.read(userId);
      const mapped = mapClerkProfile({
        first_name:identity.firstName, last_name:identity.lastName, username:identity.username,
        image_url:identity.imageUrl, primary_email_address_id:identity.primaryEmailAddressId,
        primary_phone_number_id:identity.primaryPhoneNumberId,
        email_addresses:(identity.emailAddresses || []).map(entry=>({id:entry.id,email_address:entry.emailAddress,verification:entry.verification})),
        phone_numbers:(identity.phoneNumbers || []).map(entry=>({id:entry.id,phone_number:entry.phoneNumber,verification:entry.verification})),
      });
      user = await User.findOneAndUpdate({_id:userId}, {$setOnInsert:{...mapped,profileOnboardingRequired:true}},
        {upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});
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

export const requireCustomerProfile = (req, res, next) => {
  if (customerProfile(req.user).needsCompletion) return res.status(403).json({
    success:false, code:"CUSTOMER_PROFILE_REQUIRED", message:"Vui lòng về trang chủ và hoàn tất thông tin khách hàng trước khi đặt hàng.",
  });
  return next();
};
