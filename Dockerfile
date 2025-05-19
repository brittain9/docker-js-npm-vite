FROM node:22.14.0-alpine3.21@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Set environment variables for testing
ENV CI=true
ENV NODE_ENV=test

# Run tests by default when the container starts
CMD ["npm", "test"]

# Alternative command to run tests with specific arguments
# Usage: docker run my-app npm test -- --watch