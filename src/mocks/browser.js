import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// This configures a Service Worker with the given request handlers
export const worker = setupWorker(...handlers);

// Initialize MSW
export function startMockServiceWorker() {
  worker.start({
    onUnhandledRequest: "bypass", // Don't log warnings for unhandled requests
  });
}

export default worker;
