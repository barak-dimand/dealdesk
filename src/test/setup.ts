import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "test-deal-id" }),
  usePathname: () => "/",
}));

// Mock Clerk auth
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { id: "test-user-id" } }),
  useAuth: () => ({ userId: "test-user-id" }),
}));

// jsdom lacks ResizeObserver — @tanstack/react-virtual needs it to exist
// (the stub never fires, so the virtualizer keeps its initialRect)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
