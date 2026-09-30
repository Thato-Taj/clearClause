'use client';

import { useState, useEffect } from 'react';
import { UploadCloud, ShieldAlert, ArrowRight, Sun, Moon, Key, Globe, AlertTriangle, ShieldCheck, User, LogOut, Send, MessageSquare, History, FileText, ChevronRight } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';

export default function Home() {
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [docType, setDocType] = useState('Employment Contract');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');

  // Authentication & History State
  const [user, setUser] = useState<{ uid: string; name: string | null; email: string | null } | null>(null);
  const [savedScans, setSavedScans] = useState<any[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('Reading document content...');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Monitor real Firebase authentication state changes & fetch history
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          name: currentUser.displayName,
          email: currentUser.email,
        });
        await fetchUserScans(currentUser.uid);
      } else {
        setUser(null);
        setSavedScans([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch last 5 scans from Firestore[cite: 1]
  const fetchUserScans = async (uid: string) => {
    try {
      const scansRef = collection(db, 'users', uid, 'scans');
      const q = query(scansRef, orderBy('createdAt', 'desc'), limit(5));
      const querySnapshot = await getDocs(q);
      const scans = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedScans(scans);
    } catch (err) {
      console.error('Error fetching scan history:', err);
    }
  };

  // Save successful scan result to Firestore with duplicate prevention & AI-detected naming[cite: 1]
  const saveScanToFirestore = async (uid: string, resultData: any, selectedDocType: string, fileName: string) => {
    try {
      const scansRef = collection(db, 'users', uid, 'scans');
      
      // Fetch recent scans to check for duplicates[cite: 1]
      const q = query(scansRef, orderBy('createdAt', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const existingScans = querySnapshot.docs.map(doc => doc.data());

      // Prevent saving exact duplicate summaries or filenames[cite: 1]
      const isDuplicate = existingScans.some(
        (scan: any) => scan.summary === resultData.summary || (fileName !== 'Scan' && scan.fileName === fileName)
      );

      if (isDuplicate) {
        console.log('Duplicate scan detected. Skipping save to avoid clutter.');
        return;
      }

      // Use AI-detected title/type if provided by backend, otherwise fallback to user inputs[cite: 1]
      const finalFileName = resultData.detectedTitle || fileName;
      const finalDocType = resultData.detectedDocType || selectedDocType;

      await addDoc(scansRef, {
        fileName: finalFileName,
        docType: finalDocType,
        clusterMatch: resultData.clusterMatch,
        complianceLevel: resultData.complianceLevel,
        summary: resultData.summary,
        verdict: resultData.verdict,
        clauses: resultData.clauses || [],
        createdAt: serverTimestamp(),
      });
      await fetchUserScans(uid);
    } catch (err) {
      console.error('Error saving scan to Firestore:', err);
    }
  };

  // Cycle through analysis stages on the button when analyzing[cite: 1]
  useEffect(() => {
    if (!isAnalyzing) return;
    
    const stages = [
      'Reading document content...',
      'Checking POPI Act & legal compliance...',
      'Processing individual clauses...',
      'Generating final summary...'
    ];
    
    let index = 0;
    setAnalysisStage(stages[0]);
    
    const interval = setInterval(() => {
      index++;
      if (index < stages.length) {
        setAnalysisStage(stages[index]);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign-In Error:', error.message);
      setErrorMessage('Google Sign-In failed. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAnalysisResult(null);
    } catch (error: any) {
      console.error('Sign-Out Error:', error.message);
    }
  };

  const executeScan = async (langToUse?: string) => {
    if (inputType === 'file' && !file && !pastedText.trim()) return;

    setIsAnalyzing(true);
    setErrorMessage('');

    try {
      let textToSend = pastedText;
      let currentFileName = inputType === 'file' && file ? file.name : `${docType} Scan`;

      if (inputType === 'file' && file) {
        textToSend = await file.text().catch(() => "Uploaded document content sample for ClearClause analysis.");
      }

      const clientIdentifier = user?.email ? user.email : 'anonymous-user';

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

      const res = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: textToSend,
          docType,
          targetLanguage: langToUse || targetLanguage,
          customApiKey: customApiKey.trim() || undefined,
          clientIdentifier,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.error || 'Analysis failed.');
      } else {
        setAnalysisResult(data);
        if (user) {
          // Non-blocking background save with duplicate checks[cite: 1]
          saveScanToFirestore(user.uid, data.data, docType, currentFileName).catch((err) => {
            console.error('Background save failed:', err);
          });
        }
      }
    } catch (err) {
      setErrorMessage('Could not connect to the backend server. Please verify your backend URL configuration.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    executeScan();
  };

  const handleLanguageChange = (newLang: string) => {
    setTargetLanguage(newLang);
    if (analysisResult && !analysisResult.tierUsed?.includes('History')) {
      executeScan(newLang);
    }
  };

  const docTypes = [
    { value: 'Employment Contract', label: 'Employment Contract' },
    { value: 'Loan Agreement', label: 'Loan Agreement' },
    { value: 'Residential Lease', label: 'Residential Lease' },
    { value: 'Terms of Service', label: 'Terms of Service' },
  ];

  const languages = [
    { value: 'English', label: 'English' },
    { value: 'isiZulu', label: 'isiZulu' },
    { value: 'Afrikaans', label: 'Afrikaans' },
    { value: 'Sesotho', label: 'Sesotho' },
    { value: 'isiXhosa', label: 'isiXhosa' },
  ];

  const getComplianceBadgeClass = (level: string) => {
    if (!level) return '';
    if (level.includes('Compliant') || level.includes('Low')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    }
    if (level.includes('Moderate')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    }
    if (level.includes('High')) {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300 dark:border-orange-800';
    }
    return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800';
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <main className={`min-h-screen transition-colors duration-300 flex flex-col ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        
        {/* Navbar */}
        <nav className={`border-b px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 backdrop-blur-md z-20 shadow-xs transition-colors ${
          isDarkMode ? 'border-slate-800/80 bg-slate-950/80' : 'border-slate-200/80 bg-white/80'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="bg-red-600 p-2 rounded-xl text-white shadow-md shadow-red-600/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">Clear<span className="text-red-500">Clause</span></span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ml-2 font-semibold ${
              isDarkMode 
                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>South Africa</span>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}>
                  <User className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-semibold">{user.name || 'User'}</span>
                </div>
                <button 
                  onClick={handleSignOut}
                  className={`p-2 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleSignIn}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all shadow-xs ${
                  isDarkMode 
                    ? 'bg-white text-slate-900 border-white hover:bg-slate-200' 
                    : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </nav>

        {/* Main Container */}
        <div className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full">
          
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
              Democratizing Legal Literacy in <span className="text-red-500">Mzansi</span>
            </h1>
            <p className={`text-base sm:text-lg max-w-xl mx-auto leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Translate complex contracts, spot POPI Act breaches, and read high-school-friendly summaries in your home language.
            </p>
          </div>

          <div className={user ? "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" : "max-w-4xl mx-auto"}>
            
            {/* LEFT SIDEBAR: Saved Summaries by Name */}
            {user && (
              <div className={`lg:col-span-4 border p-6 rounded-3xl shadow-lg sticky top-24 flex flex-col gap-6 ${
                isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-red-500/10 rounded-xl text-red-500">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base">Saved Summaries</h3>
                      <p className="text-xs text-slate-400">Last {savedScans.length}/5 results</p>
                    </div>
                  </div>
                </div>

                {savedScans.length === 0 ? (
                  <div className={`border border-dashed p-6 rounded-2xl text-center ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                    <FileText className="w-7 h-7 mx-auto mb-2 opacity-40 text-red-500" />
                    <p className="text-xs font-semibold">No saved results yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Run a contract analysis scan to save results here automatically!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
                    {savedScans.map((scan, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border flex flex-col gap-2.5 transition-all hover:border-red-500/50 ${
                        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs truncate" title={scan.fileName || scan.docType}>
                            📄 {scan.fileName || scan.docType}
                          </h4>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${getComplianceBadgeClass(scan.complianceLevel)}`}>
                            {scan.complianceLevel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">Type: {scan.docType}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{scan.summary}</p>
                        
                        <button
                          onClick={() => {
                            setAnalysisResult({ 
                              success: true, 
                              data: scan, 
                              tierUsed: 'Firestore Saved Audit (History)',
                              scansRemaining: 'Unlimited' 
                            });
                            setErrorMessage('');
                          }}
                          className="mt-1 px-3 py-1.5 rounded-xl border text-xs font-bold bg-red-600 text-white border-red-600 hover:bg-red-700 cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                        >
                          <span>View Result</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* RIGHT MAIN PANEL: Input Form & Results Section */}
            <div className={user ? "lg:col-span-8 flex flex-col gap-8" : "flex flex-col gap-8"}>
              
              {/* Tier Info Banner */}
              <div className={`border p-6 rounded-3xl grid grid-cols-1 sm:grid-cols-2 gap-6 ${
                isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className={`p-5 rounded-2xl border flex flex-col gap-2 ${
                  isDarkMode ? 'bg-slate-950/85 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                    <h3 className="font-bold text-sm">Without Account (Anonymous)</h3>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Get up to <strong>3 free baseline summaries</strong> to test contract risks instantly. Results are not saved.
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border flex flex-col gap-2 ${
                  isDarkMode ? 'bg-red-950/20 border-red-900/40' : 'bg-red-50/50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                    <h3 className="font-bold text-sm text-red-500">With Google Account</h3>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Enjoy <strong>3 free summaries</strong> plus automatic synchronization to save your <strong>last 5 scanned result summaries</strong> by name in Firestore!
                  </p>
                </div>
              </div>

              {/* Main Form Box */}
              <div className={`border p-8 md:p-10 rounded-3xl shadow-xl flex flex-col gap-8 transition-colors ${
                isDarkMode ? 'bg-slate-900/90 border-slate-800 shadow-black/40' : 'bg-white border-slate-200/90 shadow-slate-200/50'
              }`}>
                
                {/* Options Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-xs font-bold mb-2 uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Document Type</label>
                    <select 
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className={`w-full border px-4 py-3.5 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors ${
                        isDarkMode 
                          ? 'bg-slate-950 border-slate-800 text-white' 
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Globe className="w-3.5 h-3.5 text-red-500" />
                      Output Language (Instant Switch)
                    </label>
                    <select 
                      value={targetLanguage}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className={`w-full border px-4 py-3.5 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors ${
                        isDarkMode 
                          ? 'bg-slate-950 border-slate-800 text-white' 
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Input Mode Tabs */}
                <div className={`flex border-b gap-6 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <button 
                    type="button"
                    onClick={() => setInputType('file')}
                    className={`pb-3 px-2 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                      inputType === 'file' 
                        ? 'border-red-600 text-red-500' 
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    Upload File
                  </button>
                  <button 
                    type="button"
                    onClick={() => setInputType('text')}
                    className={`pb-3 px-2 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                      inputType === 'text' 
                        ? 'border-red-600 text-red-500' 
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    Paste Text
                  </button>
                </div>

                <form onSubmit={handleScan} className="flex flex-col gap-6">
                  
                  {inputType === 'file' ? (
                    <label className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all group ${
                      isDarkMode 
                        ? 'border-slate-800 bg-slate-950/40 hover:border-red-500 hover:bg-slate-950/70 text-slate-200' 
                        : 'border-slate-300 bg-slate-50/70 hover:border-red-500 hover:bg-red-50/20 text-slate-800'
                    }`}>
                      <div className="p-3 bg-red-500/10 rounded-2xl text-red-500 mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <span className="text-sm font-semibold">{file ? file.name : "Click to upload PDF or text contract"}</span>
                      <span className="text-xs text-slate-400 mt-1">Supports PDF, TXT</span>
                      <input type="file" accept=".pdf,.txt,image/*" className="hidden" onChange={(e) => e.target.files && setFile(e.target.files[0])} />
                    </label>
                  ) : (
                    <textarea 
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste contract text here..."
                      rows={7}
                      className={`w-full border p-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors ${
                        isDarkMode 
                          ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  )}

                  {/* Optional API Key */}
                  <div>
                    <label className={`block text-xs font-semibold mb-2 flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      Optional: Bring Your Own API Key (BYOK)
                    </label>
                    <input 
                      type="password"
                      placeholder="AIza... (leave blank to use free base tier)"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className={`w-full border px-4 py-3 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors ${
                        isDarkMode 
                          ? 'bg-slate-950 border-slate-800 text-slate-300 placeholder-slate-700' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>

                  {errorMessage && (
                    <div className={`border p-4 rounded-2xl text-xs font-medium flex items-center gap-2 ${
                      isDarkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
                    }`}>
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-600/25 flex items-center justify-center gap-2.5 cursor-pointer text-base"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>{analysisStage}</span>
                      </>
                    ) : (
                      <><span>Analyze Contract Risks</span><ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>

                {/* Results Section */}
                {analysisResult && analysisResult.data && (
                  <div className={`mt-8 pt-8 border-t flex flex-col gap-8 text-left animate-fadeIn ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    
                    {/* Engine Info & Scans Remaining */}
                    <div className={`flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl border text-xs gap-2 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <span className="font-medium">Source: <span className="text-red-500 font-bold">{analysisResult.tierUsed}</span></span>
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Scans remaining today: <strong className="font-bold">{analysisResult.scansRemaining || 'Unlimited'}</strong></span>
                    </div>

                    {/* Cluster Match & Categorical Compliance Banner */}
                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-6 border p-6 sm:p-8 rounded-3xl ${
                      isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Unsupervised Cluster Match</span>
                        <h4 className="font-extrabold text-lg sm:text-xl mt-1.5">{analysisResult.data.clusterMatch}</h4>
                      </div>
                      <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-xs ${
                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Status:</span>
                        <span className={`text-sm sm:text-base font-extrabold px-3.5 py-1.5 rounded-xl border ${getComplianceBadgeClass(analysisResult.data.complianceLevel)}`}>
                          {analysisResult.data.complianceLevel}
                        </span>
                      </div>
                    </div>

                    {/* Plain Language High-School Friendly Summary */}
                    <div className={`border p-6 sm:p-8 rounded-3xl relative overflow-hidden ${
                      isDarkMode ? 'bg-red-950/20 border-red-900/50' : 'bg-red-50/60 border-red-200'
                    }`}>
                      <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <ShieldCheck className="w-24 h-24 text-red-500" />
                      </div>
                      <h5 className={`text-xs font-extrabold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>High-School Friendly Summary</h5>
                      <p className={`text-base sm:text-lg leading-relaxed relative z-10 font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {analysisResult.data.summary}
                      </p>
                    </div>

                    {/* Clause-by-Clause Breakdown */}
                    {analysisResult.data.clauses && (
                      <div className="flex flex-col gap-6">
                        <h5 className={`text-xs font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Top POPI Act & Legal Clause Breakdown</h5>
                        {analysisResult.data.clauses.map((clause: any, idx: number) => {
                          const color = clause.color?.toLowerCase() || 'yellow';
                          const badgeClass = 
                            color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800' :
                            color === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300 dark:border-orange-800' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';

                          return (
                            <div key={idx} className={`border p-6 rounded-2xl flex flex-col gap-3 transition-all hover:shadow-md ${
                              isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}>
                              <div className="flex items-center justify-between gap-4">
                                <h6 className="font-bold text-base sm:text-lg">{clause.title}</h6>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${badgeClass}`}>
                                  {clause.tag}
                                </span>
                              </div>
                              <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                {clause.reason}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Actionable Verdict Banner */}
                    <div className={`border p-6 rounded-3xl text-center shadow-md flex items-center justify-center gap-3 ${
                      isDarkMode ? 'bg-amber-950/40 border-amber-800/80 text-amber-200' : 'bg-amber-100 border-amber-300 text-amber-900'
                    }`}>
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                      <p className="text-sm sm:text-base font-bold">
                        {analysisResult.data.verdict}
                      </p>
                    </div>

                  </div>
                )}

              </div>

            </div>

          </div>

          {/* Bot Links */}
          <div className="mt-16 text-center flex flex-col items-center gap-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Scan on the Go with Our Bots</h4>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="https://t.me/ClearClauseBot" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-bold transition-all hover:scale-105 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-xs'
                }`}
              >
                <Send className="w-4 h-4 text-sky-500" />
                <span>Telegram Bot</span>
              </a>
              <a 
                href="https://wa.me/27000000000" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-bold transition-all hover:scale-105 ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-xs'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>WhatsApp Bot (Coming Soon)</span>
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}