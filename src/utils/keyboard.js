/**
 * Utility functions for creating Telegram keyboard buttons
 */

// Main menu keyboard
const getMainMenuKeyboard = () => {
  return {
    reply_markup: {
      keyboard: [
        ['⚙️ Settings', '📈 Monitored Pairs'],
        ['🔝 Top Gainers', '🔻 Top Losers'],
        ['📊 24h Performance', '❓ Help']
      ],
      resize_keyboard: true
    }
  };
};

// Settings keyboard
const getSettingsKeyboard = (alertThreshold, timeInterval) => {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `Alert Threshold: ${alertThreshold}%`, callback_data: 'threshold_info' }
        ],
        [
          { text: '➖', callback_data: 'threshold_decrease' },
          { text: '➕', callback_data: 'threshold_increase' }
        ],
        [
          { text: `Time Interval: ${timeInterval} min`, callback_data: 'interval_info' }
        ],
        [
          { text: '➖', callback_data: 'interval_decrease' },
          { text: '➕', callback_data: 'interval_increase' }
        ],
        [
          { text: '💹 Trend Settings', callback_data: 'trend_settings' }
        ],
        [
          { text: '💾 Save Settings', callback_data: 'save_settings' },
          { text: '🔙 Back', callback_data: 'back_to_main' }
        ]
      ]
    }
  };
};

// Get trend settings keyboard
const getTrendSettingsKeyboard = (trendSettings) => {
  const { enabled, trendDetectionWindowMinutes, minAlertsForTrend } = trendSettings;
  
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `Status: ${enabled ? 'Enabled ✅' : 'Disabled ❌'}`, callback_data: 'trend_info' }
        ],
        [
          { text: enabled ? 'Disable' : 'Enable', callback_data: 'trend_toggle_enabled' }
        ],
        [
          { text: `Time Window: ${trendDetectionWindowMinutes} min`, callback_data: 'trend_window_info' }
        ],
        [
          { text: '➖', callback_data: 'trend_window_decrease' },
          { text: '➕', callback_data: 'trend_window_increase' }
        ],
        [
          { text: `Min Alerts: ${minAlertsForTrend}`, callback_data: 'trend_alerts_info' }
        ],
        [
          { text: '➖', callback_data: 'trend_alerts_decrease' },
          { text: '➕', callback_data: 'trend_alerts_increase' }
        ],
        [
          { text: '💾 Save Trend Settings', callback_data: 'save_trend_settings' },
          { text: '🔙 Back to Settings', callback_data: 'back_to_settings' }
        ]
      ]
    }
  };
};

// Pairs management keyboard - updated to focus on removing pairs
const getPairsKeyboard = (pairs, page = 0, itemsPerPage = 5) => {
  const totalPages = Math.ceil(pairs.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, pairs.length);
  const currentPairs = pairs.slice(startIdx, endIdx);
  
  const pairsButtons = currentPairs.map(pair => {
    return [{ text: `❌ ${pair}`, callback_data: `remove_pair_${pair}` }];
  });
  
  const navigationRow = [];
  if (page > 0) {
    navigationRow.push({ text: '⬅️ Previous', callback_data: `pairs_page_${page - 1}` });
  }
  
  navigationRow.push({ text: `Page ${page + 1}/${totalPages || 1}`, callback_data: 'pairs_current_page' });
  
  if (page < totalPages - 1) {
    navigationRow.push({ text: 'Next ➡️', callback_data: `pairs_page_${page + 1}` });
  }
  
  // Remove the "Add Pair" button since all pairs are monitored by default
  const keyboard = [
    ...pairsButtons,
    navigationRow,
    [{ text: '🔄 Refresh List', callback_data: 'refresh_pairs' }],
    [{ text: '🔙 Back to Main Menu', callback_data: 'back_to_main' }]
  ];
  
  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
};

// For searching pairs - updated to search for pairs to remove
const getSearchPairsKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔍 Search for a specific pair', callback_data: 'search_pairs' }],
        [{ text: '🔙 Back to Monitored Pairs', callback_data: 'back_to_pairs' }]
      ]
    }
  };
};

module.exports = {
  getMainMenuKeyboard,
  getSettingsKeyboard,
  getPairsKeyboard,
  getSearchPairsKeyboard,
  getTrendSettingsKeyboard
}; 