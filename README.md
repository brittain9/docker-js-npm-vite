# User Management System

A React-based user management system with login attempts tracking feature.

## Getting Started

### Prerequisites

- Node.js (v16 or newer)
- npm or yarn
- Docker (optional, for containerized setup)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd UserManagement
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm start
   ```

4. Access the application at http://localhost:3000

## Running Tests

To run all tests, use the provided test script:

```bash
./run_tests.sh
```

To run specific tests for the login attempts feature:

```bash
./run_tests.sh login-attempts
```

## Docker Setup

### Building with Docker

1. Build the Docker image:

   ```bash
   docker build -t user-management .
   ```

2. Run the container:

   ```bash
   docker run -p 3000:80 user-management
   ```

3. Access the application at http://localhost:3000

### Running Tests with Docker

To run tests in a Docker container:

1. Build a test-specific Docker image:

   ```bash
   docker build -t user-management-test -f Dockerfile --target build .
   ```

2. Run tests inside Docker:

   ```bash
   docker run --rm user-management-test ./run_tests.sh
   ```

3. To run specific tests (e.g., login attempts tests):
   ```bash
   docker run --rm user-management-test ./run_tests.sh login-attempts
   ```

## Features

- User management (CRUD operations)
- Login attempts tracking
- User search functionality
