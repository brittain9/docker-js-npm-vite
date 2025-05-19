import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  },
}));

describe("UserDashboard Component", () => {
  const mockUsers = [
    { id: "1", username: "user1", email: "user1@example.com" },
    { id: "2", username: "user2", email: "user2@example.com" },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    userApi.searchUsers.mockResolvedValue({
      data: {
        users: mockUsers,
      },
    });
  });

  it("renders the user dashboard and loads users", async () => {
    render(<UserDashboard />);

    // Should show loading state initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for users to load
    await waitFor(() => {
      expect(userApi.searchUsers).toHaveBeenCalledTimes(1);
    });

    // Get the users list container
    const usersList = screen.getByRole("list");

    // Check if user1 and user2 are in the list
    await waitFor(() => {
      const listItems = within(usersList).getAllByRole("listitem");
      expect(listItems.length).toBe(2);
      expect(listItems[0]).toHaveTextContent("user1");
      expect(listItems[1]).toHaveTextContent("user2");
    });
  });

  it("calls searchUsers when typing in the search box", async () => {
    const user = userEvent.setup();
    render(<UserDashboard />);

    // Wait for initial data to load
    await waitFor(() => {
      const usersList = screen.getByRole("list");
      const listItems = within(usersList).getAllByRole("listitem");
      expect(listItems.length).toBe(2);
    });

    // Record the number of calls before searching
    const initialCallCount = userApi.searchUsers.mock.calls.length;

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.clear(searchInput);
    await user.type(searchInput, "user1");

    // Wait for search to be triggered (with debounce)
    await waitFor(
      () => {
        // Should have at least one more call after typing
        expect(userApi.searchUsers.mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      },
      { timeout: 1000 }
    );

    // Verify the search included our search term
    const searchCalls = userApi.searchUsers.mock.calls;
    const latestCallArgs = searchCalls[searchCalls.length - 1];
    expect(latestCallArgs[0]).toBe("user1");
  });
});
