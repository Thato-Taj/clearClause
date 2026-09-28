import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';
import { createRequire } from 'module';

dotenv.config();

// Safely load Firebase service account key with precise error reporting
const require = createRequire(import.meta.url);
let db = null;

try {
  const serviceAccount = require('./serviceAccountKey.json');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  db = admin.firestore();
  console.log('🔥 Connected to Firestore successfully.');
} catch (e) {
  console.error('❌ Firestore Initialization Error:', e.message);
  console.warn('⚠️ Firestore persistence is disabled due to the error above.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dailyUsageTracker = new Map();
const DEFAULT_KEY = process.env.GOOGLE_API_KEY;

// 1. Analyze Endpoint (Evaluates contract & saves last 5 scans to Firestore)
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
      - Detect the actual document type of the provided text and compare it against the user's selected document type (${docType}). If they do not match, you must prepend a clear warning message to the verdict (e.g., "⚠️ Document Type Mismatch Warning: You selected ${docType}, but this text appears to be a [Actual Document Type]. Proceeding with full analysis...").
      - Be extremely strict. Flag any hidden traps, confusing legalese, data harvesting, unfair indemnity waivers, and unlawful consent bundling no matter how small and any breach in any of the compliances.
      - Assign an overall **complianceLevel** strictly choosing from one of these four categories: "Low Risk (Compliant)", "Moderate Risk", "High Risk", or "Critical Violation".
      - Audit clause by clause, specifying exact clause numbers (e.g., "From clause 1.1", "From section 4.2") for every finding.
      - **CRITICAL FILTER REQUIREMENT:** Do NOT include clauses that are fully compliant or safe. Only include clauses that contain potential risks, moderate issues, unclear terms, or violations (i.e. Yellow, Orange, or Red tags). Completely omit any clauses tagged as Compliant or Green.
      
      STEP 2 (Target Language Output Rendering):
      - Lock down the categorical "complianceLevel", clause "tag" (Moderate, Unclear, Violation), and clause "color" (Yellow, Orange, Red) so they match the English analysis 100% and never drift.
      - Translate only the descriptive text fields (clusterMatch, summary, clause titles, reasons starting strictly with "From clause X.X: ...", and verdict) fluently into the requested output language: **${targetLanguage}**. If the target language is English, keep it in clear South African English suitable for high school learners.

      You must respond strictly with a valid JSON object in this exact format (no markdown code blocks around it, pure JSON):
      {
        "complianceLevel": "[Low Risk (Compliant) | Moderate Risk | High Risk | Critical Violation]",
        "clusterMatch": "[Name of the matched structural cluster, translated into ${targetLanguage}]",
        "summary": "[A punchy, highly accessible summary in 3 to 6 lines explaining what this contract binds the user to, translated into ${targetLanguage}]",
        "clauses": [
          {
            "clauseNumber": "[Exact reference, e.g. Clause 1.1]",
            "title": "[Short descriptive title translated into ${targetLanguage}]",
            "tag": "[Moderate | Unclear | Violation]",
            "color": "[Yellow | Orange | Red]",
            "reason": "[Thorough, high-school-friendly explanation starting strictly with 'From clause X.X: ...', detailing the legal/POPI Act impact, translated into ${targetLanguage}]"
          }
        ],
        "verdict": "[If the text does not match ${docType}, start with '⚠️ Document Type Mismatch Warning: You selected ${docType}, but this text appears to be a [Actual Document Type]. ', followed by the bold warning or clear next step, translated into ${targetLanguage}]"
      }

      Document text:
      ${documentText}
    `;

    // Multi-provider dynamic routing
    if (activeApiKey.startsWith('sk-ant-')) {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const anthropicData = await anthropicRes.json();
      if (!anthropicRes.ok) throw new Error(anthropicData.error?.message || 'Anthropic API request failed.');
      rawText = anthropicData.content[0].text;

    } else if (activeApiKey.startsWith('xai-')) {
      const xaiRes = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeApiKey}`
        },
        body: JSON.stringify({
          model: 'grok-4.7',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0
        })
      });

      const xaiData = await xaiRes.json();
      if (!xaiRes.ok) throw new Error(xaiData.error?.message || 'xAI Grok API request failed.');
      rawText = xaiData.choices[0].message.content;

    } else if (activeApiKey.startsWith('sk-')) {
      const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0
        })
      });

      const openAiData = await openAiRes.json();
      if (!openAiRes.ok) throw new Error(openAiData.error?.message || 'OpenAI API request failed.');
      rawText = openAiData.choices[0].message.content;

    } else {
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
    }

    const currentUsage = dailyUsageTracker.get(userKey);
    const scansRemaining = tierUsed.includes('BYOK') ? 'Unlimited' : Math.max(0, 3 - (currentUsage ? currentUsage.count : 0));

    let parsedData;
    try {
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('JSON Parse Error:', parseErr);
      parsedData = {
        complianceLevel: "Moderate Risk",
        clusterMatch: "General Contract Cluster",
        summary: rawText,
        clauses: [],
        verdict: "⚠️ Review carefully before signing."
      };
    }

    // Safety Filter: Ensure any compliant/green clauses are removed programmatically
    if (parsedData && Array.isArray(parsedData.clauses)) {
      parsedData.clauses = parsedData.clauses.filter(clause => {
        const color = (clause.color || '').toLowerCase();
        const tag = (clause.tag || '').toLowerCase();
        return color !== 'green' && tag !== 'compliant';
      });
    }

    // Firestore Integration: Save scan & prune to last 5 records if logged in
    if (db && clientIdentifier && clientIdentifier !== 'anonymous-user') {
      try {
        const scansRef = db.collection('saved_scans');
        
        // 1. Add new scan record
        await scansRef.add({
          email: clientIdentifier,
          docType,
          clusterMatch: parsedData.clusterMatch,
          complianceLevel: parsedData.complianceLevel,
          summary: parsedData.summary,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Fetch user scans ordered by timestamp to enforce the limit of 5
        const snapshot = await scansRef
          .where('email', '==', clientIdentifier)
          .orderBy('timestamp', 'desc')
          .get();

        // 3. Batch delete anything beyond the latest 5 scans
        if (snapshot.size > 5) {
          const batch = db.batch();
          const docsToDelete = snapshot.docs.slice(5);
          docsToDelete.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (dbErr) {
        console.error('Firestore Save Error:', dbErr);
      }
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

// 2. History Endpoint (Fetches the user's last 5 saved scans from Firestore)
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

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`ClearClause backend running on port ${PORT}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop other running instances.`);
  } else {
    console.error('❌ Server error:', err);
  }
});