'use client';

import { useState } from 'react';
import { UploadCloud, ShieldAlert, FileText, Settings, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleSimulateAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setIsAnalyzing(true);
    setHasResults(false);

    // Simulate AI parsing delay for the MVP demo
    setTimeout(() => {
      setIsAnalyzing(false);
      setHasResults(true);
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-slate-800 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-500" />
          <span className="font-bold text-xl tracking-tight">Clear<span className="text-red-500">Clause</span></span>
          <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 ml-2">South Africa MVP</span>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
        >
          <Settings className="w-4 h-4" />
          <span>API Settings</span>
        </button>
      </nav>

      {/* Settings Modal Dropdown */}
      {showSettings && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-300">Custom AI Key Configuration</h3>
            <p className="text-xs text-slate-400">Provide your own API key to bypass default rate limits or use your preferred LLM endpoint.</p>
            <div className="flex gap-2">
              <input 
                type="password" 
                placeholder="Enter your AI API Key (optional)" 
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-sm flex-1 text-slate-200 focus:outline-none focus:border-red-500"
              />
              <button 
                onClick={() => setShowSettings(false)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-12 text-center flex-1 flex flex-col justify-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Democratizing Legal Literacy & <span className="text-red-500">Digital Protection</span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg mb-8 max-w-2xl mx-auto">
          Upload any employment contract, loan agreement, or terms of service. We translate complex legalese and flag POPI Act violations instantly.
        </p>

        {/* Upload Card */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          <form onSubmit={handleSimulateAnalysis} className="flex flex-col gap-6">
            <label className="border-2 border-dashed border-slate-700 hover:border-red-500/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50">
              <UploadCloud className="w-12 h-12 text-red-500 mb-3" />
              <span className="text-sm font-medium text-slate-200">
                {file ? file.name : "Click to upload contract (PDF or Photo)"}
              </span>
              <span className="text-xs text-slate-500 mt-1">Supports PDF, PNG, JPG up to 10MB</span>
              <input 
                type="file" 
                accept=".pdf,image/*" 
                className="hidden" 
                onChange={(e) => e.target.files && setFile(e.target.files[0])} 
              />
            </label>

            <button
              type="submit"
              disabled={!file || isAnalyzing}
              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <span>Analyzing POPI Act compliance & risk patterns...</span>
              ) : (
                <>
                  <span>Scan Contract for Risks</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Results Section */}
          {hasResults && (
            <div className="mt-8 pt-8 border-t border-slate-800 text-left flex flex-col gap-6 animate-fadeIn">
              <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                <div>
                  <h4 className="font-bold text-red-400 text-lg">High Risk Detected</h4>
                  <p className="text-xs text-slate-300">Found 2 potential POPI Act breaches and 1 predatory fee clause.</p>
                </div>
                <div className="text-2xl font-black text-red-500 bg-slate-950 px-4 py-2 rounded-lg border border-red-500/40">
                  85 / 100
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-semibold text-slate-200">Section 4: Data Selling Clause</h5>
                    <p className="text-xs text-slate-400 mt-1">This clause permits sharing your personal metadata with third-party marketing affiliates without explicit annual re-consent, violating POPI Act Section 14.</p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-semibold text-slate-200">Plain-English Summary</h5>
                    <p className="text-xs text-slate-400 mt-1">Grade 10 Translation: "You are giving this company permission to sell your phone number and email to other advertisers. You can opt out by writing an email, but they make it difficult."</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-center">
                <p className="text-xs font-medium text-amber-400">⚠️ Recommendation: "Do not sign, talk to Legal Aid or your union representative."</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}