import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    _id: {type:String, required: true},
    username: {type:String, required: true},
    email: {type:String, default: ""},
    phone: {type:String, default: ""},
    image: {type:String, default: ""},
    birthday: {type:String, default: ""},
    birthdayMonthDay: {type:String, default: "", index: true},
    role: {type:String, enum: ["user", "owner"], default: "user"},
    cartData: {type:Object, default:{}},
    cartAddedAt: {type:Object, default:{}},
    defaultAddressId: {type: mongoose.Schema.Types.ObjectId, ref: "Address", default: null},
}, {timestamps:true, minimize: false})

const User = mongoose.model("User", userSchema)

export default User
