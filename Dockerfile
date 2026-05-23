FROM node:20-slim

# Install build tools needed for @discordjs/opus
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libtool \
    autoconf \
    automake \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Expose the health check port from src/app.js
EXPOSE 3000

# Start the bot
CMD [ "npm", "start" ]
