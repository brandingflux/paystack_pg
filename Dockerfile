FROM node:22-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy project files
COPY . .

# Expose standard port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
