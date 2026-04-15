require('dotenv').config();

const telegramToken = (
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_TOKEN ||
  process.env.BOT_TOKEN
);

module.exports = {
  telegramToken: telegramToken ? telegramToken.trim() : '',
  binanceApiKey: process.env.BINANCE_API_KEY,
  binanceApiSecret: process.env.BINANCE_API_SECRET,
  defaultAlertThreshold: 5, // 5% price change by default
  defaultTimeInterval: 5, // 5 minutes by default
  minAlertThreshold: 1,
  maxAlertThreshold: 10,
  minTimeInterval: 1, // Changed to 1 minute minimum
  maxTimeInterval: 20 // Changed to 20 minutes maximum
}; 