import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import { clerkMiddleware } from "@clerk/express";
import clerkWebhooks from "./controllers/ClerkWebhooks.js";
import userRouter from "./routes/userRoute.js";
import connectCloudinary from "./config/cloudinary.js";
import productRouter from "./routes/productRoute.js";
import categoryRouter from "./routes/categoryRoute.js";
import addressRouter from "./routes/addressRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import aiRouter from "./routes/aiRoute.js";
import multer from "multer";

await connectDB(); // Establish connection to the database
await connectCloudinary(); //Setup cloudinary for image storage

const app = express(); // Initialize Express Application
app.use(cors()); // Enable Cross-Origin Resource sharing

// Middleware Setup
app.use(
  "/api/clerk",
  express.raw({ type: "application/json" }),
  clerkWebhooks,
);
app.use(express.json()); //Enables JSON request body parsing
app.use(clerkMiddleware());

// Define API Routes
app.use("/api/users", userRouter); // Routes for User functionality
app.use("/api/products", productRouter); // Routes for handling products
app.use("/api/categories", categoryRouter);
app.use("/api/addresses", addressRouter); // Routes for handling addresses
app.use("/api/cart", cartRouter); // Routes for handling cart
app.use("/api/orders", orderRouter);
app.use("/api/ai", aiRouter); // Routes for handling order

// Route Endpoint to check API Status
app.get("/", (req, res) => {
  res.send("API Successfully connected");
});

app.use((error, _req, res, next) => {
  if (!(error instanceof multer.MulterError)) {
    return next(error);
  }

  const message =
    error.code === "LIMIT_FILE_SIZE"
      ? "Each image must be 5 MB or smaller"
      : "Only up to 4 JPEG, PNG or WebP images are allowed";

  return res.status(400).json({ success: false, message });
});

app.use((error, _req, res, _next) => {
  console.log(error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const port = process.env.PORT || 3000; // Define server port

// Start the server
app.listen(port, () =>
  console.log(`Server is running at http://localhost:${port}`),
);
