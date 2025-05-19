import axios from "axios";

const API_BASE_URL = "https://api.example.com";
const TIMEOUT_MS = 5000;

// Configurable axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token refresh scenario
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem("refresh_token");
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        localStorage.setItem("auth_token", data.token);
        apiClient.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${data.token}`;
        originalRequest.headers["Authorization"] = `Bearer ${data.token}`;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout the user
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        return Promise.reject(refreshError);
      }
    }

    // Handle rate limiting with exponential backoff
    if (error.response?.status === 429 && originalRequest.retryCount < 3) {
      originalRequest.retryCount = originalRequest.retryCount
        ? originalRequest.retryCount + 1
        : 1;

      const delayMs = Math.pow(2, originalRequest.retryCount) * 1000;

      return new Promise((resolve) => {
        setTimeout(() => resolve(apiClient(originalRequest)), delayMs);
      });
    }

    return Promise.reject(error);
  }
);

// User API methods with complex behavior
export const userApi = {
  // Get user by ID with caching and cache invalidation
  cache: new Map(),
  cacheTimestamps: new Map(),
  cacheTTL: 300000, // 5 minutes in milliseconds

  async getUserById(userId, forceFresh = false) {
    // Check cache first unless forceFresh is true
    if (!forceFresh) {
      const cachedUser = this.cache.get(userId);
      const timestamp = this.cacheTimestamps.get(userId);

      if (cachedUser && timestamp && Date.now() - timestamp < this.cacheTTL) {
        return cachedUser;
      }
    }

    // Make the API call
    const response = await apiClient.get(`/users/${userId}`);

    // Update cache
    this.cache.set(userId, response.data);
    this.cacheTimestamps.set(userId, Date.now());

    return response.data;
  },

  // Search users with pagination and cancel tokens
  async searchUsers(query, page = 1, limit = 10, signal) {
    return apiClient.get("/users/search", {
      params: { query, page, limit },
      signal: signal, // For request cancellation
    });
  },

  // Create user with validation
  async createUser(userData) {
    // Validate required fields
    const requiredFields = ["username", "email", "password"];
    for (const field of requiredFields) {
      if (!userData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return apiClient.post("/users", userData);
  },

  // Update user with conditional merge
  async updateUser(userId, updates, mergeStrategy = "shallow") {
    if (!userId) throw new Error("User ID is required");
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error("No updates provided");
    }

    // Get current user data if using deep merge
    let payload = updates;

    if (mergeStrategy === "deep") {
      const currentUser = await this.getUserById(userId);
      payload = this._deepMerge(currentUser, updates);
    }

    const response = await apiClient.patch(`/users/${userId}`, payload);

    // Invalidate cache after update
    this.cache.delete(userId);

    return response.data;
  },

  // Helper method for deep merging
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] instanceof Object &&
        key in target &&
        target[key] instanceof Object
      ) {
        result[key] = this._deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  },

  // Delete user with confirmation
  async deleteUser(userId, confirmationCode) {
    if (!userId) throw new Error("User ID is required");
    if (!confirmationCode) throw new Error("Confirmation code is required");

    return apiClient.delete(`/users/${userId}`, {
      data: { confirmationCode },
    });
  },

  // Batch operations with dependency chains
  async batchUpdateUsers(updates) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("Updates must be a non-empty array");
    }

    // Process updates in sequence if they have dependencies
    const hasSequentialDependencies = updates.some((u) => u.dependsOn);

    if (hasSequentialDependencies) {
      const results = [];
      const completedIds = new Set();

      // Clone the updates array to avoid modifying the original
      const pendingUpdates = [...updates];

      // Keep processing until all updates are handled
      while (pendingUpdates.length > 0) {
        const updateIndex = pendingUpdates.findIndex(
          (update) =>
            !update.dependsOn ||
            update.dependsOn.every((id) => completedIds.has(id))
        );

        if (updateIndex === -1) {
          throw new Error("Circular dependency detected in batch updates");
        }

        const update = pendingUpdates.splice(updateIndex, 1)[0];
        const result = await this.updateUser(update.userId, update.data);
        completedIds.add(update.userId);
        results.push(result);
      }

      return results;
    } else {
      // Process updates in parallel if no dependencies
      return Promise.all(
        updates.map((update) => this.updateUser(update.userId, update.data))
      );
    }
  },

  // Clear all cache
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  },
};

export default userApi;
