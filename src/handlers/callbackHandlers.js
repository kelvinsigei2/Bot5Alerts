/**
 * Callback query handlers for the Telegram bot
 */

const keyboards = require('../utils/keyboard');
const store = require('../utils/store');
const binanceService = require('../services/binanceService');
const config = require('../config/config');

// Handle settings related callbacks
const handleSettingsCallbacks = async (bot, query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const userSettings = store.getUserSettings(chatId);
  
  let { alertThreshold, timeInterval } = userSettings;
  let settingsChanged = false;
  
  switch (data) {
    case 'threshold_decrease':
      if (alertThreshold > config.minAlertThreshold) {
        alertThreshold--;
        settingsChanged = true;
      }
      break;
      
    case 'threshold_increase':
      if (alertThreshold < config.maxAlertThreshold) {
        alertThreshold++;
        settingsChanged = true;
      }
      break;
      
    case 'interval_decrease':
      if (timeInterval > config.minTimeInterval) {
        timeInterval--;
        settingsChanged = true;
      }
      break;
      
    case 'interval_increase':
      if (timeInterval < config.maxTimeInterval) {
        timeInterval++;
        settingsChanged = true;
      }
      break;
      
    case 'save_settings':
      store.updateUserSettings(chatId, { alertThreshold, timeInterval });
      bot.answerCallbackQuery(query.id, { text: 'Settings saved successfully!' });
      bot.sendMessage(chatId, `✅ Your alert settings have been updated:\n\n` +
        `• Alert Threshold: ${alertThreshold}%\n` +
        `• Time Interval: ${timeInterval} minutes`, keyboards.getMainMenuKeyboard());
      return;
      
    case 'threshold_info':
      bot.answerCallbackQuery(query.id, { 
        text: `Alert Threshold: You'll be notified when price changes by ${alertThreshold}% or more within your set time interval.`,
        show_alert: true
      });
      return;
      
    case 'interval_info':
      bot.answerCallbackQuery(query.id, { 
        text: `Time Interval: The bot will check for price changes over this time period (${timeInterval} minutes).`,
        show_alert: true
      });
      return;
      
    case 'trend_settings':
      // Load the trend settings module
      const trendDetector = require('../utils/trendDetector');
      
      // Get current trend settings
      const trendSettings = trendDetector.getSettings();
      
      // Show trend settings screen
      bot.editMessageText(
        trendDetector.formatTrendSettingsInfo(),
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboards.getTrendSettingsKeyboard(trendSettings).reply_markup
        }
      );
      
      bot.answerCallbackQuery(query.id);
      return;
  }
  
  if (settingsChanged) {
    store.updateUserSettings(chatId, { alertThreshold, timeInterval });
    
    // Update the settings keyboard
    bot.editMessageReplyMarkup(
      keyboards.getSettingsKeyboard(alertThreshold, timeInterval).reply_markup,
      { chat_id: chatId, message_id: messageId }
    );
    
    bot.answerCallbackQuery(query.id);
  } else {
    bot.answerCallbackQuery(query.id, { text: 'No changes made.' });
  }
};

// Handle trend settings callbacks
const handleTrendSettingsCallbacks = async (bot, query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  // Load the trend settings module
  const trendDetector = require('../utils/trendDetector');
  
  // Get current trend settings
  const trendSettings = trendDetector.getSettings();
  let settingsChanged = false;
  
  switch (data) {
    case 'trend_toggle_enabled':
      // Toggle enabled status
      trendSettings.enabled = !trendSettings.enabled;
      settingsChanged = true;
      break;
      
    case 'trend_window_decrease':
      // Decrease time window (minimum 5 minutes)
      if (trendSettings.trendDetectionWindowMinutes > 5) {
        trendSettings.trendDetectionWindowMinutes -= 5;
        settingsChanged = true;
      }
      break;
      
    case 'trend_window_increase':
      // Increase time window (maximum 30 minutes)
      if (trendSettings.trendDetectionWindowMinutes < 30) {
        trendSettings.trendDetectionWindowMinutes += 5;
        settingsChanged = true;
      }
      break;
      
    case 'trend_alerts_decrease':
      // Decrease minimum alerts (minimum 2)
      if (trendSettings.minAlertsForTrend > 2) {
        trendSettings.minAlertsForTrend--;
        settingsChanged = true;
      }
      break;
      
    case 'trend_alerts_increase':
      // Increase minimum alerts (maximum 5)
      if (trendSettings.minAlertsForTrend < 5) {
        trendSettings.minAlertsForTrend++;
        settingsChanged = true;
      }
      break;
      
    case 'save_trend_settings':
      // Save trend settings
      trendDetector.updateSettings(trendSettings);
      bot.answerCallbackQuery(query.id, { text: 'Trend settings saved successfully!' });
      
      // Show confirmation message
      bot.sendMessage(chatId, `✅ Your trend detection settings have been updated!\n\n` +
        `• Status: ${trendSettings.enabled ? 'Enabled' : 'Disabled'}\n` +
        `• Time Window: ${trendSettings.trendDetectionWindowMinutes} minutes\n` +
        `• Minimum Alerts: ${trendSettings.minAlertsForTrend}`);
      
      // Go back to main settings
      const userSettings = store.getUserSettings(chatId);
      bot.editMessageText(
        `⚙️ *Alert Settings*\n\n` +
        `Configure your price alert settings below:\n\n` +
        `• Alert Threshold: When price changes by this percentage or more, you'll receive an alert\n` +
        `• Time Interval: The time window to monitor for price changes\n\n` +
        `Use the buttons below to adjust your settings:`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboards.getSettingsKeyboard(userSettings.alertThreshold, userSettings.timeInterval).reply_markup
        }
      );
      return;
      
    case 'back_to_settings':
      // Go back to main settings
      const settings = store.getUserSettings(chatId);
      bot.editMessageText(
        `⚙️ *Alert Settings*\n\n` +
        `Configure your price alert settings below:\n\n` +
        `• Alert Threshold: When price changes by this percentage or more, you'll receive an alert\n` +
        `• Time Interval: The time window to monitor for price changes\n\n` +
        `Use the buttons below to adjust your settings:`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboards.getSettingsKeyboard(settings.alertThreshold, settings.timeInterval).reply_markup
        }
      );
      
      bot.answerCallbackQuery(query.id);
      return;
      
    case 'trend_info':
      bot.answerCallbackQuery(query.id, { 
        text: `Trend Detection: When enabled, the bot will detect and notify you of potential trends forming based on multiple consecutive price alerts in the same direction.`,
        show_alert: true
      });
      return;
      
    case 'trend_window_info':
      bot.answerCallbackQuery(query.id, { 
        text: `Time Window: The bot will look for multiple alerts within this time period (${trendSettings.trendDetectionWindowMinutes} minutes) to detect trends.`,
        show_alert: true
      });
      return;
      
    case 'trend_alerts_info':
      bot.answerCallbackQuery(query.id, { 
        text: `Min Alerts: The minimum number of consecutive alerts in the same direction needed to identify a trend (${trendSettings.minAlertsForTrend}).`,
        show_alert: true
      });
      return;
  }
  
  if (settingsChanged) {
    // Update the trend settings in memory (not saved until user clicks Save)
    
    // Update the keyboard
    bot.editMessageReplyMarkup(
      keyboards.getTrendSettingsKeyboard(trendSettings).reply_markup,
      { chat_id: chatId, message_id: messageId }
    );
    
    bot.answerCallbackQuery(query.id);
  } else {
    bot.answerCallbackQuery(query.id, { text: 'No changes made.' });
  }
};

// Handle pairs related callbacks
const handlePairsCallbacks = async (bot, query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  // Handle pagination
  if (data.startsWith('pairs_page_')) {
    const page = parseInt(data.replace('pairs_page_', ''));
    const monitoredPairs = store.getMonitoredPairs();
    
    bot.editMessageReplyMarkup(
      keyboards.getPairsKeyboard(monitoredPairs, page).reply_markup,
      { chat_id: chatId, message_id: messageId }
    );
    
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle refresh pairs list
  if (data === 'refresh_pairs') {
    const monitoredPairs = store.getMonitoredPairs();
    
    if (monitoredPairs.length === 0) {
      bot.answerCallbackQuery(query.id, { text: 'No pairs being monitored. Initializing...' });
      
      // Try to reinitialize pairs
      try {
        const allPairs = await binanceService.getFuturesUSDTPairs();
        
        if (allPairs && allPairs.length > 0) {
          allPairs.forEach(pair => {
            store.addMonitoredPair(pair);
          });
          
          const updatedPairs = store.getMonitoredPairs();
          
          bot.editMessageText(
            `📈 *Monitored Pairs*\n\n` +
            `You are currently monitoring *${updatedPairs.length} pairs*. Use the buttons below to view and manage them:\n\n` +
            `• Click on any pair you want to remove from monitoring\n` +
            `• Use the navigation buttons to browse through all pairs`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: keyboards.getPairsKeyboard(updatedPairs).reply_markup
            }
          );
        }
      } catch (error) {
        console.error('Error refreshing pairs:', error);
        bot.answerCallbackQuery(query.id, { text: 'Error refreshing pairs. Please try again later.' });
      }
    } else {
      bot.answerCallbackQuery(query.id, { text: 'Pairs list refreshed' });
      bot.editMessageReplyMarkup(
        keyboards.getPairsKeyboard(monitoredPairs, 0).reply_markup,
        { chat_id: chatId, message_id: messageId }
      );
    }
    return;
  }
  
  // Handle pair removal
  if (data.startsWith('remove_pair_')) {
    const pair = data.replace('remove_pair_', '');
    store.removeMonitoredPair(pair);
    
    bot.answerCallbackQuery(query.id, { text: `${pair} removed from monitoring!` });
    
    const monitoredPairs = store.getMonitoredPairs();
    if (monitoredPairs.length === 0) {
      bot.editMessageText(
        `📈 *Monitored Pairs*\n\n` +
        `You've removed all monitored pairs. Use the 'Refresh List' button to restore the full list of USDT pairs.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboards.getPairsKeyboard([]).reply_markup
        }
      );
    } else {
      // Keep the same page when removing a pair
      const currentPage = Math.floor(monitoredPairs.indexOf(pair) / 5);
      const page = currentPage >= 0 ? currentPage : 0;
      
      bot.editMessageText(
        `📈 *Monitored Pairs*\n\n` +
        `You are currently monitoring *${monitoredPairs.length} pairs*. Use the buttons below to view and manage them:\n\n` +
        `• Click on any pair you want to remove from monitoring\n` +
        `• Use the navigation buttons to browse through all pairs`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboards.getPairsKeyboard(monitoredPairs, page).reply_markup
        }
      );
    }
    return;
  }
  
  // Handle search pairs button
  if (data === 'search_pairs') {
    bot.answerCallbackQuery(query.id);
    
    bot.sendMessage(chatId, 
      `🔍 *Search Pairs*\n\n` +
      `To search for a specific pair, send the name or part of the name of the cryptocurrency (e.g., "BTC" or "ETH").\n\n` +
      `I'll show you matching pairs that you can remove from monitoring.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true
        }
      }
    ).then(sentMessage => {
      // Store the message ID to recognize the reply
      bot._searchPairsMessageIds = bot._searchPairsMessageIds || {};
      bot._searchPairsMessageIds[sentMessage.message_id] = true;
    });
    
    return;
  }
  
  // Handle back to pairs menu
  if (data === 'back_to_pairs') {
    const monitoredPairs = store.getMonitoredPairs();
    
    bot.editMessageText(
      `📈 *Monitored Pairs*\n\n` +
      `You are currently monitoring *${monitoredPairs.length} pairs*. Use the buttons below to view and manage them:\n\n` +
      `• Click on any pair you want to remove from monitoring\n` +
      `• Use the navigation buttons to browse through all pairs`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboards.getPairsKeyboard(monitoredPairs).reply_markup
      }
    );
    
    bot.answerCallbackQuery(query.id);
    return;
  }
  
  // Handle current page info
  if (data === 'pairs_current_page') {
    bot.answerCallbackQuery(query.id, { 
      text: 'Use the Previous and Next buttons to navigate between pages.' 
    });
    return;
  }
};

// Handle general navigation callbacks
const handleNavigationCallbacks = (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  if (data === 'back_to_main') {
    // We'll just delete the message with the inline keyboard
    // and let the user use the main menu keyboard
    bot.deleteMessage(chatId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  }
};

// Process callback query
const processCallbackQuery = async (bot, query) => {
  try {
    const data = query.data;
    
    // Determine which handler to use based on the callback data
    if (data.startsWith('threshold_') || data.startsWith('interval_') || data === 'save_settings' || data === 'trend_settings') {
      await handleSettingsCallbacks(bot, query);
    } else if (data.startsWith('pairs_') || data.startsWith('remove_pair_') || data === 'refresh_pairs' || data === 'search_pairs' || data === 'back_to_pairs') {
      await handlePairsCallbacks(bot, query);
    } else if (data === 'back_to_main') {
      await handleNavigationCallbacks(bot, query);
    } else if (data.startsWith('trend_') || data === 'back_to_settings') {
      await handleTrendSettingsCallbacks(bot, query);
    } else {
      console.log(`Unknown callback query: ${data}`);
      bot.answerCallbackQuery(query.id, { text: 'This feature is not implemented yet.' });
    }
  } catch (error) {
    console.error('Error processing callback query:', error);
    
    try {
      // Try to answer the callback query to prevent the "loading" state in Telegram
      bot.answerCallbackQuery(query.id, { text: 'An error occurred. Please try again later.' });
    } catch (answerError) {
      console.error('Error answering callback query after error:', answerError);
    }
  }
};

module.exports = {
  processCallbackQuery
}; 