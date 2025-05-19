import { useState, useEffect, useRef, useCallback } from "react";
import userApi from "../api/userApi";

export const UserDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [mergeStrategy, setMergeStrategy] = useState("shallow");

  // Refs for cleanup and optimization
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Load users with debounce and cancellation
  const loadUsers = useCallback(
    async (resetPage = false) => {
      try {
        // Clear previous search request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        setLoading(true);
        setError(null);

        const currentPage = resetPage ? 1 : page;
        if (resetPage) setPage(1);

        const response = await userApi.searchUsers(
          search,
          currentPage,
          10,
          abortControllerRef.current.signal
        );

        if (!isMountedRef.current) return;

        if (resetPage) {
          setUsers(response.data.users);
        } else {
          setUsers((prev) => [...prev, ...response.data.users]);
        }

        setHasMore(response.data.users.length === 10);
      } catch (err) {
        if (err.name === "AbortError") {
          // Request was cancelled, no need to handle
          return;
        }

        if (isMountedRef.current) {
          setError(err.message || "Error loading users");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [search, page]
  );

  // Handle search with debounce
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      loadUsers(true);
    }, 500);
  };

  // Load more users
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  // Select user for viewing details
  const handleSelectUser = async (userId) => {
    try {
      setLoading(true);
      setError(null);

      // Get fresh user data
      const userData = await userApi.getUserById(userId, true);

      if (isMountedRef.current) {
        setSelectedUser(userData);
        setEditForm(userData);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || "Error loading user details");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Update user with different merge strategies
  const handleUpdateUser = async () => {
    if (!selectedUser?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Compare form with original user to get only changed fields
      const updates = {};
      for (const key in editForm) {
        if (editForm[key] !== selectedUser[key]) {
          updates[key] = editForm[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        setError("No changes detected");
        setLoading(false);
        return;
      }

      // Update user with selected merge strategy
      const updatedUser = await userApi.updateUser(
        selectedUser.id,
        updates,
        mergeStrategy
      );

      if (isMountedRef.current) {
        setSelectedUser(updatedUser);
        setEditForm(updatedUser);
        setIsEditing(false);

        // Update user in list
        setUsers((prev) =>
          prev.map((user) => (user.id === updatedUser.id ? updatedUser : user))
        );
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || "Error updating user");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Delete user with confirmation
  const handleDeleteUser = async () => {
    if (!selectedUser?.id) return;

    const confirmationCode = prompt("Enter confirmation code to delete user:");
    if (!confirmationCode) return;

    try {
      setLoading(true);
      setError(null);

      await userApi.deleteUser(selectedUser.id, confirmationCode);

      if (isMountedRef.current) {
        // Remove user from list
        setUsers((prev) => prev.filter((user) => user.id !== selectedUser.id));
        setSelectedUser(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || "Error deleting user");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    loadUsers();

    // Cleanup effect
    return () => {
      isMountedRef.current = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [loadUsers]);

  // Load more when page changes
  useEffect(() => {
    if (page > 1) {
      loadUsers();
    }
  }, [page, loadUsers]);

  return (
    <div className="user-dashboard">
      <h1>User Dashboard</h1>

      {/* Search and filters */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {/* Error message */}
      {error && <div className="error-message">{error}</div>}

      {/* Users list */}
      <div className="users-list">
        {users.length === 0 && !loading ? (
          <p>No users found</p>
        ) : (
          <ul>
            {users.map((user) => (
              <li
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                className={selectedUser?.id === user.id ? "selected" : ""}
              >
                {user.username} ({user.email})
              </li>
            ))}
          </ul>
        )}

        {loading && <p>Loading...</p>}

        {!loading && hasMore && (
          <button onClick={handleLoadMore}>Load More</button>
        )}
      </div>

      {/* User details */}
      {selectedUser && (
        <div className="user-details">
          <h2>User Details</h2>

          {isEditing ? (
            <div className="edit-form">
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  name="username"
                  value={editForm.username || ""}
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email || ""}
                  onChange={handleFormChange}
                />
              </div>

              {/* More form fields would go here */}

              <div className="form-group">
                <label>Merge Strategy:</label>
                <select
                  value={mergeStrategy}
                  onChange={(e) => setMergeStrategy(e.target.value)}
                >
                  <option value="shallow">Shallow</option>
                  <option value="deep">Deep</option>
                </select>
              </div>

              <div className="form-actions">
                <button onClick={handleUpdateUser}>Save Changes</button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm(selectedUser);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="user-info">
              <p>
                <strong>ID:</strong> {selectedUser.id}
              </p>
              <p>
                <strong>Username:</strong> {selectedUser.username}
              </p>
              <p>
                <strong>Email:</strong> {selectedUser.email}
              </p>
              {/* More user fields would go here */}

              <div className="user-actions">
                <button onClick={() => setIsEditing(true)}>Edit</button>
                <button onClick={handleDeleteUser}>Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
