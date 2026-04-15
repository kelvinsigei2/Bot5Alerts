#!/bin/bash

# Log startup information
echo "Starting Binance Alert Bot..."
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Current directory: $(pwd)"
echo "Files in directory: $(ls -la)"

# Create a simple health check file that Railway can use
echo "Creating health check file..."
echo '
const http = require("http");
const server = http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "application/json"});
  res.end(JSON.stringify({status: "ok", message: "Bot is running"}));
});
server.listen(process.env.PORT || 3000);
console.log("Health check server started");
' > health.js

# Start both the health check and the main application
echo "Starting health check server..."
node health.js &
HEALTH_PID=$!

# Sleep to ensure health check is running
sleep 2

# Start the main application
echo "Starting main application..."
node src/index.js

# If the main application exits, also kill the health check
kill $HEALTH_PID 