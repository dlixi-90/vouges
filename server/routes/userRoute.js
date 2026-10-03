import express from "express"
import authUser from "../middleware/authMiddleware.js"
import { getUserProfile, saveBirthday } from "../controllers/userController.js"

const userRouter = express.Router()

userRouter.get('/', authUser, getUserProfile)
userRouter.patch('/birthday', authUser, saveBirthday)

export default userRouter
