import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserDashboard } from "./UserDashboard";
import userApi from "../api/userApi";

// Mock the API
vi.mock("../api/userApi", () => ({
  default: {
    searchUsers: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getLoginAttempts: vi.fn(),
  },
}));

describe("Login Attempts Feature Specification", () => {
  /**
   * Test Data
   */
  const mockUsers = [
    { id: "1", username: "john_doe", email: "john@example.com" },
    { id: "2", username: "jane_smith", email: "jane@example.com" },
  ];

  const mockLoginAttempts = [
    {
      id: "1",
      username: "john_doe",
      timestamp: "2023-06-01T10:00:00Z",
      success: true,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    {
      id: "2",
      username: "jane_smith",
      timestamp: "2023-06-01T10:15:00Z",
      success: false,
      ipAddress: "192.168.1.2",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
    {
      id: "3",
      username: "john_doe",
      timestamp: "2023-06-01T11:00:00Z",
      success: true,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    {
      id: "4",
      username: "unknown_user",
      timestamp: "2023-06-01T11:30:00Z",
      success: false,
      ipAddress: "192.168.1.3",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1)",
    },
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

  /**
   * Test cases
   */

  // Test 1: Feature Existence
  it("should have a dedicated section for login attempts", async () => {
    render(<UserDashboard />);

    await waitFor(() => {
      const loginAttemptsSection = screen
        .getByText(/login attempts log/i)
        .closest("div");
      expect(loginAttemptsSection).toBeInTheDocument();
      expect(loginAttemptsSection).toHaveClass("login-attempts");
    });
  });

  // Test 2: API Integration
  it("should call the getLoginAttempts API on component mount", async () => {
    render(<UserDashboard />);

    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });
  });

  // Test 3: Data Display
  it("should display all login attempts with correct information", async () => {
    render(<UserDashboard />);

    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Should display the correct number of attempts
    const loginSection = screen.getByText(/login attempts log/i).closest("div");
    const listItems = loginSection.querySelectorAll("li");
    expect(listItems.length).toBe(mockLoginAttempts.length);

    // Check each login attempt displays the required information
    mockLoginAttempts.forEach((attempt) => {
      // Username check
      expect(
        screen.getByText(new RegExp(attempt.username, "i"))
      ).toBeInTheDocument();

      // Timestamp check - verify date is formatted
      const date = new Date(attempt.timestamp);
      const dateRegex = new RegExp(date.toLocaleString().split(" ")[0], "i");
      expect(screen.getByText(dateRegex)).toBeInTheDocument();

      // Status check
      const statusText = attempt.success ? "Success" : "Failed";
      expect(screen.getByText(new RegExp(statusText, "i"))).toBeInTheDocument();
    });
  });

  // Test 4: Empty State
  it("should display a message when no login attempts are available", async () => {
    // Override the mock to return empty array
    userApi.getLoginAttempts.mockResolvedValueOnce([]);

    render(<UserDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/no login attempts recorded/i)
      ).toBeInTheDocument();
    });
  });

  // Test 5: Error Handling
  it("should display an error message when API call fails", async () => {
    // Mock API error
    userApi.getLoginAttempts.mockRejectedValueOnce(
      new Error("Failed to fetch login attempts")
    );

    render(<UserDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/error loading login attempts/i)
      ).toBeInTheDocument();
    });
  });

  // Test 6: Loading State
  it("should show a loading indicator while fetching login attempts", async () => {
    // Create a promise that won't resolve immediately
    let resolvePromise;
    const loadingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    userApi.getLoginAttempts.mockImplementationOnce(() => loadingPromise);

    render(<UserDashboard />);

    // Check if loading state is shown
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Resolve the promise to complete loading
    resolvePromise(mockLoginAttempts);

    // Check if loading state is removed after data loads
    await waitFor(() => {
      expect(screen.queryByText(/loading\.\.\.$/i)).not.toBeInTheDocument();
    });
  });

  // Test 7: Date Formatting
  it("should format timestamps in a human-readable format", async () => {
    render(<UserDashboard />);

    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Test one specific timestamp format
    const testAttempt = mockLoginAttempts[0];
    const formattedDate = new Date(testAttempt.timestamp).toLocaleString();

    // Should display the formatted date (at least parts of it)
    // This is a simplified check - in a real implementation,
    // you might need a more robust test depending on locale settings
    expect(
      screen.getByText(new RegExp(formattedDate.split(" ")[0], "i"))
    ).toBeInTheDocument();
  });

  // Test 8: Failure/Success Display
  it("should visually differentiate between successful and failed login attempts", async () => {
    render(<UserDashboard />);

    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // This test assumes that successful and failed attempts have different styling or indicators
    // In the component implementation, you would add classes like "success" or "failed"

    // Get all list items
    const loginSection = screen.getByText(/login attempts log/i).closest("div");
    const listItems = loginSection.querySelectorAll("li");

    // Check if successful attempts have "success" text/class
    // and failed attempts have "failed" text/class
    mockLoginAttempts.forEach((attempt, index) => {
      const statusText = attempt.success ? "Success" : "Failed";
      expect(listItems[index].textContent).toContain(statusText);

      // If we have CSS classes for styling:
      // expect(listItems[index]).toHaveClass(attempt.success ? 'success' : 'failed');
    });
  });
});
