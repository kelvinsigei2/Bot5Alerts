/**
 * Utility for detecting price trends based on consecutive alerts
 */

// Store for recent alerts, organized by symbol: { symbol: [alert1, alert2, ...] }
const recentAlerts = new Map();

// Default settings (can be overridden)
const settings = {
  // Time window for trend detection (in ms)
  trendDetectionWindow: 10 * 60 * 1000, // 10 minutes
  
  // Minimum alerts required to detect a trend
  minAlertsForTrend: 2,
  
  // Whether trend detection is enabled
  enabled: true
};

// Store for already reported trends to avoid duplicates
const reportedTrends = new Map();

/**
 * Update trend detection settings
 * @param {Object} newSettings - New settings to apply
 */
const updateSettings = (newSettings) => {
  if (newSettings.trendDetectionWindowMinutes) {
    settings.trendDetectionWindow = newSettings.trendDetectionWindowMinutes * 60 * 1000;
  }
  
  if (typeof newSettings.minAlertsForTrend === 'number') {
    settings.minAlertsForTrend = newSettings.minAlertsForTrend;
  }
  
  if (typeof newSettings.enabled === 'boolean') {
    settings.enabled = newSettings.enabled;
  }
  
  return settings;
};

/**
 * Get current trend detection settings
 * @returns {Object} Current settings
 */
const getSettings = () => {
  return {
    trendDetectionWindowMinutes: settings.trendDetectionWindow / (60 * 1000),
    minAlertsForTrend: settings.minAlertsForTrend,
    enabled: settings.enabled
  };
};

/**
 * Record a new price alert for a symbol
 * @param {String} symbol - The trading pair (e.g., 'BTCUSDT')
 * @param {Number} currentPrice - Current price
 * @param {Number} previousPrice - Previous price
 * @param {Number} changePercent - Percentage change
 * @returns {Object} Trend information if detected, null otherwise
 */
const recordAlert = (symbol, currentPrice, previousPrice, changePercent) => {
  // Skip if trend detection is disabled
  if (!settings.enabled) {
    return null;
  }
  
  const timestamp = Date.now();
  const direction = changePercent > 0 ? 'up' : 'down';
  
  // Create alert object
  const alert = {
    timestamp,
    currentPrice,
    previousPrice,
    changePercent,
    direction
  };
  
  // Initialize entry if this is the first alert for this symbol
  if (!recentAlerts.has(symbol)) {
    recentAlerts.set(symbol, []);
  }
  
  // Get alerts for this symbol
  const symbolAlerts = recentAlerts.get(symbol);
  
  // Add the new alert
  symbolAlerts.push(alert);
  
  // Remove alerts older than the trend detection window
  const cutoffTime = timestamp - settings.trendDetectionWindow;
  const updatedAlerts = symbolAlerts.filter(a => a.timestamp >= cutoffTime);
  recentAlerts.set(symbol, updatedAlerts);
  
  // Check if we have a trend
  return detectTrend(symbol, updatedAlerts);
};

/**
 * Detect if a trend is forming based on recent alerts
 * @param {String} symbol - The trading pair
 * @param {Array} alerts - Array of recent alerts for this symbol
 * @returns {Object|null} Trend info if detected, null otherwise
 */
const detectTrend = (symbol, alerts) => {
  if (alerts.length < settings.minAlertsForTrend) {
    return null;
  }
  
  // Sort alerts by timestamp, oldest first
  const sortedAlerts = [...alerts].sort((a, b) => a.timestamp - b.timestamp);
  
  // Check trends by direction
  const upAlerts = sortedAlerts.filter(alert => alert.direction === 'up');
  const downAlerts = sortedAlerts.filter(alert => alert.direction === 'down');
  
  let trend = null;
  
  // Check for uptrend - at least settings.minAlertsForTrend consecutive alerts
  if (upAlerts.length >= settings.minAlertsForTrend) {
    const latestUpAlert = upAlerts[upAlerts.length - 1];
    const earliestUpAlert = upAlerts[0];
    
    // Check if all these alerts were within the time window
    if (latestUpAlert.timestamp - earliestUpAlert.timestamp <= settings.trendDetectionWindow) {
      trend = {
        symbol,
        direction: 'up',
        alerts: upAlerts,
        startTime: earliestUpAlert.timestamp,
        endTime: latestUpAlert.timestamp,
        totalChange: latestUpAlert.currentPrice - earliestUpAlert.previousPrice,
        percentChange: ((latestUpAlert.currentPrice - earliestUpAlert.previousPrice) / earliestUpAlert.previousPrice) * 100
      };
    }
  }
  
  // Check for downtrend - at least settings.minAlertsForTrend consecutive alerts
  if (downAlerts.length >= settings.minAlertsForTrend) {
    const latestDownAlert = downAlerts[downAlerts.length - 1];
    const earliestDownAlert = downAlerts[0];
    
    // Check if all these alerts were within the time window
    if (latestDownAlert.timestamp - earliestDownAlert.timestamp <= settings.trendDetectionWindow) {
      trend = {
        symbol,
        direction: 'down',
        alerts: downAlerts,
        startTime: earliestDownAlert.timestamp,
        endTime: latestDownAlert.timestamp,
        totalChange: earliestDownAlert.previousPrice - latestDownAlert.currentPrice,
        percentChange: ((earliestDownAlert.previousPrice - latestDownAlert.currentPrice) / earliestDownAlert.previousPrice) * 100
      };
    }
  }
  
  // If we have a trend, check if we've already reported something similar
  if (trend) {
    const trendKey = `${symbol}-${trend.direction}`;
    
    // If we haven't reported this trend yet, or the last report was outside the window
    if (!reportedTrends.has(trendKey) || 
        (Date.now() - reportedTrends.get(trendKey)) > settings.trendDetectionWindow) {
      
      // Record this trend as reported
      reportedTrends.set(trendKey, Date.now());
      return trend;
    }
  }
  
  return null;
};

/**
 * Format a trend for display in a message
 * @param {Object} trend - The detected trend
 * @returns {String} Formatted message
 */
const formatTrendMessage = (trend) => {
  const emoji = trend.direction === 'up' ? '🚀📈' : '📉💥';
  const directionText = trend.direction === 'up' ? 'UPTREND' : 'DOWNTREND';
  const minutes = Math.round((trend.endTime - trend.startTime) / 60000);
  const alerts = trend.alerts.length;
  
  return `${emoji} *${directionText} DETECTED* ${emoji}\n\n` +
    `*${trend.symbol}* is forming a ${trend.direction}trend!\n\n` +
    `• ${alerts} consecutive alerts in the same direction\n` +
    `• Trend formed over ${minutes} minutes\n` +
    `• Total change: ${trend.percentChange.toFixed(2)}%\n` +
    `• Current price: $${trend.alerts[trend.alerts.length-1].currentPrice.toFixed(4)}\n\n` +
    `This could indicate a potential trading opportunity.`;
};

/**
 * Format trend settings information
 * @returns {String} Formatted settings info
 */
const formatTrendSettingsInfo = () => {
  const currentSettings = getSettings();
  const enabledStatus = currentSettings.enabled ? 'Enabled ✅' : 'Disabled ❌';
  
  return `📊 *Trend Detection Settings*\n\n` +
    `Status: *${enabledStatus}*\n` +
    `Time Window: *${currentSettings.trendDetectionWindowMinutes} minutes*\n` +
    `Min Alerts Required: *${currentSettings.minAlertsForTrend}*\n\n` +
    `The bot will notify you when a cryptocurrency forms a trend by detecting ${currentSettings.minAlertsForTrend} or more alerts ` +
    `in the same direction (up or down) within a ${currentSettings.trendDetectionWindowMinutes}-minute window.`;
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up old alerts
  for (const [symbol, alerts] of recentAlerts.entries()) {
    const validAlerts = alerts.filter(a => now - a.timestamp <= settings.trendDetectionWindow);
    if (validAlerts.length === 0) {
      recentAlerts.delete(symbol);
    } else {
      recentAlerts.set(symbol, validAlerts);
    }
  }
  
  // Clean up old reported trends
  for (const [key, timestamp] of reportedTrends.entries()) {
    if (now - timestamp > settings.trendDetectionWindow * 2) {
      reportedTrends.delete(key);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

module.exports = {
  recordAlert,
  formatTrendMessage,
  getSettings,
  updateSettings,
  formatTrendSettingsInfo
}; 