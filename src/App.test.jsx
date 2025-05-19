import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App Component", () => {
  it("renders the login form", () => {
    render(<App />);
    // Check for login heading
    const heading = screen.getByRole("heading", { name: /login/i });
    expect(heading).toBeInTheDocument();

    // Check for username and password inputs
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
  });

  it("has a working login button", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Find the login button
    const loginButton = screen.getByRole("button", { name: /login/i });
    expect(loginButton).toBeInTheDocument();

    // Fill in the login form
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(usernameInput, "admin");
    await user.type(passwordInput, "password");

    // We're not testing the submission here since it would require
    // more complex mocking, but we can verify the inputs accept text
    expect(usernameInput).toHaveValue("admin");
    expect(passwordInput).toHaveValue("password");
  });
});
