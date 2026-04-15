/**
 * Message handlers for the Telegram bot
 */

const commandHandlers = require('./commandHandlers');
const keyboards = require('../utils/keyboard');
const store = require('../utils/store');

// Handle searching for pairs
const handlePairSearch = (bot, msg) => {
  const chatId = msg.chat.id;
  const searchQuery = msg.text.trim().toUpperCase();
  
  // Get all monitored pairs
  const monitoredPairs = store.getMonitoredPairs();
  
  // Filter pairs that match the search query
  const matchingPairs = monitoredPairs.filter(pair => 
    pair.includes(searchQuery)
  );
  
  if (matchingPairs.length === 0) {
    bot.sendMessage(
      chatId,
      `🔍 *Search Results*\n\n` +
      `No pairs matching "${searchQuery}" found in your monitored pairs.`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboards.getSearchPairsKeyboard().reply_markup
      }
    );
  } else {
    // Create a custom keyboard for the search results
    const inlineKeyboard = matchingPairs.slice(0, 10).map(pair => [
      { text: `❌ ${pair}`, callback_data: `remove_pair_${pair}` }
    ]);
    
    // Add navigation buttons
    inlineKeyboard.push([
      { text: '🔙 Back to Monitored Pairs', callback_data: 'back_to_pairs' }
    ]);
    
    bot.sendMessage(
      chatId,
      `🔍 *Search Results*\n\n` +
      `Found ${matchingPairs.length} pairs matching "${searchQuery}":\n\n` +
      `Click on a pair to remove it from monitoring:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      }
    );
  }
};

// Process text messages
const processMessage = (bot, msg) => {
  if (!msg.text) return;

  const text = msg.text.trim();
  
  // Check if this is a reply to a search query
  if (msg.reply_to_message && 
      bot._searchPairsMessageIds && 
      bot._searchPairsMessageIds[msg.reply_to_message.message_id]) {
    handlePairSearch(bot, msg);
    // Clean up the stored message ID
    delete bot._searchPairsMessageIds[msg.reply_to_message.message_id];
    return;
  }
  
  // Handle main menu button clicks
  switch (text) {
    case '⚙️ Settings':
      commandHandlers.handleSettings(bot, msg);
      break;
      
    case '📈 Monitored Pairs':
      commandHandlers.handlePairs(bot, msg);
      break;
      
    case '🔝 Top Gainers':
      commandHandlers.handleTopGainers(bot, msg);
      break;
      
    case '🔻 Top Losers':
      commandHandlers.handleTopLosers(bot, msg);
      break;
      
    case '📊 24h Performance':
      commandHandlers.handlePerformance(bot, msg);
      break;
      
    case '❓ Help':
      commandHandlers.handleHelp(bot, msg);
      break;
      
    default:
      // Ignore unrecognized messages
      break;
  }
};

module.exports = {
  processMessage
}; 