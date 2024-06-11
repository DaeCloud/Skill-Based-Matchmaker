# Use the official Node.js 18 image as the base image
FROM node:18-slim

ENV NODE_ENV=production

# Install necessary packages for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libgtk-3-0 \
    libx11-6 \
    libx11-dev \
    libxtst6 \
    libnss3-dev \
    libgconf-2-4 \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libnspr4 \
    lsb-release \
    xdg-utils \
    wget

# Set environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]