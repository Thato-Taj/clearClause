import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';
import { createRequire } from 'module';

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the root backend folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const require = createRequire(import.meta.url);
const tgModule = require('node-telegram-bot-api');
const TelegramBot = tgModule.default || tgModule;

let db = null;

try {
  // Check all possible locations where Render Secret Files or local dev might place the file
  const possiblePaths = [
    path.join(__dirname, 'serviceAccountKey.json'),           // Local dev (inside src/)
    path.join(__dirname, '../serviceAccountKey.json'),        // Render root of backend package
    path.join(process.cwd(), 'serviceAccountKey.json'),       // Process current working directory
    '/opt/render/project/src/backend/serviceAccountKey.json', // Absolute Render path
    '/opt/render/project/src/serviceAccountKey.json'          // Render Secret Files root mount
  ];

  let resolvedPath = null;
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      resolvedPath = filePath;
      break;
    }
  }

  if (!resolvedPath) {
    throw new Error('serviceAccountKey.json not found in any checked directory. Make sure you added it as a Render Secret File.');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  db = admin.firestore();
  console.log(`🔥 Connected to Firestore successfully using key at: ${resolvedPath}`);
} catch (e) {
  console.error('❌ Firestore Initialization Error:', e.message);
  console.warn('⚠️ Firestore persistence is disabled due to the error above.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dailyUsageTracker = new Map();
const DEFAULT_KEY = process.env.GOOGLE_API_KEY;

// 1. Analyze Endpoint (Evaluates contract without automatic database writes)
app.post('/api/analyze', async (req, res) => {
  const { 
    documentText, 
    docType = 'Terms of Service', 
    targetLanguage = 'English', 
    customApiKey, 
    clientIdentifier 
  } = req.body;

  if (!documentText) {
    return res.status(400).json({ success: false, error: 'Document text is required.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const userKey = clientIdentifier || 'anonymous-user';

  let activeApiKey = DEFAULT_KEY;
  let tierUsed = 'Base Tier (Free)';

  if (customApiKey && customApiKey.trim().length > 10) {
    activeApiKey = customApiKey.trim();
    if (activeApiKey.startsWith('sk-ant-')) {
      tierUsed = 'Custom Anthropic Key (BYOK)';
    } else if (activeApiKey.startsWith('xai-')) {
      tierUsed = 'Custom xAI Grok Key (BYOK)';
    } else if (activeApiKey.startsWith('sk-')) {
      tierUsed = 'Custom OpenAI Key (BYOK)';
    } else {
      tierUsed = 'Custom Google Key (BYOK)';
    }
  } else {
    if (!dailyUsageTracker.has(userKey)) {
      dailyUsageTracker.set(userKey, { date: todayStr, count: 0 });
    }

    const usage = dailyUsageTracker.get(userKey);
    if (usage.date !== todayStr) {
      usage.date = todayStr;
      usage.count = 0;
    }

    if (usage.count >= 3) {
      return res.status(429).json({
        success: false,
        error: 'You have reached your daily limit of 3 free baseline summaries. Please enter your own API key to continue scanning unlimited documents.',
      });
    }

    usage.count += 1;
  }

  try {
    let rawText = '{}';

    const prompt = `
      You are ClearClause, an elite AI legal literacy and digital protection engine built for South Africa.
      
      Perform a rigorous, uncompromising audit of the following document using a strict two-step internal process:
      
      STEP 1 (Strict English Legal Analysis & Compliance Categorization): 
      - Perform the entire legal evaluation and compliance check against the POPI Act (Act No. 4 of 2013), BCEA, and CPA **strictly in English** to guarantee absolute consistency.
      - Detect the actual document title and document type of the provided text and compare it against the user's selected document type (${docType}). If they do not match, prepend a clear warning message.
      - Assign an overall **complianceLevel** strictly choosing from: "Low Risk (Compliant)", "Moderate Risk", "High Risk", or "Critical Violation".
      - **CRITICAL FILTER REQUIREMENT:** Do NOT include clauses that are fully compliant or safe. Only include clauses that contain potential risks, moderate issues, unclear terms, or violations.
      
      STEP 2 (Target Language Output Rendering):
      - Translate descriptive text fields fluently into the requested output language: **${targetLanguage}**.

      You must respond strictly with a valid JSON object in this exact format (no markdown code blocks, pure JSON):
      {
        "detectedTitle": "[Inferred title]",
        "detectedDocType": "[Detected document type]",
        "complianceLevel": "[Low Risk (Compliant) | Moderate Risk | High Risk | Critical Violation]",
        "clusterMatch": "[Matched structural cluster]",
        "summary": "[Punchy summary in 3 to 6 lines]",
        "clauses": [
          {
            "clauseNumber": "[Exact reference, e.g. Clause 1.1]",
            "title": "[Short descriptive title]",
            "tag": "[Moderate | Unclear | Violation]",
            "color": "[Yellow | Orange | Red]",
            "reason": "[Thorough explanation starting strictly with 'From clause X.X: ...']"
          }
        ],
        "verdict": "[Warning or next step]"
      }

      Document text:
      ${documentText}
    `;

    // Multi-provider routing (Gemini default)
    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });
    rawText = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || '{}';

    const currentUsage = dailyUsageTracker.get(userKey);
    const scansRemaining = tierUsed.includes('BYOK') ? 'Unlimited' : Math.max(0, 3 - (currentUsage ? currentUsage.count : 0));

    let parsedData;
    try {
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch (parseErr) {
      parsedData = {
        detectedTitle: `${docType} Scan`,
        detectedDocType: docType,
        complianceLevel: "Moderate Risk",
        clusterMatch: "General Contract Cluster",
        summary: rawText,
        clauses: [],
        verdict: "⚠️ Review carefully before signing."
      };
    }

    if (parsedData && Array.isArray(parsedData.clauses)) {
      parsedData.clauses = parsedData.clauses.filter(clause => {
        const color = (clause.color || '').toLowerCase();
        const tag = (clause.tag || '').toLowerCase();
        return color !== 'green' && tag !== 'compliant';
      });
    }

    res.json({
      success: true,
      tierUsed,
      scansRemaining,
      data: parsedData,
    });

  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: `Analysis failed: ${error.message}` 
    });
  }
});

// 2. Dedicated Save Scan Endpoint (Triggered ONLY when user clicks 'Save Scan')
app.post('/api/save-scan', async (req, res) => {
  const { email, scanData } = req.body;

  if (!email || !scanData) {
    return res.status(400).json({ success: false, error: 'User email and scan data are required.' });
  }

  if (!db) {
    return res.status(500).json({ success: false, error: 'Database persistence is offline.' });
  }

  try {
    const scansRef = db.collection('saved_scans');
    
    // Save record to Firestore
    await scansRef.add({
      email,
      fileName: scanData.detectedTitle || 'Terms of Service',
      docType: scanData.detectedDocType || 'Terms of Service',
      clusterMatch: scanData.clusterMatch || 'General',
      complianceLevel: scanData.complianceLevel || 'Moderate Risk',
      summary: scanData.summary || '',
      verdict: scanData.verdict || '',
      clauses: scanData.clauses || [],
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Prune history to keep only the latest 5 records per user
    const snapshot = await scansRef
      .where('email', '==', email)
      .orderBy('timestamp', 'desc')
      .get();

    if (snapshot.size > 5) {
      const batch = db.batch();
      const docsToDelete = snapshot.docs.slice(5);
      docsToDelete.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    res.json({ success: true, message: 'Scan successfully saved to Firestore!' });
  } catch (err) {
    console.error('Firestore Save Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. History Endpoint
app.get('/api/history', async (req, res) => {
  const { email } = req.query;
  if (!email || !db) {
    return res.json({ success: true, history: [] });
  }

  try {
    const snapshot = await db.collection('saved_scans')
      .where('email', '==', email)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    const history = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
      };
    });

    res.json({ success: true, history });
  } catch (err) {
    console.error('Firestore History Fetch Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Telegram Bot Integration ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (TELEGRAM_TOKEN) {
  const telegramBot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  telegramBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    telegramBot.sendMessage(
      chatId, 
      "🛡️ *Welcome to ClearClause AI*!\n\nSend or paste any terms of service, contract, or policy text here, and I will audit it for POPI Act risks and hidden clauses instantly.",
      { parse_mode: 'Markdown' }
    );
  });

  telegramBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    try {
      telegramBot.sendMessage(chatId, "🔍 Analyzing document clauses for risks...");

      const ai = new GoogleGenAI({ apiKey: DEFAULT_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are ClearClause, an elite AI legal literacy and digital protection engine built for South Africa. Perform a rigorous audit of the following document text, highlighting POPI Act risks and problematic clauses concisely.\n\nDocument text:\n${text}`,
      });

      const auditResult = response.text || "Analysis completed.";
      telegramBot.sendMessage(chatId, `📋 *ClearClause Audit*\n\n${auditResult}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram Bot Error:', err);
      telegramBot.sendMessage(chatId, "❌ Sorry, an error occurred while processing your document scan.");
    }
  });

  console.log('🤖 Telegram bot initialized and listening.');
} else {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN missing. Telegram bot is disabled.');
}

const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => console.log(`ClearClause backend running on port ${PORT}`));