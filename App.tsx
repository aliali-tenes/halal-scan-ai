
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ResultCard from './components/ResultCard';
import LoadingOverlay from './components/LoadingOverlay';
import AuthScreen from './components/AuthScreen';
import DisclaimerModal from './components/DisclaimerModal';
import HistoryDrawer from './components/HistoryDrawer';
import InstallPrompt from './components/InstallPrompt';
import { analyzeIngredients } from './services/geminiService';
import { AnalysisResult, HalalTheme, HistoryItem } from './types';

const App: React.FC = () => {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [halalTheme, setHalalTheme] = useState<HalalTheme>('classic');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initializeApp = async () => {
      // Check for successful payment redirection
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment_success')) {
        setIsPro(true);
        localStorage.setItem('halalscan_pro_status', 'true');
        setShowPaymentSuccess(true);
        // Clean the URL
        window.history.replaceState(null, '', window.location.pathname);
        // Hide the success message after a few seconds
        setTimeout(() => setShowPaymentSuccess(false), 5000);
      } else {
        const proStatus = localStorage.getItem('halalscan_pro_status');
        if (proStatus === 'true') {
          setIsPro(true);
        }
      }

      const savedHistory = localStorage.getItem('halalscan_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const hasAcceptedDisclaimer = localStorage.getItem('halalscan_disclaimer_accepted');
      if (!hasAcceptedDisclaimer) {
        setShowDisclaimer(true);
      } else if (!isPro && localStorage.getItem('halalscan_pro_status') !== 'true') {
        setShowAuth(true);
      }
    };
    initializeApp();
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []); // Run only once on mount

  const compressImage = (file: File): Promise<{ base64: string; preview: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve({
            preview: dataUrl,
            base64: dataUrl.split(',')[1]
          });
        };
      };
    });
  };

  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('halalscan_history', JSON.stringify(newHistory));
  };

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('halalscan_disclaimer_accepted', 'true');
    setShowDisclaimer(false);
    if (!isPro) {
      setShowAuth(true);
    }
  };

  const handleUnlockPro = async () => {
    // This function is now conceptually handled by the PricingScreen component
    // It can be kept for other potential auth methods in the future
    console.log("Redirecting to pricing...");
  };
  
  const handleSkipAuth = () => {
    setShowAuth(false);
    // Maybe set a session cookie to not show it again for a while
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const { base64, preview } = await compressImage(file);
      setPreview(preview);
      setBase64Image(base64);
      await handleAnalyze(base64, preview);
    } catch (err) {
      setError("فشل في معالجة الصورة المختارة.");
      setLoading(false);
    }
  };

  const handleAnalyze = async (base64: string, imgPreview: string) => {
    if (!base64 || !imgPreview) return;

    setLoading(true);
    setError(null);
    try {
      const data = await analyzeIngredients(base64, isPro);
      setResult(data);
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        imagePreview: imgPreview,
        result: data
      };
      saveHistory([newItem, ...history].slice(0, 20));
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleInstall = async () => {
    if (!installPromptEvent) return;
    const result = await installPromptEvent.prompt();
    console.log(`Install prompt was: ${result.outcome}`);
    setInstallPromptEvent(null);
    setShowInstallPrompt(false);
  };

  const handleReset = () => {
    setResult(null);
    setPreview(null);
    setBase64Image(null);
    setError(null);
  };

  const handleShare = async () => {
    if (result && navigator.share) {
      let shareText = `*HalalScan AI - نتيجة الفحص*\n\n`;
      shareText += `*الحالة: ${result.recommendation}*\n\n`;
      shareText += `*السبب:* ${result.reason}\n\n`;
      if (result.haramIngredients.length > 0) {
        shareText += `*مكونات محرمة:* ${result.haramIngredients.join(', ')}\n`;
      }
      if (result.doubtfulIngredients.length > 0) {
        shareText += `*مكونات مشتبهة:* ${result.doubtfulIngredients.join(', ')}\n`;
      }
      shareText += `\nفحصت عبر HalalScan AI - كاشف الحلال الذكي`;

      try {
        await navigator.share({
          title: 'نتيجة فحص HalalScan AI',
          text: shareText,
        });
      } catch (error) {
        console.error('خطأ في مشاركة النتيجة:', error);
      }
    }
  };

  const handleSelectItem = (item: HistoryItem) => {
    setResult(item.result);
    setPreview(item.imagePreview);
    setIsHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = (id: string) => {
    saveHistory(history.filter(i => i.id !== id));
  };

  const handleClearHistory = () => {
    if (confirm('هل أنت متأكد من مسح السجل؟')) saveHistory([]);
  };

  if (showDisclaimer) return <DisclaimerModal onAccept={handleAcceptDisclaimer} />;
  if (showAuth) return <AuthScreen onUnlock={handleUnlockPro} onSkip={handleSkipAuth} />;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center transition-all duration-500">
      <div className="w-full text-center p-2 bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest relative z-50 shadow-md">
        {isPro ? "✨ HalalScan Pro Active ✨" : "Basic Mode"}
        {!isPro && <button onClick={() => setShowAuth(true)} className="ml-4 underline hover:text-emerald-200 transition-colors">Unlock Pro</button>}
      </div>
      
      <Header />
      
      <main className="w-full max-w-4xl px-4 py-6 flex-grow flex flex-col items-center gap-8">
        {!result ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 animate-fade-in-up text-center p-8">
            <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl">
               <svg className="w-16 h-16 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.586a1 1 0 01.707.293l.828.828A1 1 0 009.414 8H14.586a1 1 0 00.707-.293l.828-.828A1 1 0 0116.414 6H17a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
               </svg>
            </div>
            <h2 className="text-3xl font-black text-slate-800">ابدأ الفحص الآن</h2>
            <p className="text-slate-500 max-w-md">التقط صورة واضحة لقائمة المكونات، ودع الذكاء الاصطناعي يقوم بالباقي. تحليل فوري ودقيق بين يديك.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 bg-emerald-600 text-white font-black text-xl px-12 py-6 rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-4"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.586a1 1 0 01.707.293l.828.828A1 1 0 009.414 8H14.586a1 1 0 00.707-.293l.828-.828A1 1 0 0116.414 6H17a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>اختر صورة</span>
            </button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <ResultCard 
            result={result} 
            onReset={handleReset} 
            currentTheme={halalTheme}
            onThemeChange={setHalalTheme}
            onShare={handleShare}
          />
        )}
        
        {loading && <LoadingOverlay />}
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-fade-in-up text-center z-[200]">
            <p className="font-black">حدث خطأ!</p>
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="absolute -top-2 -right-2 bg-red-700 p-1 rounded-full text-white">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}
         {showPaymentSuccess && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-fade-in-up text-center z-[200]">
            <p className="font-black">شكراً لك! تم تفعيل اشتراكك بنجاح.</p>
          </div>
        )}

        <button 
          onClick={() => setIsHistoryOpen(true)}
          className="fixed bottom-6 right-6 bg-white w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-slate-100 transition-colors transform hover:scale-110 active:scale-95 z-40 border"
          aria-label="View history"
        >
          <svg className="w-7 h-7 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {history.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-white text-[9px] font-black items-center justify-center">{history.length}</span></span>}
        </button>

        <HistoryDrawer 
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history}
          onSelectItem={handleSelectItem}
          onDeleteItem={handleDeleteItem}
          onClearAll={handleClearHistory}
        />

        {showInstallPrompt && <InstallPrompt onInstall={handleInstall} onDismiss={() => setShowInstallPrompt(false)} />}
        
      </main>
    </div>
  );
};

export default App;
