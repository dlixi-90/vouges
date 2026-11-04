import { createRoot } from "react-dom/client";
import "./fonts.css";
import "./index.css";
import App from "./App.jsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppContextProvider } from "./context/AppContext.jsx";
import { ClerkProvider } from "@clerk/react";
import { viVN } from "@clerk/localizations";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Thiếu khóa công khai của Clerk");
}

// Start the home route chunk alongside app startup only on the landing page.
// Other routes no longer download the home page and its below-fold modules.
if (window.location.pathname === "/") {
  void import("./pages/Home.jsx").catch(() => {});
}

const router = createBrowserRouter([{
  path: "*",
  element: <AppContextProvider><App /></AppContextProvider>,
}]);

createRoot(document.getElementById("root")).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} localization={viVN}>
    <RouterProvider router={router} />
  </ClerkProvider>,
);
