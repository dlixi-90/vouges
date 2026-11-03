import User from "../models/User.js";
import { customerIdentity } from "../services/customerIdentity.js";
import { mapClerkProfile } from "../utils/clerkProfile.js";
import { customerProfile } from "../utils/customerProfile.js";
import { isRootAdmin, userAccess } from "../services/userAccess.js";

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

    // Environment roots remain protected; website grants survive subsequent requests.
    const newRole = userAccess(user).role;

    if (user.role !== newRole) {
      const version = user.adminAccess?.version || 0;
      const versionMatch = version === 0 ? {$or:[{"adminAccess.version":0},{"adminAccess.version":{$exists:false}}]} : {"adminAccess.version":version};
      // A cached role never overwrites a grant/revocation committed since our read.
      user = await User.findOneAndUpdate({_id:userId,email:user.email,role:user.role,...versionMatch},
        {$set:{role:newRole}}, {new:true}) || await User.findById(userId);
    }
    if (!user) return res.status(401).json({success:false,message:"Tài khoản không còn tồn tại."});

    // Recompute after a cache write: a concurrent revocation must not authorize
    // using the stale role value that was just read before that write.
    user.role = userAccess(user).role;
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

export const requireRootOwner = (req, res, next) => {
  if (!isRootAdmin(req.user)) return res.status(403).json({success:false,message:"Chỉ quản trị gốc được quản lý phân quyền."});
  return next();
};

export const requireCustomerProfile = (req, res, next) => {
  if (customerProfile(req.user).needsCompletion) return res.status(403).json({
    success:false, code:"CUSTOMER_PROFILE_REQUIRED", message:"Vui lòng về trang chủ và hoàn tất thông tin khách hàng trước khi đặt hàng.",
  });
  return next();
};
