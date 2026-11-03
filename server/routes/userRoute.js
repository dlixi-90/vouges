import express from "express"
import authUser, {requireOwner,requireRootOwner} from "../middleware/authMiddleware.js"
import {listUsers,setUserRole,listAccessAudit,myAccess} from "../controllers/userAccessController.js"
import { getUserProfile, saveBirthday } from "../controllers/userController.js"
import {completeCustomerProfile,listCustomers,updateCustomer} from "../controllers/customerController.js"

const userRouter = express.Router()

userRouter.get('/', authUser, getUserProfile)
userRouter.get('/access', authUser, myAccess)
userRouter.patch('/profile', authUser, completeCustomerProfile)
userRouter.get('/manage', authUser, requireOwner, listUsers)
userRouter.patch('/manage/:id/role', authUser, requireOwner, requireRootOwner, setUserRole)
userRouter.get('/access-audit', authUser, requireOwner, requireRootOwner, listAccessAudit)
userRouter.get('/customers', authUser, requireOwner, listCustomers)
userRouter.patch('/customers/:id', authUser, requireOwner, updateCustomer)
userRouter.patch('/birthday', authUser, saveBirthday)

export default userRouter
