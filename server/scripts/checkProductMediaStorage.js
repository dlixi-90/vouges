import "dotenv/config";
import {v2 as cloudinary} from "cloudinary";
import connectCloudinary from "../config/cloudinary.js";
await connectCloudinary();
const usage=await cloudinary.api.usage();
console.log(JSON.stringify({plan:usage.plan,storage:usage.storage,credits:usage.credits,resources:usage.resources}));
