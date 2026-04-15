/**
 * In-memory store for user settings and monitoring data
 */

const config = require('../config/config');

// Store for user settings
const userSettings = new Map();
// Store for price history - Map of symbol => array of price history objects
const priceHistory = new Map();
// Store for monitored pairs
const monitoredPairs = new Set();
// Store for recent price data with faster access (for reducing notification delay)
const recentPriceCache = new Map();
// Store for the last sent alerts to prevent duplicate alerts
const lastAlertSent = new Map();

// Get or create user settings
const getUserSettings = (userId) => {
  if (!userSettings.has(userId)) {
    userSettings.set(userId, {
      alertThreshold: config.defaultAlertThreshold,
      timeInterval: config.defaultTimeInterval
    });
  }
  return userSettings.get(userId);
};

// Update user settings
const updateUserSettings = (userId, settings) => {
  const currentSettings = getUserSettings(userId);
  userSettings.set(userId, { ...currentSettings, ...settings });
  return userSettings.get(userId);
};

// Add price data to history with optimized storage
const addPriceData = (symbol, price, timestamp = Date.now()) => {
  // Validate price before storing (prevent invalid data)
  if (!price || isNaN(price) || price <= 0) {
    console.error(`[ERROR] Attempted to store invalid price for ${symbol}: ${price}`);
    return false;
  }
  
  // Check for extreme price changes (possible data error)
  // Get most recent price for comparison
  let lastPriceObj = null;
  if (recentPriceCache.has(symbol)) {
    const symbolCache = recentPriceCache.get(symbol);
    if (symbolCache.size > 0) {
      // Get the most recent entry
      const sortedKeys = Array.from(symbolCache.keys()).sort((a, b) => b - a);
      if (sortedKeys.length > 0) {
        lastPriceObj = symbolCache.get(sortedKeys[0]);
      }
    }
  }
  
  // If we have a previous price, check for extreme changes
  if (lastPriceObj && lastPriceObj.price > 0) {
    const priceChangePercent = Math.abs((price - lastPriceObj.price) / lastPriceObj.price * 100);
    
    // If price suddenly changes by more than 30% in less than 2 minutes, it's likely wrong data
    if (priceChangePercent > 30 && (timestamp - lastPriceObj.timestamp) < 120000) {
      console.error(`[WARNING] Potential erroneous price data for ${symbol}:`, {
        newPrice: price.toFixed(6),
        lastPrice: lastPriceObj.price.toFixed(6),
        changePercent: priceChangePercent.toFixed(2) + '%',
        timeDiff: `${((timestamp - lastPriceObj.timestamp) / 1000).toFixed(1)} seconds`
      });
      
      // Don't store potentially erroneous data
      if (priceChangePercent > 50) {
        console.error(`[ERROR] Rejected extreme price change for ${symbol} (${priceChangePercent.toFixed(2)}%)`);
        return false;
      }
    }
  }
  
  // Update the recent price cache for immediate access
  if (!recentPriceCache.has(symbol)) {
    recentPriceCache.set(symbol, new Map());
  }
  
  const symbolCache = recentPriceCache.get(symbol);
  
  // Store by minute to reduce redundant data points
  const minuteKey = Math.floor(timestamp / 60000);
  symbolCache.set(minuteKey, { price, timestamp });
  
  // Cleanup old entries from cache (keep last 15 minutes)
  const cutoffMinute = Math.floor((Date.now() - (15 * 60 * 1000)) / 60000);
  for (const [minute] of symbolCache.entries()) {
    if (minute < cutoffMinute) {
      symbolCache.delete(minute);
    }
  }
  
  // Also store in the full history (for longer timeframes)
  if (!priceHistory.has(symbol)) {
    priceHistory.set(symbol, []);
  }
  
  const history = priceHistory.get(symbol);
  
  // Only add to main history every 30 seconds to avoid excessive memory usage
  const shouldAddToMainHistory = history.length === 0 || 
    (timestamp - history[history.length - 1].timestamp) >= 30000;
  
  if (shouldAddToMainHistory) {
    history.push({ price, timestamp });
    
    // Keep only the last 24 hours of data and optimize storage
    // by removing points that are too close together when older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Filter with optimization logic
    const optimizedHistory = [];
    let lastAddedTimestamp = 0;
    
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      
      // Skip if too old
      if (item.timestamp < oneDayAgo) continue;
      
      // For data older than 1 hour, only keep points that are at least 5 minutes apart
      const minTimeDiff = item.timestamp < oneHourAgo ? 5 * 60 * 1000 : 0;
      
      if (i === 0 || item.timestamp - lastAddedTimestamp >= minTimeDiff) {
        optimizedHistory.push(item);
        lastAddedTimestamp = item.timestamp;
      }
    }
    
    priceHistory.set(symbol, optimizedHistory);
  }
  
  return { recent: symbolCache.size, historical: priceHistory.get(symbol).length };
};

// Get price history for a symbol with fast cache access
const getPriceHistory = (symbol, minutes = 60) => {
  // For very recent history (≤ 10 minutes), use the optimized cache
  if (minutes <= 10 && recentPriceCache.has(symbol)) {
    const symbolCache = recentPriceCache.get(symbol);
    const timeAgo = Math.floor((Date.now() - (minutes * 60 * 1000)) / 60000);
    
    // Convert cache to array and sort by timestamp
    const recentHistory = [];
    for (const [minute, data] of symbolCache.entries()) {
      if (minute >= timeAgo) {
        recentHistory.push(data);
      }
    }
    
    return recentHistory.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  // For longer history, use the main price history
  if (!priceHistory.has(symbol)) {
    return [];
  }
  
  const history = priceHistory.get(symbol);
  const timeAgo = Date.now() - (minutes * 60 * 1000);
  
  return history.filter(item => item.timestamp >= timeAgo);
};

// Get the previous price for a symbol from N minutes ago
const getPreviousPrice = (symbol, minutes) => {
  // Validate input
  if (!symbol || !minutes || minutes <= 0) {
    console.error(`[ERROR] Invalid parameters for getPreviousPrice: symbol=${symbol}, minutes=${minutes}`);
    return null;
  }
  
  // For debugging special case
  const isTUSDT = symbol === 'TUSDT';
  if (isTUSDT) {
    console.log(`[DEBUG] Getting previous price for ${symbol} ${minutes} minutes ago`);
  }
  
  // Get current price first for validation
  let currentPrice = null;
  if (recentPriceCache.has(symbol)) {
    const symbolCache = recentPriceCache.get(symbol);
    if (symbolCache.size > 0) {
      // Get the most recent entry
      const mostRecentMinute = Math.max(...symbolCache.keys());
      currentPrice = symbolCache.get(mostRecentMinute).price;
      
      if (isTUSDT) {
        console.log(`[DEBUG] ${symbol} current price: ${currentPrice}`);
      }
    }
  }
  
  // For faster access of recent data
  if (minutes <= 10 && recentPriceCache.has(symbol)) {
    const symbolCache = recentPriceCache.get(symbol);
    const targetMinute = Math.floor((Date.now() - (minutes * 60 * 1000)) / 60000);
    
    if (isTUSDT) {
      console.log(`[DEBUG] ${symbol} looking for target minute: ${targetMinute}`);
      console.log(`[DEBUG] ${symbol} available minutes: ${Array.from(symbolCache.keys()).sort()}`);
    }
    
    // Try to find the exact minute first
    if (symbolCache.has(targetMinute)) {
      const price = symbolCache.get(targetMinute).price;
      
      if (isTUSDT) {
        console.log(`[DEBUG] ${symbol} found exact minute match with price: ${price}`);
      }
      
      // Validate against current price
      if (currentPrice && Math.abs((price - currentPrice) / currentPrice) > 0.5) { // 50% difference
        console.error(`[ERROR] Suspicious previous price for ${symbol}: ${price} vs current ${currentPrice}`);
        return null;
      }
      
      return price;
    }
    
    // If not found, find the closest earlier minute
    let closestMinute = null;
    let closestDistance = Infinity;
    
    for (const [minute, data] of symbolCache.entries()) {
      // Only consider minutes before or equal to target (we want prior price)
      if (minute <= targetMinute) {
        const distance = targetMinute - minute;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestMinute = minute;
        }
      }
    }
    
    if (closestMinute !== null) {
      const price = symbolCache.get(closestMinute).price;
      
      if (isTUSDT) {
        console.log(`[DEBUG] ${symbol} found closest minute ${closestMinute} with price: ${price}`);
        console.log(`[DEBUG] ${symbol} closest minute is ${closestDistance} minutes away from target`);
      }
      
      // If closest minute is too far from target, it might not be valid for comparison
      if (closestDistance > minutes * 2) {
        console.warn(`[WARNING] ${symbol}: Closest data point is too old (${closestDistance} minutes off)`);
        
        if (isTUSDT) {
          console.log(`[DEBUG] ${symbol} closest point too far, will try historical data`);
        }
      } else {
        // Validate against current price 
        if (currentPrice && Math.abs((price - currentPrice) / currentPrice) > 0.5) { // 50% difference
          console.error(`[ERROR] Suspicious previous price for ${symbol}: ${price} vs current ${currentPrice}`);
          return null;
        }
        
        return price;
      }
    }
  }
  
  // Fall back to the regular method for longer time periods
  const history = getPriceHistory(symbol, minutes + 1); // Add 1 minute buffer
  
  if (history.length === 0) {
    if (isTUSDT) {
      console.log(`[DEBUG] ${symbol} no historical data found`);
    }
    return null;
  }
  
  // Find the price closest to N minutes ago
  const targetTime = Date.now() - (minutes * 60 * 1000);
  const closest = history.reduce((prev, curr) => {
    return (Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime)) ? curr : prev;
  });
  
  if (isTUSDT) {
    console.log(`[DEBUG] ${symbol} found historical price: ${closest.price}`);
    console.log(`[DEBUG] ${symbol} historical price timestamp difference: ${Math.abs(closest.timestamp - targetTime)/60000} minutes`);
  }
  
  // If the closest data point is too far from our target time, it might not be valid
  const minutesDiff = Math.abs(closest.timestamp - targetTime) / (60 * 1000);
  if (minutesDiff > minutes * 1.5) {
    console.warn(`[WARNING] ${symbol}: Closest historical point is ${minutesDiff.toFixed(1)} minutes off from target`);
  }
  
  // Validate against current price 
  if (currentPrice && Math.abs((closest.price - currentPrice) / currentPrice) > 0.5) { // 50% difference
    console.error(`[ERROR] Suspicious historical price for ${symbol}: ${closest.price} vs current ${currentPrice}`);
    return null;
  }
  
  return closest.price;
};

// Check if an alert should be sent (to avoid duplicate alerts)
const shouldSendAlert = (userId, symbol, threshold, timeInterval) => {
  const now = Date.now();
  const key = `${userId}-${symbol}-${threshold}-${timeInterval}`;
  
  // If we haven't sent an alert for this combination before, send it
  if (!lastAlertSent.has(key)) {
    lastAlertSent.set(key, now);
    return true;
  }
  
  // Only send a new alert if enough time has passed (half of the time interval)
  const lastTime = lastAlertSent.get(key);
  const minDelay = (timeInterval * 60 * 1000) / 2;
  
  if (now - lastTime >= minDelay) {
    lastAlertSent.set(key, now);
    return true;
  }
  
  return false;
};

// Add a pair to monitored list
const addMonitoredPair = (symbol) => {
  monitoredPairs.add(symbol);
  return Array.from(monitoredPairs);
};

// Remove a pair from monitored list
const removeMonitoredPair = (symbol) => {
  monitoredPairs.delete(symbol);
  recentPriceCache.delete(symbol); // Clean up cache when pair is removed
  priceHistory.delete(symbol); // Clean up history when pair is removed
  return Array.from(monitoredPairs);
};

// Get all monitored pairs
const getMonitoredPairs = () => {
  return Array.from(monitoredPairs);
};

// Cleanup old data periodically
const cleanupOldData = () => {
  const now = Date.now();
  
  // Clean up last alert timestamps
  for (const [key, timestamp] of lastAlertSent.entries()) {
    // Remove entries older than 1 hour
    if (now - timestamp > 60 * 60 * 1000) {
      lastAlertSent.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupOldData, 5 * 60 * 1000);

module.exports = {
  getUserSettings,
  updateUserSettings,
  addPriceData,
  getPriceHistory,
  getPreviousPrice,
  shouldSendAlert,
  addMonitoredPair,
  removeMonitoredPair,
  getMonitoredPairs
}; 