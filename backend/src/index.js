import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

let db = null;

try {
  const possiblePaths = [
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(process.cwd(), 'serviceAccountKey.json'),
    '/opt/render/project/src/backend/serviceAccountKey.json',
    '/opt/render/project/src/serviceAccountKey.json'
  ];

  let resolvedPath = null;
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      resolvedPath = filePath;
      break;
    }
  }

  if (!resolvedPath) {
    throw new Error('serviceAccountKey.json not found in any checked directory.');
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
  console.warn('⚠️ Firestore persistence is disabled.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dailyUsageTracker = new Map();
const DEFAULT_KEY = process.env.GOOGLE_API_KEY;

// 1. Analyze Endpoint
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
        error: 'You have reached your daily limit of 3 free baseline summaries.',
      });
    }

    usage.count += 1;
  }

  try {
    const prompt = `
      You are ClearClause, an elite AI legal literacy and digital protection engine built for South Africa.
      
      Perform a rigorous, uncompromising legal audit of the following document against South African legislation, specifically focusing on:
      1. **POPI Act (Act No. 4 of 2013):** Unlawful personal info processing, lack of explicit/opt-in consent for direct marketing, indefinite data retention, and unencrypted cross-border data transfers.
      2. **Consumer Protection Act (CPA):** Unconscionable terms, blanket liability waivers for gross negligence, unilateral contract alterations, and hidden fee clauses.
      3. **BCEA (Basic Conditions of Employment Act):** Illegal wage deductions, unreasonable restraint of trade, or unlawful working hour clauses (if employment-related).

      CRITICAL AUDIT RULES:
      - **Zero Fluff Filter:** Do NOT include clauses that are fully compliant or safe. Only extract clauses that contain potential legal risks, ambiguities, unfair power imbalances, or direct statutory violations.
      - **Precise Attribution:** Every explanation must explicitly pinpoint the exact clause reference and state which legal principle or act it breaches.

      Respond strictly with a valid JSON object in this exact format (no markdown code blocks, pure JSON):
      {
        "detectedTitle": "[Inferred title or document name]",
        "detectedDocType": "[Detected document type e.g. Terms of Service, Employment Contract, Lease Agreement]",
        "complianceLevel": "[Low Risk (Compliant) | Moderate Risk | High Risk | Critical Violation]",
        "clusterMatch": "[Matched structural cluster e.g. Data Privacy & Indemnity]",
        "summary": "[Punchy, high-impact executive summary in 3 to 6 lines explaining the overarching danger or safety status]",
        "clauses": [
          {
            "clauseNumber": "[Exact reference e.g. Clause 4.2]",
            "title": "[Short descriptive risk title]",
            "tag": "[Moderate | Unclear | Violation]",
            "color": "[Yellow | Orange | Red]",
            "reason": "[Thorough, authoritative explanation starting strictly with 'From clause X.X: ...' detailing why this breaches SA law or harms the user]"
          }
        ],
        "verdict": "[Actionable warning or recommended next step for the user]"
      }

      Document text:
      ${documentText}
    `;

    const ai = new GoogleGenAI({ apiKey: activeApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });
    
    let rawText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (parseErr) {
      parsedData = { summary: rawText, clauses: [] };
    }

    res.json({ success: true, tierUsed, data: parsedData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Save Scan Endpoint
app.post('/api/save-scan', async (req, res) => {
  const { email, scanData } = req.body;
  if (!email || !scanData || !db) {
    return res.status(400).json({ success: false, error: 'Missing required data or DB offline.' });
  }

  try {
    await db.collection('saved_scans').add({
      email,
      fileName: scanData.detectedTitle || 'Terms of Service',
      complianceLevel: scanData.complianceLevel || 'Moderate Risk',
      summary: scanData.summary || '',
      clauses: scanData.clauses || [],
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true, message: 'Scan saved!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. History Endpoint
app.get('/api/history', async (req, res) => {
  const { email } = req.query;
  if (!email || !db) return res.json({ success: true, history: [] });

  try {
    const snapshot = await db.collection('saved_scans')
      .where('email', '==', email)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`ClearClause backend running on port ${PORT}`));