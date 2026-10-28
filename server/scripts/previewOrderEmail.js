import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildOrderConfirmationEmail } from "../emails/orderConfirmation.js";

// Sample data only. This command never creates an order or sends an email.
const order = {
  _id: "6aa03522b1cb60bcd7e92bd7",
  createdAt: "2026-10-28T03:30:00.000Z",
  paymentMethod: "COD",
  isPaid: false,
  subtotal: 620000,
  shipping: 30000,
  shippingMethod: "standard",
  amount: 650000,
  items: [
    {
      title: "Mercedes Benz Select Night EDP For Men", size: "10ml", quantity: 2, unitPrice: 310000,
      image: "https://res.cloudinary.com/dhsui22lz/image/upload/v1793042446/velours/catalog-media-v1/e6b3bd03e1c59b9f05c7a1fa-cutout-0c9833db8bf8.webp",
    },
  ],
  address: {
    firstName: "Khách hàng", lastName: "mẫu", phone: "0900 000 000",
    street: "123 Đường Mẫu", city: "Phường Mẫu", state: "TP. Hồ Chí Minh",
    country: "Việt Nam", zipcode: "700000",
  },
};

const directory = new URL("../previews/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const [filename, patch] of [
  ["order-confirmation.html", {}],
  ["order-qr-paid.html", { paymentMethod: "QR", status: "Order Placed", isPaid: true }],
]) {
  const email = buildOrderConfirmationEmail({ ...order, ...patch });
  // Preview the same attachment used by SMTP without sending any message.
  const html = email.html.replaceAll("cid:velours-mark@velours", "../emails/assets/velours-mark.png").replace(/[\t ]+$/gm, "");
  await writeFile(new URL(filename, directory), html, "utf8");
  console.log(`Email preview: ${fileURLToPath(new URL(filename, directory))}`);
}
