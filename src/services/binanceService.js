/**
 * Service for interacting with Binance API
 */

const Binance = require('binance-api-node').default;
const config = require('../config/config');
const store = require('../utils/store');

// Initialize Binance client
const client = Binance({
  apiKey: config.binanceApiKey,
  apiSecret: config.binanceApiSecret,
  // Add requestOptions for better timeout handling
  httpOptions: {
    timeout: 15000, // 15 seconds timeout for API calls
  }
});

// Cache for price data to reduce API calls
const priceCache = {
  lastUpdated: 0,
  data: {},
  // Cache lifetime in milliseconds (5 seconds)
  maxAge: 5000
};

// WebSocket connection tracking
let wsConnection = null;
let wsFailureCount = 0;
const MAX_WS_FAILURES = 3;
let webSocketEnabled = true;

// Disable WebSocket usage (for fallback mode)
const disableWebSocket = () => {
  webSocketEnabled = false;
  
  // Close any existing WebSocket connection
  if (wsConnection) {
    console.log('Closing existing WebSocket connection');
    wsConnection();
    wsConnection = null;
  }
  
  console.log('WebSocket functionality disabled. Using REST API only.');
  return true;
};

// Get all futures USDT pairs
const getFuturesUSDTPairs = async () => {
  try {
    // Use client.exchangeInfo instead of client.futuresExchangeInfo
    const exchangeInfo = await client.exchangeInfo();
    
    // Filter for USDT pairs only
    const usdtPairs = exchangeInfo.symbols
      .filter(symbol => symbol.quoteAsset === 'USDT' && symbol.status === 'TRADING')
      .map(symbol => symbol.symbol);
    
    return usdtPairs;
  } catch (error) {
    console.error('Error fetching futures pairs:', error);
    return [];
  }
};

// Get current price for a symbol - with forced API refresh for specific symbols
const getCurrentPrice = async (symbol, forceApiCall = false) => {
  try {
    // Special verification for TUSDT and other specific symbols that have issues
    const needsVerification = symbol === 'TUSDT' || forceApiCall;
    
    // Check cache first if not forcing API call
    if (!needsVerification && priceCache.data[symbol] && Date.now() - priceCache.lastUpdated < priceCache.maxAge) {
      return parseFloat(priceCache.data[symbol]);
    }
    
    // Log special debugging for TUSDT
    if (symbol === 'TUSDT') {
      console.log(`[DEBUG] Making direct API call to verify TUSDT price`);
    }
    
    // Bypass cache and get fresh data from API
    const ticker = await client.prices({ symbol });
    const freshPrice = parseFloat(ticker[symbol]);
    
    // Update cache
    priceCache.data[symbol] = freshPrice;
    
    if (symbol === 'TUSDT') {
      console.log(`[DEBUG] Direct API call for TUSDT returned price: ${freshPrice}`);
    }
    
    return freshPrice;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    
    // Return cached value as fallback if available
    if (priceCache.data[symbol]) {
      console.log(`[FALLBACK] Using cached price for ${symbol} due to API error`);
      return parseFloat(priceCache.data[symbol]);
    }
    
    return null;
  }
};

// Get current prices for all monitored pairs with caching
const getAllPrices = async () => {
  try {
    // Check if cache is valid
    if (Date.now() - priceCache.lastUpdated < priceCache.maxAge) {
      return priceCache.data;
    }
    
    // Cache expired, fetch new data
    // Use client.prices instead of client.futuresPrices
    const tickers = await client.prices();
    
    // Update cache
    priceCache.data = tickers;
    priceCache.lastUpdated = Date.now();
    
    return tickers;
  } catch (error) {
    console.error('Error fetching all prices:', error);
    
    // Return cached data if available, even if expired
    if (Object.keys(priceCache.data).length > 0) {
      console.log('Using cached price data due to API error');
      return priceCache.data;
    }
    
    return {};
  }
};

// Use WebSocket connection for real-time price updates
const setupWebSocket = () => {
  // Skip if WebSockets are disabled
  if (!webSocketEnabled) {
    console.log('WebSocket setup skipped (WebSockets disabled)');
    return false;
  }
  
  try {
    // If there's an existing connection, close it first
    if (wsConnection) {
      wsConnection();
    }
    
    // Get the monitored pairs
    const monitoredPairs = store.getMonitoredPairs();
    if (monitoredPairs.length === 0) return;
    
    console.log(`Setting up WebSocket for ${monitoredPairs.length} pairs`);
    
    // Use regular ticker WebSocket (not futures-specific)
    try {
      // Create ticker connections for each pair
      wsConnection = monitoredPairs.map(symbol => 
        client.ws.ticker(symbol, ticker => {
          // Update price cache with real-time data
          priceCache.data[symbol] = ticker.curDayClose;
          
          // Also update price history for faster alert detection
          store.addPriceData(symbol, parseFloat(ticker.curDayClose));
        })
      );
      
      // Create a single cleanup function that closes all connections
      const originalWsConnection = wsConnection;
      wsConnection = () => {
        originalWsConnection.forEach(connection => connection());
      };
      
      console.log('WebSocket connection successfully established');
      return true;
    } catch (wsError) {
      console.error('WebSocket connection failed:', wsError);
      throw new Error('No suitable WebSocket method available');
    }
  } catch (error) {
    console.error('Error setting up WebSocket connection:', error);
    console.error('Falling back to REST API for price updates');
    return false;
  }
};

// Update price history for all monitored pairs
const updatePriceHistory = async () => {
  const monitoredPairs = store.getMonitoredPairs();
  
  if (monitoredPairs.length === 0) return;
  
  try {
    // Get all prices at once (uses cache when possible)
    const tickers = await getAllPrices();
    
    // Try WebSocket connection only if enabled
    if (webSocketEnabled) {
      // If WebSocket is not connected, try to reconnect it
      // but don't keep trying if it repeatedly fails
      if (!wsConnection && wsFailureCount < MAX_WS_FAILURES) {
        const wsConnected = setupWebSocket();
        if (!wsConnected) {
          wsFailureCount++;
          console.log(`WebSocket connection attempt failed. Attempt ${wsFailureCount}/${MAX_WS_FAILURES}`);
          
          if (wsFailureCount >= MAX_WS_FAILURES) {
            console.log('Maximum WebSocket reconnection attempts reached. Will rely on REST API only.');
          }
        } else {
          // Reset failure count on successful connection
          wsFailureCount = 0;
        }
      }
    }
    
    // Always update price history from API data as a backup/redundancy
    // even if WebSocket is working
    let updatedPairs = 0;
    for (const pair of monitoredPairs) {
      if (tickers[pair]) {
        store.addPriceData(pair, parseFloat(tickers[pair]));
        updatedPairs++;
      }
    }
    
    if (updatedPairs > 0) {
      console.log(`Updated prices for ${updatedPairs} pairs via REST API`);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating price history:', error);
    return false;
  }
};

// List of symbols with known price data issues
const PROBLEMATIC_SYMBOLS = ['TUSDT'];

// Store for historical price snapshots (for calculating percentage changes)
const priceSnapshots = {
  hourly: {
    lastUpdated: 0,
    data: {}
  }
};

// Add a symbol to the problematic symbols list
const addProblematicSymbol = (symbol) => {
  if (!PROBLEMATIC_SYMBOLS.includes(symbol)) {
    PROBLEMATIC_SYMBOLS.push(symbol);
    console.log(`[INFO] Added ${symbol} to problematic symbols list: ${PROBLEMATIC_SYMBOLS.join(', ')}`);
  }
  return PROBLEMATIC_SYMBOLS;
};

// Force refresh of all prices
const refreshAllPrices = async () => {
  // Clear cache
  priceCache.data = {};
  priceCache.lastUpdated = 0;
  
  console.log('[INFO] Price cache cleared, fetching fresh data...');
  
  try {
    // Fetch new prices using client.prices instead of client.futuresPrices
    const freshPrices = await client.prices();
    
    // Update cache
    priceCache.data = freshPrices;
    priceCache.lastUpdated = Date.now();
    
    console.log(`[INFO] Successfully refreshed prices for ${Object.keys(freshPrices).length} symbols`);
    
    // Also update price history
    const monitoredPairs = store.getMonitoredPairs();
    
    for (const pair of monitoredPairs) {
      if (freshPrices[pair]) {
        store.addPriceData(pair, parseFloat(freshPrices[pair]));
      }
    }
    
    return freshPrices;
  } catch (error) {
    console.error('[ERROR] Failed to refresh all prices:', error);
    throw error;
  }
};

// Check for price alerts
const checkPriceAlerts = async (userIds, bot) => {
  const monitoredPairs = store.getMonitoredPairs();
  const trendDetector = require('../utils/trendDetector');
  
  if (monitoredPairs.length === 0 || userIds.length === 0) return;
  
  try {
    // Get all prices at once (uses cache when possible)
    const tickers = await getAllPrices();
    const currentTime = Date.now();
    
    for (const pair of monitoredPairs) {
      if (!tickers[pair]) continue;
      
      // For problematic symbols, always verify with direct API call
      let currentPrice;
      if (PROBLEMATIC_SYMBOLS.includes(pair)) {
        console.log(`[VERIFY] Getting direct price for known problematic symbol: ${pair}`);
        currentPrice = await getCurrentPrice(pair, true); // force API call
        if (currentPrice === null) {
          console.warn(`[WARNING] Could not get verified price for ${pair}, skipping alert check`);
          continue;
        }
      } else {
        currentPrice = parseFloat(tickers[pair]);
      }
      
      for (const userId of userIds) {
        const { timeInterval, alertThreshold } = store.getUserSettings(userId);
        const previousPrice = store.getPreviousPrice(pair, timeInterval);
        
        if (!previousPrice) continue;
        
        // Special verification for price changes
        if (PROBLEMATIC_SYMBOLS.includes(pair)) {
          console.log(`[VERIFY] ${pair} price comparison:`, {
            current: currentPrice.toFixed(6),
            previous: previousPrice.toFixed(6),
            timeInterval: `${timeInterval} minutes`,
            changePercent: ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2) + '%'
          });
        }
        
        const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
        
        // Add debug logging for specific pairs with significant changes
        if (Math.abs(changePercent) > 3) {
          console.log(`[DEBUG] ${pair} price change analysis:`, {
            currentPrice: currentPrice.toFixed(6),
            previousPrice: previousPrice.toFixed(6),
            timeAgo: `${timeInterval} minutes`,
            changePercent: changePercent.toFixed(2) + '%',
            timestamp: new Date().toISOString(),
            dataSource: PROBLEMATIC_SYMBOLS.includes(pair) ? 'Direct API' : 
                        (priceCache.lastUpdated > Date.now() - 10000 ? 'Cache' : 'API')
          });
          
          // Double-verify current price with a direct API call for significant changes
          if (!PROBLEMATIC_SYMBOLS.includes(pair) && Math.abs(changePercent) >= alertThreshold) {
            try {
              console.log(`[VERIFY] Double-checking ${pair} price with direct API call...`);
              const verificationPrice = await getCurrentPrice(pair, true);
              
              if (verificationPrice) {
                const verificationChange = ((verificationPrice - previousPrice) / previousPrice) * 100;
                console.log(`[VERIFY] ${pair} verification:`, {
                  cachedPrice: currentPrice.toFixed(6),
                  verifiedPrice: verificationPrice.toFixed(6),
                  difference: (Math.abs(currentPrice - verificationPrice) / verificationPrice * 100).toFixed(2) + '%',
                  verifiedChangePercent: verificationChange.toFixed(2) + '%'
                });
                
                // Use the verified price instead if it differs significantly from cached price
                if (Math.abs(currentPrice - verificationPrice) / verificationPrice > 0.01) { // 1% difference
                  console.log(`[ALERT] Significant price discrepancy detected for ${pair}! Using verified price.`);
                  currentPrice = verificationPrice;
                  // Recalculate change percent with verified price
                  changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
                }
              }
            } catch (verifyError) {
              console.error(`[ERROR] Failed to verify price for ${pair}:`, verifyError);
            }
          }
        }
        
        // Only send alert if threshold is met
        if (Math.abs(changePercent) >= alertThreshold) {
          // Use the improved shouldSendAlert function to prevent duplicate alerts
          if (store.shouldSendAlert(userId, pair, alertThreshold, timeInterval)) {
            // Price change exceeds threshold - send alert
            const formatters = require('../utils/formatters');
            const alertMessage = formatters.formatPriceChange(
              pair, 
              currentPrice, 
              previousPrice, 
              timeInterval
            );
            
            // Log extensive details about this alert
            console.log(`[ALERT_DETAILS] ${pair} alert triggered:`, {
              userId,
              pair,
              currentPrice: currentPrice.toFixed(6),
              previousPrice: previousPrice.toFixed(6),
              changePercent: changePercent.toFixed(2) + '%',
              direction: changePercent > 0 ? 'increase' : 'decrease',
              threshold: alertThreshold + '%',
              timeInterval: timeInterval + ' minutes',
              timestamp: new Date().toISOString()
            });
            
            // Send the alert with high priority
            bot.sendMessage(userId, alertMessage, {
              parse_mode: 'Markdown',
              disable_notification: false // Ensure notification sound plays
            });
            
            console.log(`[${new Date().toISOString()}] Alert sent to user ${userId} for ${pair} - change: ${changePercent.toFixed(2)}%`);
            
            // Record this alert for trend detection
            const trend = trendDetector.recordAlert(pair, currentPrice, previousPrice, changePercent);
            
            // If a trend is detected, send a trend alert
            if (trend) {
              console.log(`[TREND] Detected trend for ${pair}: ${trend.direction}trend`);
              const trendMessage = trendDetector.formatTrendMessage(trend);
              
              // Add a small delay to ensure the trend message comes after the regular alert
              setTimeout(() => {
                bot.sendMessage(userId, trendMessage, {
                  parse_mode: 'Markdown',
                  disable_notification: false
                });
                
                console.log(`[${new Date().toISOString()}] Trend alert sent to user ${userId} for ${pair} - ${trend.direction}trend`);
              }, 1000);
            }
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking price alerts:', error);
    return false;
  }
};

// Get top gainers and losers in the last hour using direct API calls
const getTopMovers1h = async (limit = 5) => {
  try {
    const currentTime = Date.now();
    const oneHourAgo = currentTime - (60 * 60 * 1000);
    
    // Check if we need to update the hourly snapshot
    if (!priceSnapshots.hourly.lastUpdated || currentTime - priceSnapshots.hourly.lastUpdated > 60 * 60 * 1000) {
      // Store current prices as the base snapshot if we don't have recent data
      const currentPrices = await client.prices();
      priceSnapshots.hourly.data = { ...currentPrices };
      priceSnapshots.hourly.lastUpdated = currentTime;
      
      console.log('[INFO] Initialized hourly price snapshot. Will have comparison data in 1 hour.');
      return { topGainers: [], topLosers: [], message: 'Initializing price tracking. Check back in a few minutes for data.' };
    }
    
    // Get current prices
    const currentPrices = await client.prices();
    const oldPrices = priceSnapshots.hourly.data;
    
    // Calculate percentage changes for all USDT pairs
    const changes = [];
    
    for (const symbol in currentPrices) {
      // Only process USDT pairs
      if (!symbol.endsWith('USDT')) continue;
      
      const currentPrice = parseFloat(currentPrices[symbol]);
      
      // Skip if we don't have historical data for this symbol
      if (!oldPrices[symbol]) continue;
      
      const oldPrice = parseFloat(oldPrices[symbol]);
      
      // Calculate percentage change
      const priceChange = currentPrice - oldPrice;
      const priceChangePercent = (priceChange / oldPrice) * 100;
      
      changes.push({
        symbol,
        lastPrice: currentPrice.toString(),
        priceChangePercent: priceChangePercent.toFixed(2),
        priceChange: priceChange.toString()
      });
    }
    
    // Sort by percentage change
    const sortedByChange = [...changes].sort((a, b) => 
      parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
    );
    
    // Get top gainers and losers
    const topGainers = sortedByChange.slice(0, limit);
    const topLosers = sortedByChange.reverse().slice(0, limit);
    
    // Update the snapshot every 15 minutes, or if it's very old
    if (currentTime - priceSnapshots.hourly.lastUpdated > 15 * 60 * 1000) {
      priceSnapshots.hourly.data = { ...currentPrices };
      priceSnapshots.hourly.lastUpdated = currentTime;
      console.log('[INFO] Updated hourly price snapshot');
    }
    
    return { topGainers, topLosers, success: true };
  } catch (error) {
    console.error('Error fetching top movers using direct API:', error);
    return { 
      topGainers: [], 
      topLosers: [], 
      error: error.message, 
      message: 'Failed to fetch price data. Please try again later.' 
    };
  }
};

// Get top gainers and losers in the last hour
const getTopMovers = async (limit = 5) => {
  try {
    // Use client.dailyStats instead of client.futuresTicker
    const tickers = await client.dailyStats();
    
    // Filter for USDT pairs only
    const usdtPairs = tickers.filter(ticker => ticker.symbol.endsWith('USDT'));
    
    // Sort by percent change
    const sortedPairs = usdtPairs.sort((a, b) => {
      return parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent);
    });
    
    const topGainers = sortedPairs.slice(0, limit);
    const topLosers = sortedPairs.reverse().slice(0, limit);
    
    return { topGainers, topLosers };
  } catch (error) {
    console.error('Error fetching top movers:', error);
    return { topGainers: [], topLosers: [] };
  }
};

// Get 24h performance for monitored pairs
const get24hPerformance = async (limit = 10) => {
  try {
    // Use client.dailyStats instead of client.futuresTicker
    const tickers = await client.dailyStats();
    const monitoredPairs = store.getMonitoredPairs();
    
    // Filter for monitored pairs only, or use top volume pairs if none monitored
    let filteredPairs = tickers;
    
    if (monitoredPairs.length > 0) {
      filteredPairs = tickers.filter(ticker => monitoredPairs.includes(ticker.symbol));
    }
    
    // Sort by volume
    const sortedPairs = filteredPairs.sort((a, b) => {
      return parseFloat(b.volume) - parseFloat(a.volume);
    });
    
    return sortedPairs.slice(0, limit);
  } catch (error) {
    console.error('Error fetching 24h performance:', error);
    return [];
  }
};

// Initialize WebSocket connection on module load
setTimeout(() => {
  setupWebSocket();
}, 5000); // Wait 5 seconds after startup before connecting

module.exports = {
  getFuturesUSDTPairs,
  getCurrentPrice,
  getAllPrices,
  updatePriceHistory,
  checkPriceAlerts,
  getTopMovers,
  getTopMovers1h,
  get24hPerformance,
  setupWebSocket,
  disableWebSocket,
  addProblematicSymbol,
  refreshAllPrices
}; 