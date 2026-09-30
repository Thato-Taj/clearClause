// Universal browser API wrapper supporting Firefox, Chrome, Edge, and Brave
const extensionAPI = typeof browser !== 'undefined' ? browser : chrome;

const API_BASE_URL = 'http://localhost:5001';
const WEB_APP_URL = 'http://localhost:3000'; // Your web application URL

// Restore state when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await extensionAPI.storage.local.get(['contractText', 'analysisHTML', 'hasResults', 'customApiKey']);
    
    if (data.contractText) {
      document.getElementById('contractText').value = data.contractText;
    }
    
    if (data.customApiKey) {
      document.getElementById('customApiKey').value = data.customApiKey;
    }

    if (data.hasResults && data.analysisHTML) {
      document.getElementById('analysisContent').innerHTML = data.analysisHTML;
      document.getElementById('results').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error restoring state:', err);
  }
});

// Save text state as user types
document.getElementById('contractText').addEventListener('input', (e) => {
  extensionAPI.storage.local.set({ contractText: e.target.value });
});

// Save custom API key state as user types
document.getElementById('customApiKey').addEventListener('input', (e) => {
  extensionAPI.storage.local.set({ customApiKey: e.target.value.trim() });
});

// Grab page text (Cross-browser compatible)
document.getElementById('grabPageBtn').addEventListener('click', async () => {
  try {
    const tabs = await extensionAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.url || tab.url.startsWith('about:') || tab.url.startsWith('chrome:') || tab.url.startsWith('edge:') || tab.url.startsWith('file:')) {
      alert('Cannot grab text from restricted internal pages.');
      return;
    }

    const results = await extensionAPI.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });

    if (results && results[0] && results[0].result) {
      const scrapedText = results[0].result.substring(0, 100000);
      document.getElementById('contractText').value = scrapedText;
      await extensionAPI.storage.local.set({ contractText: scrapedText });
    } else {
      alert('Could not extract text from this page.');
    }
  } catch (err) {
    console.error('Script injection error:', err);
    alert(`Failed to grab page text: ${err.message}`);
  }
});

// Analyze contract
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const text = document.getElementById('contractText').value.trim();
  const customApiKey = document.getElementById('customApiKey').value.trim();

  if (!text) {
    alert('Please paste text or grab from the current page first.');
    return;
  }

  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  const contentEl = document.getElementById('analysisContent');
  const saveOptionsEl = document.getElementById('saveOptions');

  loadingEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  if (saveOptionsEl) saveOptionsEl.classList.add('hidden');

  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        documentText: text, 
        docType: 'Terms of Service',
        customApiKey: customApiKey || undefined,
        clientIdentifier: 'extension-user' 
      })
    });

    const resJson = await response.json();
    
    loadingEl.classList.add('hidden');

    if (resJson.success) {
      const data = resJson.data;
      
      // Build rich web-app style layout for clauses and compliance
      const clausesHTML = (data.clauses && data.clauses.length > 0) 
        ? data.clauses.map(c => `
            <div style="margin-bottom: 10px; padding: 8px; border-left: 3px solid ${c.color === 'Red' ? '#dc2626' : '#d97706'}; background: #f9fafb; font-size: 12px;">
              <strong>${c.clauseNumber}: ${c.title}</strong> <span style="float: right; color: ${c.color === 'Red' ? '#dc2626' : '#d97706'}; font-weight: bold;">[${c.tag}]</span><br>
              <span style="color: #4b5563;">${c.reason}</span>
            </div>
          `).join('')
        : '<p style="font-size: 12px; color: #059669;">No major risk clauses detected.</p>';

      const formattedHTML = `
        <div class="report-summary" style="font-size: 13px;">
          <h4 style="margin: 0 0 6px 0; color: #111827;">${data.detectedTitle || 'Document Scan'}</h4>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${data.detectedDocType || 'Terms of Service'}</p>
          <p style="margin: 4px 0;"><strong>Compliance:</strong> <span style="padding: 2px 6px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: bold;">${data.complianceLevel}</span></p>
          <p style="margin: 4px 0; font-size: 11px; color: #6b7280;">Tier: ${resJson.tierUsed || 'Base Tier'} | Remaining: ${resJson.scansRemaining}</p>
          <p style="margin: 8px 0;">${data.summary.replace(/\n/g, '<br>')}</p>
          <h5 style="margin: 10px 0 4px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px;">Flagged Risk Clauses</h5>
          <div style="max-height: 180px; overflow-y: auto; padding-right: 4px;">
            ${clausesHTML}
          </div>
          <p style="margin-top: 8px; font-style: italic; color: #4b5563;">${data.verdict || ''}</p>
        </div>
      `;

      contentEl.innerHTML = formattedHTML;
      resultsEl.classList.remove('hidden');
      
      await extensionAPI.storage.local.set({ 
        hasResults: true, 
        analysisHTML: formattedHTML,
        lastAnalysisData: data
      });
    } else {
      resultsEl.classList.remove('hidden');
      contentEl.innerHTML = `<p style="color: red;">Error: ${resJson.error || 'Failed to analyze'}</p>`;
    }
  } catch (err) {
    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    contentEl.innerHTML = `<p style="color: red;">Network error: Could not reach backend server at ${API_BASE_URL}. Ensure your server is running.</p>`;
  }
});

// Toggle Save Options panel when 'Save Scan' is clicked
document.getElementById('saveScanBtn').addEventListener('click', async () => {
  const storageData = await extensionAPI.storage.local.get(['lastAnalysisData']);
  if (!storageData.lastAnalysisData) {
    alert('No analysis data available to save.');
    return;
  }
  const saveOptionsEl = document.getElementById('saveOptions');
  if (saveOptionsEl) {
    saveOptionsEl.classList.toggle('hidden');
  }
});

// Option 1: Save as PDF (Opens clean print-ready report view)
document.getElementById('savePdfBtn').addEventListener('click', async () => {
  const storageData = await extensionAPI.storage.local.get(['lastAnalysisData']);
  if (!storageData.lastAnalysisData) return;

  const data = storageData.lastAnalysisData;
  const clausesHTML = (data.clauses || []).map(c => `
    <div style="margin-bottom: 12px; padding: 10px; border-left: 4px solid ${c.color === 'Red' ? '#dc2626' : '#d97706'}; background: #f9fafb;">
      <strong>${c.clauseNumber}: ${c.title}</strong> [${c.tag}]<br>
      <span style="font-size: 12px; color: #4b5563;">${c.reason}</span>
    </div>
  `).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>${data.detectedTitle || 'ClearClause_Report'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          h2 { color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; background: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        <h2>⚖️ ClearClause Audit Report</h2>
        <p><strong>Document:</strong> ${data.detectedTitle}</p>
        <p><strong>Compliance Level:</strong> <span class="badge">${data.complianceLevel}</span></p>
        <h3>Executive Summary</h3>
        <p>${data.summary}</p>
        <h3>Flagged Clauses</h3>
        ${clausesHTML}
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
});

// Option 2: Save to Website (Encodes analysis payload, opens web app tab, and keeps extension results visible)
document.getElementById('saveWebBtn').addEventListener('click', async () => {
  const storageData = await extensionAPI.storage.local.get(['lastAnalysisData']);
  if (!storageData.lastAnalysisData) {
    alert('No analysis data available to save.');
    return;
  }

  const analysisData = storageData.lastAnalysisData;
  const encodedPayload = encodeURIComponent(JSON.stringify(analysisData));

  // Open the web application results view in a new tab
  extensionAPI.tabs.create({ url: `${WEB_APP_URL}/save-scan?payload=${encodedPayload}` });

  // Ensure the extension keeps its results visible and hides the dropdown menu
  const saveOptionsEl = document.getElementById('saveOptions');
  if (saveOptionsEl) {
    saveOptionsEl.classList.add('hidden');
  }
  document.getElementById('results').classList.remove('hidden');
});