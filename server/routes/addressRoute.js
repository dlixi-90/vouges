import express from "express"
import { addAddress, getAddress, setDefaultAddress, deleteAddress, updateAddress } from "../controllers/addressController.js"
import authUser from "../middleware/authMiddleware.js"

const addressRouter = express.Router()

addressRouter.post('/add', authUser, addAddress)
addressRouter.get('/', authUser, getAddress)
addressRouter.patch('/:addressId/default', authUser, setDefaultAddress)
addressRouter.patch('/:addressId', authUser, updateAddress)
addressRouter.delete('/:addressId', authUser, deleteAddress)

export default addressRouter
