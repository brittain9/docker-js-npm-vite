import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Import MSW for development mode API mocking
import { startMockServiceWorker } from "./mocks/browser";

// Start the MSW worker in development mode
if (import.meta.env.DEV) {
  startMockServiceWorker();
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
