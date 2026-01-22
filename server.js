import express from 'express';
import cors from 'cors';
import { MatchaBot } from './bot.js';
import { SheetsReader } from './sheets.js';
import config from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let bot = null;
let isRunning = false;

// Endpoint untuk start bot
app.post('/api/start', async (req, res) => {
  if (isRunning) {
    return res.status(400).json({ error: 'Bot is already running' });
  }

  const { sheetName, startRow, maxRows } = req.body;

  if (!sheetName) {
    return res.status(400).json({ error: 'Sheet name is required' });
  }

  isRunning = true;
  res.json({ message: 'Bot started - check terminal for progress', status: 'running' });

  // Run bot in background
  (async () => {
    try {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🤖 Initializing bot...');
      
      bot = new MatchaBot();
      await bot.initialize();
      console.log('✅ Browser initialized');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 PLEASE LOGIN MANUALLY IN THE BROWSER');
      console.log('Bot will wait up to 5 minutes for you to login...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      const loginSuccess = await bot.login();
      
      if (!loginSuccess) {
        console.log('❌ Login timeout or failed!');
        throw new Error('Login failed or timeout');
      }
      
      console.log('✅ Login detected! Starting automation...\n');

      console.log(`📊 Reading sheet: ${sheetName}`);
      const sheetsReader = new SheetsReader(config.googleSheetId);
      const rows = await sheetsReader.readSheet(sheetName, startRow, maxRows);
      console.log(`✅ Found ${rows.length} rows to process\n`);

      let successCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        if (!isRunning) {
          console.log('⏸️ Bot stopped by user');
          break;
        }

        const row = rows[i];
        console.log(`📝 Processing row ${row.rowNumber} (${i + 1}/${rows.length})...`);
        
        const result = await bot.processRow(row.data);
        
        if (result.status === 'success') {
          successCount++;
          console.log(`✅ Row ${row.rowNumber}: ${result.message}`);
        } else if (result.status === 'skipped') {
          skippedCount++;
          console.log(`⏭️ Row ${row.rowNumber}: Skipped - ${result.reason}`);
        } else {
          failedCount++;
          console.log(`❌ Row ${row.rowNumber}: Failed - ${result.reason}`);
        }
        console.log('');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 Bot finished!');
      console.log(`✅ Success: ${successCount}`);
      console.log(`⏭️ Skipped: ${skippedCount}`);
      console.log(`❌ Failed: ${failedCount}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
      console.log(`❌ Bot error: ${error.message}`);
      console.error('Full error:', error);
    } finally {
      if (bot) {
        await bot.close();
        console.log('🔒 Browser closed\n');
      }
      isRunning = false;
    }
  })();
});

app.post('/api/stop', async (req, res) => {
  console.log('⏸️ Stop request received');
  isRunning = false;
  if (bot) {
    await bot.close();
    bot = null;
  }
  res.json({ message: 'Bot stopped' });
});

app.get('/api/status', (req, res) => {
  res.json({ isRunning });
});

app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Matcha Pro AutoFill Bot');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log('🌐 Open in browser to start');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});