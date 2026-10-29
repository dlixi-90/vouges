import User from "../models/User.js";
import Order from "../models/Order.js";
import { customerProfile, validateCustomerProfile } from "../utils/customerProfile.js";
import { placedOrderFilter } from "../utils/orderReporting.js";

const profileUpdate = value => ({
  customerProfile: {fullName:value.fullName,phone:value.phone,completedAt:new Date()},
  birthday:value.birthday, birthdayMonthDay:value.birthday.slice(5),
});
const invalidProfile = (res, errors) => res.status(400).json({
  success:false,message:"Vui lòng kiểm tra lại thông tin khách hàng.",errors,
});

export const completeCustomerProfile = async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  try {
    // Network retries and simultaneous tabs cannot change a completed profile.
    if (req.user.customerProfile?.completedAt) return res.json({success:true,profile:customerProfile(req.user)});
    if (!customerProfile(req.user).needsCompletion) return res.status(409).json({success:false,message:"Tài khoản không yêu cầu bổ sung thông tin."});
    const {errors,value} = validateCustomerProfile(req.body);
    if (Object.keys(errors).length) return invalidProfile(res,errors);
    let user = await User.findOneAndUpdate({
      _id:req.user._id,profileOnboardingRequired:true,"customerProfile.completedAt":null,
    }, {$set:profileUpdate(value)}, {new:true,runValidators:true});
    if (!user) {
      user = await User.findById(req.user._id);
      if (!user?.customerProfile?.completedAt) return res.status(409).json({success:false,message:"Thông tin tài khoản đã thay đổi. Vui lòng tải lại trang."});
    }
    return res.json({success:true,profile:customerProfile(user)});
  } catch (error) { next(error); }
};

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
export const listCustomers = async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const page = Number(req.query.page ?? 1), pageSize = Number(req.query.pageSize ?? 25);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || ![10,25,50].includes(pageSize) || q.length > 120 || (req.query.q != null && typeof req.query.q !== "string")) {
    return res.status(400).json({success:false,message:"Bộ lọc khách hàng không hợp lệ."});
  }
  const filter = {role:{$ne:"owner"}};
  if (q) {
    const literal = {$regex:escapeRegex(q),$options:"i"};
    filter.$or = ["customerProfile.fullName","username","email","phone","customerProfile.phone"].map(field=>({[field]:literal}));
    const digits = q.replace(/\D/g,"").replace(/^(84|0)/,"");
    if (digits && /^[+()\d\s-]+$/.test(q)) {
      const phone = {$regex:digits.split("").join("[\\s()-]*")};
      filter.$or.push({phone},{"customerProfile.phone":phone});
    }
  }
  try {
    const [users,total] = await Promise.all([
      User.find(filter).select("username email phone birthday customerProfile profileOnboardingRequired createdAt updatedAt")
        .sort({createdAt:-1,_id:-1}).skip((page-1)*pageSize).limit(pageSize).lean(),
      User.countDocuments(filter),
    ]);
    const totals = users.length ? await Order.aggregate([
      {$match:{userId:{$in:users.map(user=>user._id)},...placedOrderFilter()}},
      {$group:{_id:"$userId",orderCount:{$sum:1},paidTotal:{$sum:{$cond:["$isPaid","$amount",0]}}}},
    ]) : [];
    const byUser = new Map(totals.map(row=>[row._id,row]));
    return res.json({success:true,page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize)),customers:users.map(user=>({
      _id:user._id,...customerProfile(user),createdAt:user.createdAt,
      orderCount:byUser.get(user._id)?.orderCount || 0,paidTotal:byUser.get(user._id)?.paidTotal || 0,
    }))});
  } catch (error) { next(error); }
};

export const updateCustomer = async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  try {
    if (!/^[a-zA-Z0-9_-]{1,150}$/.test(req.params.id)) return res.status(400).json({success:false,message:"Mã khách hàng không hợp lệ."});
    const {errors,value} = validateCustomerProfile(req.body);
    if (Object.keys(errors).length) return invalidProfile(res,errors);
    const user = await User.findOneAndUpdate({_id:req.params.id,role:{$ne:"owner"}},{$set:profileUpdate(value)},{new:true,runValidators:true});
    if (!user) return res.status(404).json({success:false,message:"Không tìm thấy khách hàng."});
    return res.json({success:true,customer:{_id:user._id,...customerProfile(user)}});
  } catch (error) { next(error); }
};
