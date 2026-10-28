import Order from "../models/Order.js";
import User from "../models/User.js";
import transporter from "../config/nodemailer.js";
import { buildOrderConfirmationEmail } from "../emails/orderConfirmation.js";

// Always call after the order/payment transaction commits. SMTP failure must
// never roll back a payment or make a successful checkout appear unsuccessful.
export const sendOrderConfirmation = async (orderOrId) => {
  try {
    const order = typeof orderOrId === "object" && orderOrId?.items
      ? orderOrId
      : await Order.findById(orderOrId).populate("items.product address");
    if (!order) return false;
    if (order.paymentMethod === "QR" && (!order.isPaid || !["Order Placed", "Packing", "Shipping", "Delivery"].includes(order.status))) return false;

    // The checkout contact can differ from the account email (including accounts
    // registered by phone). Send one copy to the contact supplied for this order.
    let recipient = order.address?.email?.trim();
    if (!recipient) {
      const user = await User.findById(order.userId);
      recipient = user?.email?.trim();
    }
    if (!recipient) return false;

    await transporter.sendMail({
      from: { name: "Velours", address: process.env.SMTP_SENDER_EMAIL },
      to: recipient,
      ...buildOrderConfirmationEmail(order),
    });
    return true;
  } catch (error) {
    console.error("Could not send order email:", error.message);
    return false;
  }
};
