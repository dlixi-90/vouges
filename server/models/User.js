import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    _id: {type:String, required: true},
    username: {type:String, required: true},
    email: {type:String, default: ""},
    phone: {type:String, default: ""},
    image: {type:String, default: ""},
    birthday: {type:String, default: ""},
    birthdayMonthDay: {type:String, default: "", index: true},
    // Existing accounts default to false; only new trusted identity inserts opt in.
    profileOnboardingRequired: {type:Boolean, default:false},
    customerProfile: {type: new mongoose.Schema({
        fullName: {type:String, required:true, maxlength:120},
        phone: {type:String, required:true},
        completedAt: {type:Date, required:true},
    }, {_id:false}), default:undefined},
    role: {type:String, enum: ["user", "owner"], default: "user"},
    adminAccess: {type: new mongoose.Schema({
        enabled: {type:Boolean, default:false},
        version: {type:Number, default:0, min:0, validate:Number.isSafeInteger},
        changedBy: {type:String},
        changedAt: {type:Date},
    }, {_id:false}), default:undefined},
    cartData: {type:Object, default:{}},
    cartAddedAt: {type:Object, default:{}},
    defaultAddressId: {type: mongoose.Schema.Types.ObjectId, ref: "Address", default: null},
}, {timestamps:true, minimize: false})

userSchema.index({ createdAt: -1, _id: -1 });

const User = mongoose.model("User", userSchema)

export default User
