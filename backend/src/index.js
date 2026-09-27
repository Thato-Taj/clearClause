import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// In-memory store for tracking free daily scans (IP / Identifier -> { count, date })
const dailyUsageTracker = new Map();

const DEFAULT_KEY = process.env.GOOGLE_API_KEY;

app.post('/api/analyze', async (req, res) => {
  const { documentText, docType, targetLanguage, customApiKey, clientIdentifier } = req.body;

  if (!documentText) {
    return res.status(400).json({ success: false, error: 'Document text is required.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const userKey = clientIdentifier || 'anonymous-user';

  let activeApiKey = DEFAULT_KEY;
  let tierUsed = 'Base Tier (Free)';

  // Check if user provided their own custom key
  if (customApiKey && customApiKey.trim().length > 10) {
    activeApiKey = customApiKey.trim();
    tierUsed = 'Custom User Key (BYOK)';
  } else {
    // Enforce 3 summaries per day limit for the base model
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
    const ai = new GoogleGenAI({ apiKey: activeApiKey });

    const prompt = `
      You are an expert South African legal and compliance assistant.
      Analyze the following ${docType} document. Check for POPI Act violations, unfair clauses, and predatory fees.
      Provide the final response translated into ${targetLanguage.toUpperCase()} (if requested as a South African native language, keep legal terms clear and accessible).
      
      Document text:
      ${documentText}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const currentUsage = dailyUsageTracker.get(userKey);
    const scansRemaining = tierUsed.includes('BYOK') ? 'Unlimited' : Math.max(0, 3 - (currentUsage ? currentUsage.count : 0));

    res.json({
      success: true,
      tierUsed,
      scansRemaining,
      analysis: response.text,
    });

  } catch (error) {
    console.error('API Error:', error.message);

    // Automatic fallback if custom key fails
    if (tierUsed.includes('BYOK')) {
      try {
        const fallbackAi = new GoogleGenAI({ apiKey: DEFAULT_KEY });
        const fallbackResponse = await fallbackAi.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Analyze this ${docType} for POPI Act risks in ${targetLanguage}:\n${documentText}`,
        });

        return res.json({
          success: true,
          tierUsed: 'Base Tier (Fallback after custom key error)',
          scansRemaining: 1,
          analysis: fallbackResponse.text,
        });
      } catch (fbErr) {
        // Fallback also failed
      }
    }

    res.status(500).json({ 
      success: false, 
      error: 'Analysis failed. Please check your API key or try again later.' 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ClearClause backend running on port ${PORT}`));