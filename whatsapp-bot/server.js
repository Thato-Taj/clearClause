require('dotenv').config();
const express = require('express');
const telegramRouter = require('./telegram'); // Points to your Telegram handler file

const app = express();

// Telegram webhooks send JSON payloads
app.use(express.json());

// Mount Telegram webhook route
app.use('/api/telegram', telegramRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ClearClause Telegram bot running on port ${PORT}`);
});