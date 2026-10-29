import { getCartAddedAt } from "../utils/cartOrder.js";
import User from "../models/User.js";
import { validateBirthday } from "../utils/membership.js";
import { issueBirthdayVoucher } from "../services/voucherService.js";
import { customerProfile, latestAdultBirthday } from "../utils/customerProfile.js";

// Get user profile [Get '/']
export const getUserProfile = async (req, res)=>{
    res.set("Cache-Control", "private, no-store");
    try {
        const role = req.user.role
        const cartData = req.user.cartData
        const cartAddedAt = getCartAddedAt(cartData, req.user.cartAddedAt)
        return res.json({success:true, role, cartData, cartAddedAt,
            profile: customerProfile(req.user)})
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message: "Không thể tải thông tin người dùng",
        })
    }
}

export const saveBirthday = async (req, res, next) => {
    try {
        const { birthday } = req.body;
        if (!validateBirthday(birthday)) return res.status(400).json({ success: false, message: "Ngày sinh không hợp lệ." });
        if (birthday > latestAdultBirthday()) return res.status(400).json({success:false,message:"Bạn phải đủ 18 tuổi."});
        if (customerProfile(req.user).needsCompletion) return res.status(409).json({success:false,message:"Vui lòng hoàn tất thông tin khách hàng tại trang chủ."});
        const user = await User.findOneAndUpdate({ _id: req.user._id,
            $or: [{ birthday: "" }, { birthday: null }, { birthday: { $exists: false } }],
        }, { birthday, birthdayMonthDay: birthday.slice(5) }, { new: true, runValidators: true });
        if (!user) return res.status(409).json({ success: false, message: "Ngày sinh đã được lưu. Vui lòng liên hệ cửa hàng nếu cần sửa." });
        await issueBirthdayVoucher(user);
        res.json({ success: true, birthday: user.birthday });
    } catch (error) { next(error); }
};
