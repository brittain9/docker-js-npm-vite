import { useState } from "react";
import "./App.css";
import UserDashboard from "./components/UserDashboard";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    // Simple validation
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }

    // In a real app, you would call an API here
    // This is just a mock for demonstration
    if (username === "admin" && password === "password") {
      // Mock storing tokens
      localStorage.setItem("auth_token", "mock-auth-token");
      localStorage.setItem("refresh_token", "mock-refresh-token");
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Invalid username or password");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    setIsLoggedIn(false);
  };

  return (
    <div className="app">
      {isLoggedIn ? (
        <>
          <header className="app-header">
            <h1>User Management System</h1>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </header>
          <UserDashboard />
        </>
      ) : (
        <div className="login-container">
          <h1>Login</h1>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <button type="submit" className="login-button">
              Login
            </button>
          </form>
          <p className="login-hint">
            (Use username: admin, password: password)
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
