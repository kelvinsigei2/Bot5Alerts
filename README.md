# Binance Futures Alert Bot

A Telegram bot that monitors Binance cryptocurrency prices and sends alerts when significant price movements occur.

## Features

- Real-time price alerts using WebSocket connections with REST API fallback
- Customizable alert thresholds and time intervals
- Price change verification to avoid false alerts
- Top gainers/losers in the last hour
- 24-hour market performance analysis
- User-friendly Telegram interface with inline keyboards

## Deployment to Railway

This project is already configured for Railway with:

- `railway.json` (Nixpacks build + deploy settings)
- `Procfile` (fallback start command)
- `start.sh` (startup script)
- `src/health.js` (`/health` endpoint for Railway checks)

### Manual Deployment (Recommended)

1. Push this project to a GitHub repository.
2. Go to [Railway](https://railway.app/) and create a new project.
3. Select **Deploy from GitHub repo**.
4. Choose your repository.
5. Add environment variables in Railway:
   - `TELEGRAM_BOT_TOKEN` (required): your bot token from BotFather
   - `BINANCE_API_KEY` (optional)
   - `BINANCE_API_SECRET` (optional)
6. Deploy.

### Verify Deployment

After Railway deploys:

1. Open the service logs and confirm:
   - health check server starts
   - bot initialization completes
2. Open your Railway app URL and check `/health`.
3. Open Telegram and send `/start` to your bot.

### Common Railway Notes

- Railway will provide `PORT` automatically.
- Do not commit your local `.env` file; set variables in Railway instead.
- If your deploy fails, check logs first for missing environment variables.

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file using the `.env.example` template
4. Start the bot:
   ```
   npm start
   ```
   
## Commands

- `/start` - Initialize the bot and display the main menu
- `/help` - Show help information
- `/settings` - Configure alert settings
- `/pairs` - Manage monitored pairs
- `/topgainers` - View top gainers in the last hour
- `/toplosers` - View top losers in the last hour
- `/performance` - View 24-hour market performance
- `/refresh` - Refresh price data for all pairs
- `/refresh SYMBOL` - Refresh specific symbol data (e.g., `/refresh BTCUSDT`)

## Troubleshooting

If you encounter any issues with the deployment:

1. Check Railway logs for errors
2. Ensure all environment variables are correctly set
3. Verify that your Telegram bot token is valid
4. If using Binance API keys, ensure they have the necessary permissions (read-only is sufficient)

## License

MIT 