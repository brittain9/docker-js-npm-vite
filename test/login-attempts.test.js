import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserDashboard } from "../src/components/UserDashboard";
import userApi from "../src/api/userApi";

// Mock the userApi module
vi.mock("../src/api/userApi");

describe("Login Attempts Feature", () => {
  // Sample login attempt data
  const loginAttempts = [
    {
      username: "admin",
      timestamp: "2023-06-01T09:30:00Z",
      success: true,
    },
    {
      username: "user123",
      timestamp: "2023-06-01T10:15:00Z",
      success: false,
    },
    {
      username: "guest",
      timestamp: "2023-06-01T11:00:00Z",
      success: true,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup default API mocks
    userApi.searchUsers.mockResolvedValue({
      data: { users: [] },
    });

    userApi.getLoginAttempts.mockResolvedValue(loginAttempts);
  });

  it("displays login attempts with usernames, timestamps and status", async () => {
    render(<UserDashboard />);

    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Get the login attempts list
    const loginAttemptsSection = screen
      .getByText(/login attempts log/i)
      .closest("div");
    const listItems = within(loginAttemptsSection).getAllByRole("listitem");

    // Verify all login attempts are displayed
    expect(listItems.length).toBe(loginAttempts.length);

    // Check username is displayed
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
    expect(screen.getByText(/user123/i)).toBeInTheDocument();

    // Check status is displayed correctly (success/failure)
    expect(screen.getAllByText(/success/i).length).toBe(2);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();

    // Check timestamp is displayed in some readable format
    const date = new Date(loginAttempts[0].timestamp);
    const formattedDate = date.toLocaleString();
    expect(
      screen.getByText(new RegExp(formattedDate.split(" ")[0], "i"))
    ).toBeInTheDocument();
  });

  it("shows a message when no login attempts exist", async () => {
    // Override to return empty login attempts
    userApi.getLoginAttempts.mockResolvedValueOnce([]);

    render(<UserDashboard />);

    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Verify the empty state message is displayed
    expect(screen.getByText(/no login attempts recorded/i)).toBeInTheDocument();
  });

  it("handles errors when fetching login attempts", async () => {
    // Override to simulate an error
    userApi.getLoginAttempts.mockRejectedValueOnce(
      new Error("Failed to fetch login attempts")
    );

    render(<UserDashboard />);

    await waitFor(() => {
      expect(userApi.getLoginAttempts).toHaveBeenCalledTimes(1);
    });

    // Verify error message is displayed
    expect(
      screen.getByText(/error loading login attempts/i)
    ).toBeInTheDocument();
  });
});
