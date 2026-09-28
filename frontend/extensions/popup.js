document.getElementById('grabPageBtn').addEventListener('click', async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  
  let results;
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });
  } catch (err) {
    // Fallback for chrome namespace compatibility
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });
  }

  if (results && results[0] && results[0].result) {
    document.getElementById('contractText').value = results[0].result.substring(0, 5000);
  }
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const text = document.getElementById('contractText').value.trim();
  if (!text) {
    alert('Please paste text or grab from the current page first.');
    return;
  }

  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  const contentEl = document.getElementById('analysisContent');

  loadingEl.classList.remove('hidden');
  resultsEl.classList.add('hidden');

  try {
    const response = await fetch('http://localhost:5000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentText: text, docType: 'Terms of Service' })
    });

    const data = await response.json();
    
    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');

    if (data.success) {
      contentEl.innerHTML = `<p>${data.analysis.replace(/\n/g, '<br>')}</p>`;
    } else {
      contentEl.innerHTML = `<p style="color: red;">Error: ${data.error || 'Failed to analyze'}</p>`;
    }
  } catch (err) {
    loadingEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    contentEl.innerHTML = `<p style="color: red;">Network error: Could not reach backend server.</p>`;
  }
});