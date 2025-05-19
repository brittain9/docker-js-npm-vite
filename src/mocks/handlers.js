import { http, HttpResponse, delay } from "msw";

// Sample data
let users = [
  {
    id: "1",
    username: "johndoe",
    email: "john@example.com",
    role: "admin",
    lastLogin: "2023-05-15T10:30:45Z",
    profile: {
      firstName: "John",
      lastName: "Doe",
      avatar: "https://randomuser.me/api/portraits/men/1.jpg",
      address: {
        street: "123 Main St",
        city: "Anytown",
        zipCode: "12345",
        country: "USA",
      },
    },
    preferences: {
      theme: "light",
      notifications: true,
      language: "en",
    },
  },
  {
    id: "2",
    username: "janedoe",
    email: "jane@example.com",
    role: "user",
    lastLogin: "2023-05-18T14:22:11Z",
    profile: {
      firstName: "Jane",
      lastName: "Doe",
      avatar: "https://randomuser.me/api/portraits/women/2.jpg",
      address: {
        street: "456 Oak Ave",
        city: "Somewhere",
        zipCode: "67890",
        country: "USA",
      },
    },
    preferences: {
      theme: "dark",
      notifications: false,
      language: "en",
    },
  },
  {
    id: "3",
    username: "bobsmith",
    email: "bob@example.com",
    role: "user",
    lastLogin: "2023-05-10T08:15:30Z",
    profile: {
      firstName: "Bob",
      lastName: "Smith",
      avatar: "https://randomuser.me/api/portraits/men/3.jpg",
      address: {
        street: "789 Pine St",
        city: "Elsewhere",
        zipCode: "54321",
        country: "USA",
      },
    },
    preferences: {
      theme: "light",
      notifications: true,
      language: "fr",
    },
  },
];

// Track request attempts for rate limiting simulation
const requestAttempts = new Map();

// Utility to generate realistic network delays
const getRandomDelay = () => Math.floor(Math.random() * 300) + 100;

// Auth tokens
const tokens = {
  validToken: "mock-auth-token",
  refreshToken: "mock-refresh-token",
};

export const handlers = [
  // Login endpoint
  http.post("https://api.example.com/auth/login", async ({ request }) => {
    const { username, password } = await request.json();

    await delay(getRandomDelay());

    if (username === "admin" && password === "password") {
      return HttpResponse.json(
        {
          token: tokens.validToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: "1",
            username: "admin",
            email: "admin@example.com",
            role: "admin",
          },
        },
        { status: 200 }
      );
    }

    return HttpResponse.json(
      { message: "Invalid credentials" },
      { status: 401 }
    );
  }),

  // Token refresh endpoint
  http.post("https://api.example.com/auth/refresh", async ({ request }) => {
    const { refreshToken } = await request.json();

    await delay(getRandomDelay());

    if (refreshToken === tokens.refreshToken) {
      return HttpResponse.json(
        {
          token: `${tokens.validToken}-refreshed`,
          refreshToken: tokens.refreshToken,
        },
        { status: 200 }
      );
    }

    return HttpResponse.json(
      { message: "Invalid refresh token" },
      { status: 401 }
    );
  }),

  // Get user by ID - with simulated cache, rate limiting, and auth errors
  http.get(
    "https://api.example.com/users/:userId",
    async ({ request, params }) => {
      const { userId } = params;

      // Get current request attempt count for this endpoint
      const endpointKey = `GET:users/${userId}`;
      const attempts = requestAttempts.get(endpointKey) || 0;

      // Track this attempt
      requestAttempts.set(endpointKey, attempts + 1);

      // Extract auth token
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      await delay(getRandomDelay());

      // 1. Simulate unauthorized error (on 1st attempt)
      if (
        !token ||
        (token !== tokens.validToken && !token.includes("refreshed"))
      ) {
        return HttpResponse.json(
          { message: "Unauthorized access" },
          { status: 401 }
        );
      }

      // 2. Simulate rate limiting (on 2nd attempt)
      if (attempts === 1) {
        return HttpResponse.json(
          { message: "Too many requests, please try again later" },
          {
            status: 429,
            headers: {
              "Retry-After": "2",
            },
          }
        );
      }

      // 3. Find the user
      const user = users.find((u) => u.id === userId);

      // 4. Return 404 if user not found
      if (!user) {
        return HttpResponse.json(
          { message: "User not found" },
          { status: 404 }
        );
      }

      // 5. Occasionally return a different shape of data to test robustness
      // This is a subtle trap for tests - every 3rd successful request will have a different structure
      if ((attempts + 1) % 3 === 0) {
        const { profile, preferences, ...basicInfo } = user;
        return HttpResponse.json(
          {
            data: {
              user: {
                ...basicInfo,
                name: `${profile.firstName} ${profile.lastName}`,
                settings: preferences,
              },
            },
          },
          { status: 200 }
        );
      }

      // 6. Normal response
      return HttpResponse.json(user, { status: 200 });
    }
  ),

  // Search users with pagination
  http.get("https://api.example.com/users/search", async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    // Extract auth token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    await delay(getRandomDelay() * 2); // Search is slower

    // Check auth
    if (
      !token ||
      (token !== tokens.validToken && !token.includes("refreshed"))
    ) {
      return HttpResponse.json(
        { message: "Unauthorized access" },
        { status: 401 }
      );
    }

    // Filter users by search query
    let filteredUsers = users;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredUsers = users.filter(
        (user) =>
          user.username.toLowerCase().includes(lowerQuery) ||
          user.email.toLowerCase().includes(lowerQuery) ||
          user.profile.firstName.toLowerCase().includes(lowerQuery) ||
          user.profile.lastName.toLowerCase().includes(lowerQuery)
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return HttpResponse.json(
      {
        users: paginatedUsers,
        total: filteredUsers.length,
        page,
        limit,
        totalPages: Math.ceil(filteredUsers.length / limit),
      },
      { status: 200 }
    );
  }),

  // Create user
  http.post("https://api.example.com/users", async ({ request }) => {
    const userData = await request.json();

    // Extract auth token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    await delay(getRandomDelay());

    // Check auth
    if (
      !token ||
      (token !== tokens.validToken && !token.includes("refreshed"))
    ) {
      return HttpResponse.json(
        { message: "Unauthorized access" },
        { status: 401 }
      );
    }

    // Validate required fields
    const requiredFields = ["username", "email", "password"];
    for (const field of requiredFields) {
      if (!userData[field]) {
        return HttpResponse.json(
          { message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Check if username or email already exists
    if (users.some((u) => u.username === userData.username)) {
      return HttpResponse.json(
        { message: "Username already exists" },
        { status: 409 }
      );
    }

    if (users.some((u) => u.email === userData.email)) {
      return HttpResponse.json(
        { message: "Email already exists" },
        { status: 409 }
      );
    }

    // Create new user
    const newUser = {
      id: String(users.length + 1),
      username: userData.username,
      email: userData.email,
      role: userData.role || "user",
      lastLogin: new Date().toISOString(),
      profile: userData.profile || {
        firstName: "",
        lastName: "",
        avatar: `https://randomuser.me/api/portraits/${
          Math.random() > 0.5 ? "men" : "women"
        }/${users.length + 1}.jpg`,
        address: {
          street: "",
          city: "",
          zipCode: "",
          country: "",
        },
      },
      preferences: userData.preferences || {
        theme: "light",
        notifications: true,
        language: "en",
      },
    };

    users.push(newUser);

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = newUser;

    return HttpResponse.json(userWithoutPassword, { status: 201 });
  }),

  // Update user
  http.patch(
    "https://api.example.com/users/:userId",
    async ({ request, params }) => {
      const { userId } = params;
      const updates = await request.json();

      // Extract auth token
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      await delay(getRandomDelay());

      // Check auth
      if (
        !token ||
        (token !== tokens.validToken && !token.includes("refreshed"))
      ) {
        return HttpResponse.json(
          { message: "Unauthorized access" },
          { status: 401 }
        );
      }

      // Find user
      const userIndex = users.findIndex((u) => u.id === userId);

      if (userIndex === -1) {
        return HttpResponse.json(
          { message: "User not found" },
          { status: 404 }
        );
      }

      // Apply updates - simulating different merge strategies
      const currentUser = users[userIndex];
      let updatedUser;

      // Get merge strategy from header
      const mergeStrategy =
        request.headers.get("X-Merge-Strategy") || "shallow";

      if (mergeStrategy === "deep") {
        // Deep merge (recursive)
        const deepMerge = (target, source) => {
          const output = { ...target };

          for (const key in source) {
            if (
              source[key] instanceof Object &&
              key in target &&
              target[key] instanceof Object
            ) {
              output[key] = deepMerge(target[key], source[key]);
            } else {
              output[key] = source[key];
            }
          }

          return output;
        };

        updatedUser = deepMerge(currentUser, updates);
      } else {
        // Shallow merge (default)
        updatedUser = { ...currentUser, ...updates };
      }

      // Update user in the array
      users[userIndex] = updatedUser;

      return HttpResponse.json(updatedUser, { status: 200 });
    }
  ),

  // Delete user
  http.delete(
    "https://api.example.com/users/:userId",
    async ({ request, params }) => {
      const { userId } = params;
      const body = await request.json();
      const { confirmationCode } = body;

      // Extract auth token
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      await delay(getRandomDelay());

      // Check auth
      if (
        !token ||
        (token !== tokens.validToken && !token.includes("refreshed"))
      ) {
        return HttpResponse.json(
          { message: "Unauthorized access" },
          { status: 401 }
        );
      }

      // Validate confirmation code
      if (!confirmationCode || confirmationCode !== "DELETE") {
        return HttpResponse.json(
          { message: "Invalid confirmation code" },
          { status: 400 }
        );
      }

      // Find user
      const userIndex = users.findIndex((u) => u.id === userId);

      if (userIndex === -1) {
        return HttpResponse.json(
          { message: "User not found" },
          { status: 404 }
        );
      }

      // Remove user
      users.splice(userIndex, 1);

      return HttpResponse.json(
        { message: "User deleted successfully" },
        { status: 200 }
      );
    }
  ),

  // Batch update users
  http.post("https://api.example.com/users/batch", async ({ request }) => {
    const { updates } = await request.json();

    // Extract auth token
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    await delay(getRandomDelay() * 2); // Batch operations are slower

    // Check auth
    if (
      !token ||
      (token !== tokens.validToken && !token.includes("refreshed"))
    ) {
      return HttpResponse.json(
        { message: "Unauthorized access" },
        { status: 401 }
      );
    }

    // Validate updates
    if (!Array.isArray(updates) || updates.length === 0) {
      return HttpResponse.json(
        { message: "Updates must be a non-empty array" },
        { status: 400 }
      );
    }

    // Process updates
    const results = [];
    const hasSequentialDependencies = updates.some((u) => u.dependsOn);

    if (hasSequentialDependencies) {
      // Process sequentially with dependency checking
      const completedIds = new Set();
      const pendingUpdates = [...updates];

      while (pendingUpdates.length > 0) {
        const updateIndex = pendingUpdates.findIndex(
          (update) =>
            !update.dependsOn ||
            update.dependsOn.every((id) => completedIds.has(id))
        );

        if (updateIndex === -1) {
          return HttpResponse.json(
            { message: "Circular dependency detected in batch updates" },
            { status: 400 }
          );
        }

        const update = pendingUpdates.splice(updateIndex, 1)[0];
        const userIndex = users.findIndex((u) => u.id === update.userId);

        if (userIndex !== -1) {
          users[userIndex] = { ...users[userIndex], ...update.data };
          results.push(users[userIndex]);
          completedIds.add(update.userId);
        } else {
          results.push({ error: `User ${update.userId} not found` });
        }

        // Add a small delay between sequential updates
        await delay(100);
      }
    } else {
      // Process in parallel
      for (const update of updates) {
        const userIndex = users.findIndex((u) => u.id === update.userId);

        if (userIndex !== -1) {
          users[userIndex] = { ...users[userIndex], ...update.data };
          results.push(users[userIndex]);
        } else {
          results.push({ error: `User ${update.userId} not found` });
        }
      }
    }

    return HttpResponse.json({ results }, { status: 200 });
  }),
];

export default handlers;
