/**
 * Binance Futures Price Alert Bot
 * 
 * Monitors Binance futures prices and sends alerts when significant price movements occur
 */

const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const config = require('./config/config');
const commandHandlers = require('./handlers/commandHandlers');
const callbackHandlers = require('./handlers/callbackHandlers');
const messageHandlers = require('./handlers/messageHandlers');
const binanceService = require('./services/binanceService');
const store = require('./utils/store');
const { createHealthCheckServer } = require('./health');

// Create health check server first
createHealthCheckServer();

// Track bot initialization and active users globally
global.botInitialized = false;
global.activeUsers = new Set();

// Check command line arguments
const args = process.argv.slice(2);
const useRestApiOnly = args.includes('--rest-api-only');

if (useRestApiOnly) {
  console.log('Starting in REST API only mode (WebSockets disabled)');
  binanceService.disableWebSocket();
}

// Initialize the Telegram bot
console.log('Initializing Telegram bot...');
const bot = new TelegramBot(config.telegramToken, { polling: true });

// Initialize by fetching all USDT pairs
const initializeAllPairs = async () => {
  try {
    console.log('Initializing all USDT trading pairs...');
    const allPairs = await binanceService.getFuturesUSDTPairs();
    
    if (allPairs && allPairs.length > 0) {
      allPairs.forEach(pair => {
        store.addMonitoredPair(pair);
      });
      console.log(`Successfully initialized ${allPairs.length} trading pairs for monitoring`);
    } else {
      console.error('Failed to fetch trading pairs during initialization');
    }
  } catch (error) {
    console.error('Error during pairs initialization:', error);
  }
};

// Run initialization on startup
initializeAllPairs();

// Register command handlers
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;
  global.activeUsers.add(userId);
  commandHandlers.handleStart(bot, msg);
});

bot.onText(/\/help/, (msg) => {
  commandHandlers.handleHelp(bot, msg);
});

bot.onText(/\/settings/, (msg) => {
  commandHandlers.handleSettings(bot, msg);
});

bot.onText(/\/pairs/, (msg) => {
  commandHandlers.handlePairs(bot, msg);
});

bot.onText(/\/topgainers/, (msg) => {
  commandHandlers.handleTopGainers(bot, msg);
});

bot.onText(/\/toplosers/, (msg) => {
  commandHandlers.handleTopLosers(bot, msg);
});

bot.onText(/\/performance/, (msg) => {
  commandHandlers.handlePerformance(bot, msg);
});

// Register the refresh command
bot.onText(/\/refresh(.*)/, (msg) => {
  commandHandlers.handleRefresh(bot, msg);
});

// Register callback query handler (for inline keyboard buttons)
bot.on('callback_query', (query) => {
  callbackHandlers.processCallbackQuery(bot, query);
});

// Register message handler (for main menu buttons)
bot.on('message', (msg) => {
  // Skip messages with commands (already handled by command handlers)
  if (msg.text && msg.text.startsWith('/')) return;
  
  // Add user to active users
  if (msg.from && msg.from.id) {
    global.activeUsers.add(msg.from.id);
  }
  
  messageHandlers.processMessage(bot, msg);
});

// Optimize price monitoring to reduce notification delay
// Instead of running every minute, run more frequently for faster alert detection
const startPriceMonitoring = () => {
  // Update price history every 15 seconds
  setInterval(async () => {
    await binanceService.updatePriceHistory();
  }, 15 * 1000);
  
  // Check for price alerts every 10 seconds
  setInterval(async () => {
    if (global.activeUsers.size > 0) {
      await binanceService.checkPriceAlerts(Array.from(global.activeUsers), bot);
    }
  }, 10 * 1000);
  
  console.log('Price monitoring started with optimized intervals for faster alerts');
};

// Start the optimized price monitoring
startPriceMonitoring();

// Schedule cleanup of inactive users (every day at midnight)
schedule.scheduleJob('0 0 * * *', () => {
  console.log('Cleaning up inactive users...');
  // In a real application, we would check for activity timestamps
  // and remove users who haven't interacted with the bot in X days
});

// Log that the bot has started
console.log('Binance Futures Alert Bot is running with optimized notification system...');
console.log('🚀 Updates: ');
console.log('- Price data is now updated every 15 seconds instead of every minute');
console.log('- Price alert checks now run every 10 seconds for faster notifications');
console.log('- WebSocket connections provide real-time price updates');
console.log('- Optimized in-memory storage for faster price history access');
console.log('- Improved alert timing to reduce notification delays');

// Handle errors gracefully
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('Webhook error:', error);
});

// Consider the bot initialized when we've set up event handlers
setTimeout(() => {
  global.botInitialized = true;
  console.log('Bot fully initialized and ready for health checks');
}, 5000); // Give it 5 seconds to fully initialize

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Keep the process running even if there's an uncaught exception
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Keep the process running even if there's an unhandled promise rejection
}); 