import User from "../models/User.js"
import { Webhook } from "svix"
import { mapClerkProfile } from "../utils/clerkProfile.js"

const clerkWebhooks = async (req, res)=>{
    try {
        // Creating a Svix instance
        const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET)
        // Get headers
        const headers = {
            "svix-id": req.headers["svix-id"],
            "svix-timestamp": req.headers["svix-timestamp"],
            "svix-signature": req.headers["svix-signature"],
        }

        const payload = Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : JSON.stringify(req.body)

        // Verify the exact raw payload before trusting any event fields.
        const event = whook.verify(payload, headers)

        // Getting Data from request body
        const {data, type} = event

        // Switch Cases for diferent Events
        switch (type) {
            case "user.created":
            case "user.updated":{
                await User.findByIdAndUpdate(data.id, { $set: mapClerkProfile(data) }, {
                    upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true,
                })
                break;
            }
            case "user.deleted":{
                await User.findByIdAndDelete(data.id)
                break;
            }
        
            default:
                break;
        }

        return res.json({success:true, message: "Webhook Received"})

    } catch (error) {
        console.log(error.message)
        return res.status(400).json({
            success:false,
            message: "Invalid Clerk webhook",
        })
    }
}

export default clerkWebhooks
