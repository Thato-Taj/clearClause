'use client';

import { useState } from 'react';
import { UploadCloud, ShieldAlert, FileText, CheckCircle2, AlertTriangle, ArrowRight, Sun, Moon, AlignLeft, FileType, Key, Globe } from 'lucide-react';

export default function Home() {
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [docType, setDocType] = useState('employment');
  const [targetLanguage, setTargetLanguage] = useState('english');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputType === 'file' && !file) return;
    if (inputType === 'text' && !pastedText.trim()) return;

    setIsAnalyzing(true);
    setErrorMessage('');
    setResult(null);

    try {
      // For file uploads in this MVP step, we read text or send text payload
      const textToSend = inputType === 'text' ? pastedText : "Simulated extracted text from uploaded document file...";

      const res = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: textToSend,
          docType,
          targetLanguage,
          customApiKey: customApiKey.trim() || undefined,
          clientIdentifier: 'local-user-session', // simple session tracking for 3/day limit
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.error || 'Analysis failed.');
      } else {
        setResult(data);
      }
    } catch (err) {
      setErrorMessage('Could not connect to the backend server. Make sure Express is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const docTypes = [
    { value: 'employment', label: 'Employment Contract' },
    { value: 'loan', label: 'Loan Agreement' },
    { value: 'lease', label: 'Residential Lease' },
    { value: 'tos', label: 'Terms of Service' },
  ];

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'zulu', label: 'isiZulu' },
    { value: 'afrikaans', label: 'Afrikaans' },
    { value: 'sesotho', label: 'Sesotho' },
    { value: 'xhosa', label: 'isiXhosa' },
  ];

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
        
        {/* Navbar */}
        <nav className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-xl text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Clear<span className="text-red-600 dark:text-red-500">Clause</span></span>
            <span className="text-xs bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-500/20 ml-2 font-medium">South Africa</span>
          </div>

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            <span className="hidden sm:inline">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </nav>

        {/* Main Form Container */}
        <div className="max-w-3xl mx-auto px-6 py-10 flex-1 w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 text-slate-950 dark:text-white">
              Democratizing Legal Literacy in <span className="text-red-600 dark:text-red-500">Mzansi</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Translate complex contracts, spot POPI Act breaches, and read summaries in your home language. Free tier allows 3 scans per day.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-2xl shadow-xl flex flex-col gap-6">
            
            {/* Options Row (Doc Type & Language) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Document Type</label>
                <select 
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-red-600" />
                  Output Language
                </label>
                <select 
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* Input Mode Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
              <button 
                onClick={() => setInputType('file')}
                className={`pb-2 px-3 font-medium text-sm border-b-2 transition-colors ${inputType === 'file' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500'}`}
              >
                Upload File
              </button>
              <button 
                onClick={() => setInputType('text')}
                className={`pb-2 px-3 font-medium text-sm border-b-2 transition-colors ${inputType === 'text' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500'}`}
              >
                Paste Text
              </button>
            </div>

            <form onSubmit={handleScan} className="flex flex-col gap-5">
              {inputType === 'file' ? (
                <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-50 dark:bg-slate-950/40">
                  <UploadCloud className="w-10 h-10 text-red-600 mb-2" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{file ? file.name : "Click to upload PDF or photo"}</span>
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
                </label>
              ) : (
                <textarea 
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste contract text here..."
                  rows={5}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-3.5 rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              )}

              {/* Optional Custom API Key (BYOK) */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  Optional: Bring Your Own API Key (Claude, Gemini, or OpenAI)
                </label>
                <input 
                  type="password"
                  placeholder="sk-ant-... or AIza... (leave blank to use free base tier)"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3 rounded-xl text-xs text-red-600 dark:text-red-400">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isAnalyzing}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAnalyzing ? 'Analyzing contract...' : <><span>Scan Contract</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            {/* Results Display */}
            {result && (
              <div className="mt-4 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-4 text-left">
                <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-semibold">Engine Used: <span className="text-red-600">{result.tierUsed}</span></span>
                  <span className="text-slate-500">Scans remaining today: {result.scansRemaining}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-sm whitespace-pre-wrap leading-relaxed">
                  {result.analysis}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}