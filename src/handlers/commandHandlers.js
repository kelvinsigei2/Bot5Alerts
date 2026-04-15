/**
 * Command handlers for the Telegram bot
 */

const keyboards = require('../utils/keyboard');
const store = require('../utils/store');
const binanceService = require('../services/binanceService');
const formatters = require('../utils/formatters');
const config = require('../config/config');

// Start command handler
const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';
  
  const welcomeMessage = `👋 Hello, ${firstName}!\n\n` +
    `Welcome to the Binance Futures Alert Bot. I'll help you monitor cryptocurrency prices and alert you when there are significant price movements.\n\n` +
    `By default, I'm monitoring *all available USDT pairs* on Binance Futures. You can remove specific pairs you don't want to monitor from the 'Monitored Pairs' menu.\n\n` +
    `Use the menu below to configure your settings, manage your watched pairs, and view market information.`;
  
  // Get user settings (will create default if not exists)
  store.getUserSettings(chatId);
  
  bot.sendMessage(chatId, welcomeMessage, { 
    parse_mode: 'Markdown',
    ...keyboards.getMainMenuKeyboard()
  });
};

// Help command handler
const handleHelp = (bot, msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `*Binance Futures Alert Bot Help*\n\n` +
    `This bot monitors Binance futures prices and alerts you when prices change rapidly.\n\n` +
    `*Commands:*\n` +
    `/start - Start the bot and see the main menu\n` +
    `/help - Show this help message\n` +
    `/settings - Configure alert settings\n` +
    `/pairs - Manage monitored pairs (remove pairs you don't want to track)\n` +
    `/topgainers - View top gainers in the last hour\n` +
    `/toplosers - View top losers in the last hour\n` +
    `/performance - See 24-hour market performance\n` +
    `/refresh - Refresh price data for all pairs\n` +
    `/refresh SYMBOL - Refresh price data for specific symbol (e.g. /refresh BTCUSDT)\n\n` +
    `*How it works:*\n` +
    `1. By default, all USDT pairs are monitored. You can remove specific pairs using the 'Monitored Pairs' menu\n` +
    `2. Set your preferred alert threshold and time interval in 'Settings'\n` +
    `3. The bot will notify you when price changes meet your criteria\n` +
    `4. The bot can detect price trends by identifying multiple alerts for the same pair in the same direction within a short time period\n\n` +
    `*New Feature - Trend Detection:*\n` +
    `The bot can now identify potential trends! When multiple price alerts for the same cryptocurrency occur in the same direction (e.g., multiple price increases) within a 10-minute window, the bot will send a special trend notification. Configure this feature in Settings > Trend Settings.\n\n` +
    `*Troubleshooting:*\n` +
    `If you receive incorrect price alerts, use the /refresh command to ensure the bot has the latest price data.\n\n` +
    `For any issues or feedback, please contact the developer.`;
  
  bot.sendMessage(chatId, helpMessage, { 
    parse_mode: 'Markdown',
    ...keyboards.getMainMenuKeyboard()
  });
};

// Settings command handler
const handleSettings = (bot, msg) => {
  const chatId = msg.chat.id;
  const userSettings = store.getUserSettings(chatId);
  
  const message = `⚙️ *Alert Settings*\n\n` +
    `Configure your price alert settings below:\n\n` +
    `• Alert Threshold: When price changes by this percentage or more, you'll receive an alert\n` +
    `• Time Interval: The time window to monitor for price changes\n\n` +
    `Use the buttons below to adjust your settings:`;
  
  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    ...keyboards.getSettingsKeyboard(userSettings.alertThreshold, userSettings.timeInterval)
  });
};

// Pairs command handler
const handlePairs = async (bot, msg) => {
  const chatId = msg.chat.id;
  const monitoredPairs = store.getMonitoredPairs();
  
  if (monitoredPairs.length === 0) {
    const message = `📈 *Monitored Pairs*\n\n` +
      `You're not monitoring any pairs yet. The bot is currently initializing or there was an error fetching the pairs.\n\n` +
      `Please try again in a few moments or contact support if the issue persists.`;
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown'
    });
  } else {
    // Since there might be many pairs, we'll just show a count and the page navigation
    // rather than listing all of them in the message
    const message = `📈 *Monitored Pairs*\n\n` +
      `You are currently monitoring *${monitoredPairs.length} pairs*. Use the buttons below to view and manage them:\n\n` +
      `• Click on any pair you want to remove from monitoring\n` +
      `• Use the navigation buttons to browse through all pairs`;
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...keyboards.getPairsKeyboard(monitoredPairs)
    });
  }
};

// Top gainers command handler
const handleTopGainers = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🔍 Fetching top gainers... Please wait.');
  
  try {
    // Use the new direct API function instead of getTopMovers
    const result = await binanceService.getTopMovers1h(10);
    
    if (result.message) {
      // If we got a message about initialization, send it to the user
      bot.sendMessage(chatId, `⚠️ ${result.message}`);
      return;
    }
    
    const { topGainers } = result;
    
    if (!topGainers || topGainers.length === 0) {
      bot.sendMessage(chatId, 'Sorry, I could not fetch the top gainers at this time. Please try again later.');
      return;
    }
    
    const message = formatters.formatTopMovers(topGainers, true);
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling top gainers command:', error);
    bot.sendMessage(chatId, 'An error occurred while fetching top gainers. Please try again later.');
  }
};

// Top losers command handler
const handleTopLosers = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🔍 Fetching top losers... Please wait.');
  
  try {
    // Use the new direct API function instead of getTopMovers
    const result = await binanceService.getTopMovers1h(10);
    
    if (result.message) {
      // If we got a message about initialization, send it to the user
      bot.sendMessage(chatId, `⚠️ ${result.message}`);
      return;
    }
    
    const { topLosers } = result;
    
    if (!topLosers || topLosers.length === 0) {
      bot.sendMessage(chatId, 'Sorry, I could not fetch the top losers at this time. Please try again later.');
      return;
    }
    
    const message = formatters.formatTopMovers(topLosers, false);
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling top losers command:', error);
    bot.sendMessage(chatId, 'An error occurred while fetching top losers. Please try again later.');
  }
};

// 24h performance command handler
const handlePerformance = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '📊 Fetching 24h performance data... Please wait.');
  
  try {
    const performanceData = await binanceService.get24hPerformance(10);
    
    if (!performanceData || performanceData.length === 0) {
      bot.sendMessage(chatId, 'Sorry, I could not fetch the performance data at this time. Please try again later.');
      return;
    }
    
    const message = formatters.format24hPerformance(performanceData);
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling performance command:', error);
    bot.sendMessage(chatId, 'An error occurred while fetching performance data. Please try again later.');
  }
};

// Add a refresh command to handle price data issues
const handleRefresh = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  // Check if a specific symbol was provided
  const text = msg.text.trim();
  const parts = text.split(' ');
  let symbol = null;
  
  if (parts.length > 1) {
    // User specified a symbol
    symbol = parts[1].toUpperCase();
    
    if (symbol && symbol.endsWith('USDT')) {
      bot.sendMessage(chatId, `🔄 Forcing refresh of price data for ${symbol}...`);
      
      try {
        // Force a fresh price fetch
        const freshPrice = await binanceService.getCurrentPrice(symbol, true);
        
        if (freshPrice) {
          bot.sendMessage(chatId, `✅ Successfully refreshed ${symbol} price data!\n\nCurrent price: $${freshPrice}`);
          
          // Add this symbol to the problematic symbols list if it's not already there
          binanceService.addProblematicSymbol(symbol);
        } else {
          bot.sendMessage(chatId, `❌ Failed to get fresh price data for ${symbol}. Please check if the symbol is valid.`);
        }
      } catch (error) {
        console.error(`Error refreshing price data for ${symbol}:`, error);
        bot.sendMessage(chatId, `❌ Error refreshing price data for ${symbol}. Please try again later.`);
      }
    } else {
      bot.sendMessage(chatId, `⚠️ Invalid symbol format. Please use format like "BTCUSDT".`);
    }
  } else {
    // No symbol specified, refresh all monitored pairs
    bot.sendMessage(chatId, `🔄 Refreshing price data for all monitored pairs...`);
    
    try {
      // Force API cache refresh
      await binanceService.refreshAllPrices();
      
      bot.sendMessage(chatId, `✅ Successfully refreshed price data for all monitored pairs!`);
    } catch (error) {
      console.error('Error refreshing all price data:', error);
      bot.sendMessage(chatId, `❌ Error refreshing price data. Please try again later.`);
    }
  }
};

module.exports = {
  handleStart,
  handleHelp,
  handleSettings,
  handlePairs,
  handleTopGainers,
  handleTopLosers,
  handlePerformance,
  handleRefresh
}; 