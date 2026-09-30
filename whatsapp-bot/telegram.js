import express from 'express';
import dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';

// Load .env directly from root of whatsapp-bot/
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

// In-memory session tracker: chatId -> { apiKey, trialsLeft, mode }
const userSessions = new Map();

function getSession(chatId) {
  if (!userSessions.has(chatId)) {
    userSessions.set(chatId, {
      apiKey: null,
      trialsLeft: 3,
      mode: 'base'
    });
  }
  return userSessions.get(chatId);
}

// Multimodal AI execution helper
async function executeAiAnalysis(apiKey, documentText, fileBuffer = null, mimeType = null) {
  const prompt = `
    You are ClearClause legal AI. Analyze the following contract text or document image for South African legal compliance and POPI Act breaches. 
    Provide:
    1. Overall compliance status (e.g. Compliant / High Risk).
    2. A short high-school-friendly summary (2 sentences max).
    3. Top risk clauses found.
    
    Document context:
    """${documentText || "Refer to the attached document image for analysis."}"""
  `;

  const hasImage = fileBuffer && mimeType && mimeType.startsWith('image/');
  const base64Data = hasImage ? fileBuffer.toString('base64') : null;

  // 1. Anthropic Claude (Multimodal Vision supported)
  if (apiKey && apiKey.startsWith('sk-ant-')) {
    const contentPayload = [];
    if (hasImage) {
      contentPayload.push({
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64Data }
      });
    }
    contentPayload.push({ type: 'text', text: prompt });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [{ role: 'user', content: contentPayload }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error');
    return data.content[0].text;

  // 2. OpenAI GPT-4o (Multimodal Vision supported)
  } else if (apiKey && apiKey.startsWith('sk-')) {
    const contentPayload = [{ type: 'text', text: prompt }];
    if (hasImage) {
      contentPayload.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64Data}` }
      });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: contentPayload }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI API error');
    return data.choices[0].message.content;

  // 3. Google Gemini (Default)
  } else {
    const activeKey = apiKey || process.env.GOOGLE_API_KEY;
    const ai = new GoogleGenAI({ apiKey: activeKey });
    const contents = [prompt];
    
    if (hasImage) {
      contents.push({
        inlineData: { data: base64Data, mimeType: mimeType }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });
    return response.text || "Could not analyze document.";
  }
}

async function sendTelegramMessage(chatId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' })
  });
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  res.status(200).send('OK');

  const message = req.body.message;
  if (!message) return;

  const chatId = message.chat.id;
  const incomingMsg = message.text || message.caption || '';
  const session = getSession(chatId);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  try {
    if (incomingMsg.toUpperCase().startsWith('KEY:') || incomingMsg.toUpperCase().startsWith('APIKEY:')) {
      const keyMatch = incomingMsg.split(/[:\s]+/)[1];
      if (keyMatch && keyMatch.length > 10) {
        session.apiKey = keyMatch;
        session.mode = 'byok';
        await sendTelegramMessage(chatId, "🔑 *Custom API Key Registered Successfully!*\nYou are now on the **BYOK Unlimited Tier**.");
      } else {
        await sendTelegramMessage(chatId, "⚠️ Invalid key format. Send as: `KEY: AIza...` or `KEY: sk-...`");
      }
      return;
    }

    if (['/start', '/help', 'hi', 'hello', 'menu'].includes(incomingMsg.toLowerCase())) {
      await sendTelegramMessage(chatId,
        "👋 Welcome to *ClearClause Bot*!\n\n" +
        "• Send text, upload a PDF contract, or send a photo to check for *POPI Act breaches*.\n\n" +
        `📊 *Status:* ${session.mode === 'byok' ? '⚡ BYOK Unlimited' : `🆓 Free Base Model (${session.trialsLeft}/3 trials left)`}`
      );
      return;
    }

    let textToAnalyze = incomingMsg;
    let fileBuffer = null;
    let mimeType = null;

    if (message.document && botToken) {
      const doc = message.document;
      const fileMetaRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${doc.file_id}`);
      const fileMetaData = await fileMetaRes.json();
      
      if (fileMetaData.ok) {
        const fileDownloadRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileMetaData.result.file_path}`);
        fileBuffer = Buffer.from(await fileDownloadRes.arrayBuffer());
        textToAnalyze = doc.mime_type === 'application/pdf' ? (await pdfParse(fileBuffer)).text : fileBuffer.toString('utf-8');
      }
    }

    if (message.photo && message.photo.length > 0 && botToken) {
      const photo = message.photo[message.photo.length - 1];
      const fileMetaRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo.file_id}`);
      const fileMetaData = await fileMetaRes.json();

      if (fileMetaData.ok) {
        const fileDownloadRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileMetaData.result.file_path}`);
        fileBuffer = Buffer.from(await fileDownloadRes.arrayBuffer());
        mimeType = 'image/jpeg';
        textToAnalyze = incomingMsg || "Please analyze this contract image for POPI Act compliance.";
      }
    }

    if (!textToAnalyze && !fileBuffer) {
      await sendTelegramMessage(chatId, "⚠️ No readable content found. Please send text, a PDF, or a photo.");
      return;
    }

    let activeKey = process.env.GOOGLE_API_KEY;
    if (session.mode === 'byok') {
      activeKey = session.apiKey;
    } else {
      if (session.trialsLeft <= 0) {
        await sendTelegramMessage(chatId, "🔒 *Free Trial Limit Reached*\n\nSend `KEY: your_api_key` to continue.");
        return;
      }
      session.trialsLeft -= 1;
    }

    const analysisText = await executeAiAnalysis(activeKey, textToAnalyze, fileBuffer, mimeType);
    const statusFooter = session.mode === 'byok'
      ? "\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Tier:* Custom BYOK (Unlimited)"
      : `\n\n━━━━━━━━━━━━━━━━━━━━\n🆓 *Tier:* Free Base Model | *Trials Left:* ${session.trialsLeft}/3`;

    await sendTelegramMessage(chatId, `⚖️ *ClearClause Analysis Result*\n\n${analysisText}${statusFooter}`);

  } catch (error) {
    console.error('Bot Error:', error);
    await sendTelegramMessage(chatId, "⚠️ Sorry, an error occurred while processing your document.");
  }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`🤖 WhatsApp/Telegram bot service running on port ${PORT}`));