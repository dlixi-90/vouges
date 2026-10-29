import express from "express"
import authUser, {requireOwner} from "../middleware/authMiddleware.js"
import { getUserProfile, saveBirthday } from "../controllers/userController.js"
import {completeCustomerProfile,listCustomers,updateCustomer} from "../controllers/customerController.js"

const userRouter = express.Router()

userRouter.get('/', authUser, getUserProfile)
userRouter.patch('/profile', authUser, completeCustomerProfile)
userRouter.get('/customers', authUser, requireOwner, listCustomers)
userRouter.patch('/customers/:id', authUser, requireOwner, updateCustomer)
userRouter.patch('/birthday', authUser, saveBirthday)

export default userRouter
