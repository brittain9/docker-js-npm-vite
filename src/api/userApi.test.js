import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import userApi from "./userApi";

// Mock axios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })),
    post: vi.fn(),
  },
}));

describe("userApi", () => {
  let mockAxiosInstance;

  beforeEach(() => {
    // Setup the mock axios instance
    mockAxiosInstance = axios.create();
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getLoginAttempts", () => {
    it("should fetch login attempts from the API", async () => {
      // Mock data
      const mockLoginAttempts = [
        { username: "user1", timestamp: "2023-06-01T12:00:00Z", success: true },
        {
          username: "user2",
          timestamp: "2023-06-01T12:30:00Z",
          success: false,
        },
      ];

      // Mock response
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { loginAttempts: mockLoginAttempts },
      });

      // Call the method
      const result = await userApi.getLoginAttempts();

      // Assertions
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/auth/login-attempts"
      );
      expect(result).toEqual(mockLoginAttempts);
      expect(result.length).toBe(2);
      expect(result[0].username).toBe("user1");
      expect(result[0].success).toBe(true);
      expect(result[1].username).toBe("user2");
      expect(result[1].success).toBe(false);
    });

    it("should handle API errors gracefully", async () => {
      // Mock error response
      const errorMessage = "Network Error";
      mockAxiosInstance.get.mockRejectedValueOnce(new Error(errorMessage));

      // Call the method and expect it to throw
      await expect(userApi.getLoginAttempts()).rejects.toThrow();
    });
  });
});
