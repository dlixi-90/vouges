import Address from "../models/Address.js";
import User from "../models/User.js";
import { isObjectIdOrHexString } from "mongoose";
import { validateDeliveryPhone } from "../utils/deliveryPhone.js";

const addressFields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "city",
  "state",
  "zipcode",
  "country",
];
const addressFieldLimits = {
  firstName: 80,
  lastName: 80,
  email: 254,
  phone: 30,
  street: 200,
  city: 100,
  state: 100,
  zipcode: 20,
  country: 100,
};

// Add Address [POST '/add']
export const addAddress = async (req, res) => {
  try {
    const { address } = req.body;
    const { userId } = req.auth();

    const normalizedAddress = {};

    for (const field of addressFields) {
      let value = String(address?.[field] || "").trim();

      if (field === "phone") {
        const phone = validateDeliveryPhone(value);
        if (!phone.valid) return res.status(400).json({ success: false, message: phone.error });
        value = phone.normalized;
      }
      if (field === "email") value = value.toLowerCase();

      if (!value && field !== "zipcode") {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }

      if (value.length > addressFieldLimits[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is too long`,
        });
      }

      normalizedAddress[field] = value;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAddress.email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    // Reuse the same address when checkout is retried or the customer saves it again.
    const existingAddress = await Address.findOne({ ...normalizedAddress, userId });
    const createdAddress = existingAddress || await Address.create({
      ...normalizedAddress,
      userId,
    });

    // A single pointer on the user makes concurrent default changes atomic.
    const defaultUser = await User.findOneAndUpdate(
      {
        _id: userId,
        ...(req.body.makeDefault === true ? {} : {
          $or: [{ defaultAddressId: null }, { defaultAddressId: createdAddress._id }],
        }),
      },
      { $set: { defaultAddressId: createdAddress._id } },
      { new: true },
    );

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      address: { ...createdAddress.toObject(), isDefault: Boolean(defaultUser) },
    });
  } catch (error) {
    console.log(error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save address",
    });
  }
};

// Get Address [GET '/']
export const getAddress = async (req, res) => {
  try {
    const { userId } = req.auth();

    const addresses = await Address.find({
      userId,
    }).sort({
      createdAt: -1,
      _id: -1,
    }).lean();

    const defaultAddressId = addresses.some((address) => String(address._id) === String(req.user.defaultAddressId))
      ? String(req.user.defaultAddressId)
      : String(addresses[0]?._id || "");

    return res.json({
      success: true,
      addresses: addresses.map((address) => ({ ...address, isDefault: String(address._id) === defaultAddressId })),
    });
  } catch (error) {
    console.log(error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load addresses",
    });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { addressId } = req.params;
    if (!isObjectIdOrHexString(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address" });
    }
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });
    await User.updateOne({ _id: userId }, { $set: { defaultAddressId: address._id } });
    return res.json({ success: true, message: "Default address updated", addressId });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: "Unable to update default address" });
  }
};
