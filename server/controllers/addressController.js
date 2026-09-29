import mongoose from "mongoose";
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

const normalizeAddress = (address) => {
  const invalid = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  const normalized = {};
  for (const field of addressFields) {
    let value = String(address?.[field] || "").trim();
    if (field === "phone") {
      const phone = validateDeliveryPhone(value);
      if (!phone.valid) invalid(phone.error);
      value = phone.normalized;
    }
    if (field === "email") value = value.toLowerCase();
    if (!value && field !== "zipcode") invalid(`${field} is required`);
    if (value.length > addressFieldLimits[field]) invalid(`${field} is too long`);
    normalized[field] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) invalid("Invalid email address");
  return normalized;
};

// Add Address [POST '/add']
export const addAddress = async (req, res) => {
  try {
    const { address } = req.body;
    const { userId } = req.auth();

    const normalizedAddress = normalizeAddress(address);

    // Checkout delivery records are not saved addresses unless the customer
    // explicitly clicked Save Address. Legacy records have no savedAt marker.
    const saveToAddressBook = req.body.saveToAddressBook === true;
    const existingAddress = saveToAddressBook
      ? await Address.findOne({ ...normalizedAddress, userId, savedAt: { $ne: null }, deletedAt: null })
      : null;
    const createdAddress = existingAddress || await Address.create({
      ...normalizedAddress,
      userId,
      savedAt: saveToAddressBook ? new Date() : null,
    });

    // A single pointer on the user makes concurrent default changes atomic.
    const defaultUser = saveToAddressBook ? await User.findOneAndUpdate(
      {
        _id: userId,
        ...(req.body.makeDefault === true ? {} : {
          $or: [{ defaultAddressId: null }, { defaultAddressId: createdAddress._id }],
        }),
      },
      { $set: { defaultAddressId: createdAddress._id } },
      { new: true },
    ) : null;

    return res.status(201).json({
      success: true,
      message: "Address created successfully",
      address: { ...createdAddress.toObject(), isDefault: Boolean(defaultUser) },
    });
  } catch (error) {
    if (!error.statusCode) console.log(error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to save address",
    });
  }
};

// Get Address [GET '/']
export const getAddress = async (req, res) => {
  try {
    const { userId } = req.auth();

    const addresses = await Address.find({
      userId,
      savedAt: { $ne: null },
      deletedAt: null,
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
    const address = await Address.findOne({ _id: addressId, userId, savedAt: { $ne: null }, deletedAt: null });
    if (!address) return res.status(404).json({ success: false, message: "Address not found" });
    await User.updateOne({ _id: userId }, { $set: { defaultAddressId: address._id } });
    return res.json({ success: true, message: "Default address updated", addressId });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: "Unable to update default address" });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { addressId } = req.params;
    if (!isObjectIdOrHexString(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address" });
    }
    // Keep the delivery record intact for orders that already reference it.
    const address = await Address.findOneAndUpdate(
      { _id: addressId, userId, savedAt: { $ne: null }, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );
    if (!address) return res.status(404).json({ success: false, message: "Saved address not found" });
    const nextDefault = await Address.findOne({
      userId, savedAt: { $ne: null }, deletedAt: null,
    }).sort({ createdAt: -1, _id: -1 });
    await User.updateOne(
      { _id: userId, defaultAddressId: address._id },
      { $set: { defaultAddressId: nextDefault?._id || null } },
    );
    return res.json({ success: true, message: "Address deleted", addressId });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: "Unable to delete address" });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { addressId } = req.params;
    if (!isObjectIdOrHexString(addressId)) {
      return res.status(400).json({ success: false, message: "Invalid address" });
    }
    const normalized = normalizeAddress(req.body.address);
    const result = await mongoose.connection.transaction(async (session) => {
      const current = await Address.findOne({
        _id: addressId, userId, savedAt: { $ne: null }, deletedAt: null,
      }).session(session);
      if (!current) {
        throw Object.assign(new Error("Saved address not found. Please reload your addresses."), { statusCode: 404 });
      }

      let saved = current;
      const changed = addressFields.some((field) => String(current[field] || "") !== normalized[field]);
      if (changed) {
        // Orders keep referencing the original immutable delivery record.
        // Publish its replacement and retire the old saved entry atomically.
        [saved] = await Address.create([{
          ...normalized,
          userId,
          savedAt: current.savedAt,
          createdAt: current.createdAt,
        }], { session });
        const retired = await Address.updateOne(
          { _id: current._id, userId, deletedAt: null, updatedAt: current.updatedAt },
          { $set: { deletedAt: new Date() } },
          { session },
        );
        if (retired.matchedCount !== 1) {
          throw Object.assign(new Error("Address changed. Please reload and try again."), { statusCode: 409 });
        }
      }
      const defaultUser = await User.findOneAndUpdate(
        {
          _id: userId,
          ...(req.body.makeDefault === true ? {} : { defaultAddressId: current._id }),
        },
        { $set: { defaultAddressId: saved._id } },
        { new: true, session },
      );
      return { ...saved.toObject(), isDefault: Boolean(defaultUser) };
    });
    return res.json({ success: true, message: "Address updated", address: result, replacedAddressId: addressId });
  } catch (error) {
    if (!error.statusCode) console.error(error.message);
    return res.status(error.statusCode || 500).json({
      success: false, message: error.statusCode ? error.message : "Unable to update address",
    });
  }
};
