import { describe, it, expect, vi, beforeEach } from "vitest";
import userApi from "../src/api/userApi";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("Login Attempts API", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock localStorage for authentication
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => "mock-token"),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  it("fetches login attempts from the correct endpoint", async () => {
    // Setup login attempts data
    const mockLoginAttempts = [
      { username: "user1", timestamp: "2023-06-01T09:00:00Z", success: true },
      { username: "user2", timestamp: "2023-06-01T09:30:00Z", success: false },
    ];

    // Setup mock axios instance
    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValueOnce({
        data: { loginAttempts: mockLoginAttempts },
      }),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    axios.create.mockReturnValueOnce(mockAxiosInstance);

    // Call the API method
    const result = await userApi.getLoginAttempts();

    // Verify it calls the correct endpoint
    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/auth/login-attempts");
    expect(result).toEqual(mockLoginAttempts);
  });

  it("handles errors when the login attempts endpoint fails", async () => {
    // Setup mock to simulate API error
    const mockAxiosInstance = {
      get: vi.fn().mockRejectedValueOnce(new Error("API Error")),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    axios.create.mockReturnValueOnce(mockAxiosInstance);

    // Call should throw an error
    await expect(userApi.getLoginAttempts()).rejects.toThrow();
  });

  it("returns an empty array when there are no login attempts", async () => {
    // Setup mock with empty login attempts
    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValueOnce({
        data: { loginAttempts: [] },
      }),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    axios.create.mockReturnValueOnce(mockAxiosInstance);

    // Call API
    const result = await userApi.getLoginAttempts();

    // Verify result is an empty array
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
