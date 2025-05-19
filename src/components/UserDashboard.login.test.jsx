import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserDashboard } from "./UserDashboard";
import userApi from "../api/userApi";

// Mock the userApi module
vi.mock("../api/userApi", () => ({
  default: {
    searchUsers: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getLoginAttempts: vi.fn(),
  },
}));

describe("UserDashboard Login Attempts Feature", () => {
  // Mock login attempts data
  const mockLoginAttempts = [
    {
      username: "user1",
      timestamp: "2023-06-01T12:00:00Z",
      success: true,
    },
    {
      username: "user2",
      timestamp: "2023-06-01T12:30:00Z",
      success: false,
    },
    {
      username: "user1",
      timestamp: "2023-06-01T13:15:00Z",
      success: true,
    },
  ];

  // Mock users data
  const mockUsers = [
    { id: "1", username: "user1", email: "user1@example.com" },
    { id: "2", username: "user2", email: "user2@example.com" },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock API responses
    userApi.searchUsers.mockResolvedValue({
      data: {
        users: mockUsers,
      },
    });

    userApi.getLoginAttempts.mockResolvedValue(mockLoginAttempts);
  });

  it("fetches and displays login attempts on component mount", async () => {
    render(<UserDashboard />);

    // Should show loading state initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for login attempts to load
    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Verify login attempts section heading is displayed
    expect(screen.getByText(/login attempts log/i)).toBeInTheDocument();

    // Verify all login attempts are displayed
    await waitFor(() => {
      // Check for usernames in the login attempts
      expect(screen.getAllByText(/user1/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/user2/i).length).toBeGreaterThanOrEqual(1);

      // Check for success/failure status
      expect(screen.getAllByText(/success/i).length).toBe(2);
      expect(screen.getAllByText(/failed/i).length).toBe(1);
    });
  });

  it("formats timestamps correctly in the login attempts log", async () => {
    // Create a mock implementation that returns the timestamp formatted as expected
    const mockDate = new Date("2023-06-01T12:00:00Z");
    const formattedDate = mockDate.toLocaleString();

    // Override toLocaleString for testing consistency
    const originalToLocaleString = Date.prototype.toLocaleString;
    Date.prototype.toLocaleString = vi.fn(() => formattedDate);

    render(<UserDashboard />);

    // Wait for login attempts to load
    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Check for the formatted date
    await waitFor(() => {
      expect(
        screen.getAllByText(new RegExp(formattedDate, "i")).length
      ).toBeGreaterThanOrEqual(1);
    });

    // Restore original method
    Date.prototype.toLocaleString = originalToLocaleString;
  });

  it("displays a message when no login attempts are available", async () => {
    // Mock empty login attempts
    userApi.getLoginAttempts.mockResolvedValueOnce([]);

    render(<UserDashboard />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Check for the "no login attempts" message
    await waitFor(() => {
      expect(
        screen.getByText(/no login attempts recorded/i)
      ).toBeInTheDocument();
    });
  });

  it("handles API errors when fetching login attempts", async () => {
    // Mock API error
    const errorMessage = "Failed to fetch login attempts";
    userApi.getLoginAttempts.mockRejectedValueOnce(new Error(errorMessage));

    render(<UserDashboard />);

    // Wait for API call to fail
    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Check for error message
    await waitFor(() => {
      expect(
        screen.getByText(/error loading login attempts/i)
      ).toBeInTheDocument();
    });
  });
});
