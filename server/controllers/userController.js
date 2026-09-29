import { getCartAddedAt } from "../utils/cartOrder.js";

// Get user profile [Get '/']
export const getUserProfile = async (req, res)=>{
    try {
        const role = req.user.role
        const cartData = req.user.cartData
        const cartAddedAt = getCartAddedAt(cartData, req.user.cartAddedAt)
        return res.json({success:true, role, cartData, cartAddedAt})
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success:false,
            message: "Unable to load user profile",
        })
    }
}
