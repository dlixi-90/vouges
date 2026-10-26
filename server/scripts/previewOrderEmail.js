import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildOrderConfirmationEmail } from "../emails/orderConfirmation.js";

// Sample data only. This command never creates an order or sends an email.
const order = {
  _id: "6aa03522b1cb60bcd7e92bd7",
  createdAt: "2026-09-09T03:30:00.000Z",
  paymentMethod: "COD",
  isPaid: false,
  amount: 450000,
  items: [
    {
      title: "Nước hoa mẫu 01", size: "30ml", quantity: 2, unitPrice: 150000,
      image: "https://res.cloudinary.com/dhsui22lz/image/upload/v1788148769/nyowmwzgpqiwetejxodc.png",
    },
    {
      title: "Nước hoa mẫu 02", size: "10ml", quantity: 1, unitPrice: 120000,
      image: "https://res.cloudinary.com/dhsui22lz/image/upload/v1788148767/e9ijqwlwq6tovdaez9xx.png",
    },
  ],
  address: {
    firstName: "Khách hàng", lastName: "mẫu", phone: "0900 000 000",
    street: "123 Đường Mẫu", city: "Phường Mẫu", state: "TP. Hồ Chí Minh",
    country: "Việt Nam", zipcode: "700000",
  },
};

const email = buildOrderConfirmationEmail(order);
const directory = new URL("../previews/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("order-confirmation.html", directory), email.html, "utf8");
console.log(`Email preview: ${fileURLToPath(new URL("order-confirmation.html", directory))}`);
