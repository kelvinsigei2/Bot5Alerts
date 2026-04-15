/**
 * Health check module for Railway deployment
 */

const http = require('http');

// Create a simple health check server
const createHealthCheckServer = (port = process.env.PORT || 3000) => {
  const server = http.createServer((req, res) => {
    console.log(`[HEALTH] Request received: ${req.url}`);
    
    if (req.url === '/' || req.url === '/health') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'Bot is running'
      };
      
      console.log('[HEALTH] Responding with:', response);
      res.end(JSON.stringify(response));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  server.listen(port, () => {
    console.log(`[HEALTH] Health check server running on port ${port}`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('[HEALTH] Health check server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`[HEALTH] Port ${port} is already in use, trying to restart...`);
      setTimeout(() => {
        server.close();
        server.listen(port);
      }, 1000);
    }
  });
  
  return server;
};

module.exports = { createHealthCheckServer }; 