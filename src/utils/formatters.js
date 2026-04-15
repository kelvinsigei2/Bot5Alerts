/**
 * Utility functions for formatting messages
 */

// Format price change message
const formatPriceChange = (symbol, currentPrice, previousPrice, timeInterval) => {
  const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
  const isPositive = changePercent > 0;
  const emoji = isPositive ? '🚀' : '📉';
  const changeDirection = isPositive ? 'increased' : 'decreased';
  
  return `${emoji} *PRICE ALERT* ${emoji}\n\n` +
    `*${symbol}* has ${changeDirection} by *${Math.abs(changePercent).toFixed(2)}%* in the last ${timeInterval} minutes!\n\n` +
    `Previous Price: $${previousPrice.toFixed(4)}\n` +
    `Current Price: $${currentPrice.toFixed(4)}\n` +
    `Change: ${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`;
};

// Format top gainers or losers
const formatTopMovers = (pairs, isGainers = true) => {
  const title = isGainers ? '🔝 *TOP GAINERS (1h)* 🔝' : '🔻 *TOP LOSERS (1h)* 🔻';
  const emoji = isGainers ? '📈' : '📉';
  
  let message = `${title}\n\n`;
  
  pairs.forEach((pair, index) => {
    const changeText = isGainers ? 
      `+${pair.priceChangePercent}%` : 
      `${pair.priceChangePercent}%`;
    
    message += `${index + 1}. ${emoji} *${pair.symbol}*: ${changeText} ($${pair.lastPrice})\n`;
  });
  
  return message;
};

// Format 24h performance
const format24hPerformance = (pairs) => {
  let message = '📊 *24 HOUR MARKET PERFORMANCE* 📊\n\n';
  
  pairs.forEach((pair, index) => {
    const changeEmoji = parseFloat(pair.priceChangePercent) >= 0 ? '📈' : '📉';
    const volumeInMillions = (parseFloat(pair.volume) / 1000000).toFixed(2);
    
    message += `${index + 1}. ${changeEmoji} *${pair.symbol}*\n` +
      `   Price: $${parseFloat(pair.lastPrice).toFixed(4)}\n` +
      `   Change: ${pair.priceChangePercent}%\n` +
      `   Volume: $${volumeInMillions}M\n` +
      `   High: $${parseFloat(pair.highPrice).toFixed(4)}\n` +
      `   Low: $${parseFloat(pair.lowPrice).toFixed(4)}\n\n`;
  });
  
  return message;
};

module.exports = {
  formatPriceChange,
  formatTopMovers,
  format24hPerformance
}; 