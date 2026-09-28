const express = require('express');
const pdfParse = require('pdf-parse');

const router = express.Router();

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

// Multimodal AI execution helper (supports text, PDF text, and images)
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
  if (apiKey.startsWith('sk-ant-')) {
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

  // 2. xAI Grok
  } else if (apiKey.startsWith('xai-')) {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'xAI API error');
    return data.choices[0].message.content;

  // 3. OpenAI GPT-4o (Multimodal Vision supported)
  } else if (apiKey.startsWith('sk-')) {
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

  // 4. Google Gemini (Native Multimodal Vision supported)
  } else {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const contents = [prompt];
    
    if (hasImage) {
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });
    return response.text || "Could not analyze document.";
  }
}

// Helper to send message back to Telegram chat
async function sendTelegramMessage(chatId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}

router.post('/webhook', async (req, res) => {
  // Immediately acknowledge Telegram's webhook request
  res.status(200).send('OK');

  const message = req.body.message;
  if (!message) return;

  const chatId = message.chat.id;
  const incomingMsg = message.text || message.caption || '';
  const session = getSession(chatId);

  try {
    // 1. Handle API Key registration command
    if (incomingMsg.toUpperCase().startsWith('KEY:') || incomingMsg.toUpperCase().startsWith('APIKEY:')) {
      const keyMatch = incomingMsg.split(/[:\s]+/)[1];
      if (keyMatch && keyMatch.length > 10) {
        session.apiKey = keyMatch;
        session.mode = 'byok';
        await sendTelegramMessage(chatId, 
          "🔑 *Custom API Key Registered Successfully!*\n" +
          "You are now on the **BYOK Unlimited Tier**. Send text, PDFs, or contract photos to analyze.\n\n" +
          "*(To update your key anytime, send `KEY: <your-key>`)*"
        );
      } else {
        await sendTelegramMessage(chatId, "⚠️ Invalid key format. Please send your key as:\n`KEY: AIza...` or `KEY: sk-...`");
      }
      return;
    }

    // 2. Handle Greeting / Help / Menu
    if (['/start', '/help', 'hi', 'hello', 'menu'].includes(incomingMsg.toLowerCase())) {
      await sendTelegramMessage(chatId,
        "👋 Welcome to *ClearClause SA*!\n\n" +
        "• Send text, upload a PDF contract, or snap/upload a photo of a document here to check for *POPI Act breaches*.\n\n" +
        `📊 *Current Status:* ${session.mode === 'byok' ? '⚡ BYOK Unlimited' : `🆓 Free Base Model (${session.trialsLeft}/3 trials left)`}\n\n` +
        "💡 *Options:*\n" +
        "• Send a file/photo or text directly to use your free trial.\n" +
        "• Send `KEY: your_api_key` to unlock unlimited scans with your own AI key."
      );
      return;
    }

    let textToAnalyze = incomingMsg;
    let fileBuffer = null;
    let mimeType = null;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // 3. Handle Document (PDF) Upload
    if (message.document) {
      const doc = message.document;
      const fileMetaRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${doc.file_id}`);
      const fileMetaData = await fileMetaRes.json();
      
      if (fileMetaData.ok) {
        const filePath = fileMetaData.result.file_path;
        const fileDownloadRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
        const arrayBuffer = await fileDownloadRes.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);

        if (doc.mime_type === 'application/pdf' || doc.file_name?.endsWith('.pdf')) {
          const parsedPdf = await pdfParse(fileBuffer);
          textToAnalyze = parsedPdf.text;
        } else {
          textToAnalyze = fileBuffer.toString('utf-8');
        }
      }
    }

    // 4. Handle Photo Upload
    if (message.photo && message.photo.length > 0) {
      // Telegram sends multiple sizes; pick the largest one (last in array)
      const photo = message.photo[message.photo.length - 1];
      const fileMetaRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo.file_id}`);
      const fileMetaData = await fileMetaRes.json();

      if (fileMetaData.ok) {
        const filePath = fileMetaData.result.file_path;
        const fileDownloadRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
        const arrayBuffer = await fileDownloadRes.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        mimeType = 'image/jpeg';
        textToAnalyze = incomingMsg || "Please analyze this contract image for POPI Act compliance and hidden risk clauses.";
      }
    }

    if (!textToAnalyze && !fileBuffer) {
      await sendTelegramMessage(chatId, "⚠️ No readable content found. Please send text, upload a PDF document, or send a photo of the contract.");
      return;
    }

    // Determine Active Key and Enforce 3-Trial Limit
    let activeKey = process.env.GEMINI_API_KEY;

    if (session.mode === 'byok') {
      activeKey = session.apiKey;
    } else {
      if (session.trialsLeft <= 0) {
        await sendTelegramMessage(chatId,
          "🔒 *Free Trial Limit Reached*\n\n" +
          "You have used all 3 free trials of the ClearClause base model. The base tier is now locked.\n\n" +
          "🔑 *To continue scanning documents, please enter your own API key by sending:*\n`KEY: your_api_key_here`"
        );
        return;
      }
      session.trialsLeft -= 1;
    }

    // Execute AI Analysis
    const analysisText = await executeAiAnalysis(activeKey, textToAnalyze, fileBuffer, mimeType);

    const statusFooter = session.mode === 'byok'
      ? "\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Tier:* Custom BYOK (Unlimited)"
      : `\n\n━━━━━━━━━━━━━━━━━━━━\n🆓 *Tier:* Free Base Model | *Trials Left:* ${session.trialsLeft}/3\n💡 *Want unlimited?* Send \`KEY: <your-key>\``;

    await sendTelegramMessage(chatId, `⚖️ *ClearClause Analysis Result*\n\n${analysisText}${statusFooter}`);

  } catch (error) {
    console.error('Telegram Processing error:', error);
    await sendTelegramMessage(chatId, 
      "⚠️ Sorry, we encountered an error processing your document or image.\n\n" +
      `📊 *Status:* ${session.mode === 'byok' ? '⚡ BYOK Tier' : `🆓 Base Model (${session.trialsLeft}/3 trials left)`}`
    );
  }
});

module.exports = router;
