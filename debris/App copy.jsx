import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingMessages = [
    "をデータベースから検索中...",
    "の統語構造を分析中...",
    "の説明を生成中..."
  ];

  useEffect(() => {
    let interval;
    if (isSearching) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    setIsSearching(true);
    setResult(null);
    setError(false);

    try {
      const response = await fetch('https://i-tya-dictionary.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: query }),
      });
      
      const data = await response.json();
      
      if (data.status === 'invalid' || data.status === 'invailed') {
        setError(true);
        setIsSearching(false);
        return;
      }
      
      let parsedRoot = "-";
      let displayWord = "???";
      let suffix = "a"; 
      let posKey = "noun";
      
      if (data.part_of_speech === "verb") {
        suffix = "i"; posKey = "verb";
      } else if (data.part_of_speech === "extender") {
        suffix = "u"; posKey = "extender";
      }

      if (data.status === 'new') {
        parsedRoot = data.root;
        displayWord = data.root + suffix;
      } else if (data.status === 'complexed' || data.status === 'semi_complexed') {
        parsedRoot = "複合概念";
        displayWord = data.combination || "???";
      } else if (data.status === 'rejected' || data.status === 'existing') {
        if (data.data) {
          if(data.data.noun) {
             parsedRoot = data.data.noun.slice(0, -1);
             displayWord = data.data[posKey] || data.data.noun;
          } else {
             displayWord = data.existing_concept || "???";
             parsedRoot = displayWord;
          }
        } else {
          let baseWord = data.existing_concept || "???";
          parsedRoot = baseWord.replace(/[aiu]$/, ''); 
          if (/[aiu]$/.test(baseWord) && !baseWord.includes(" ")) {
            displayWord = parsedRoot + suffix;
          } else {
            displayWord = baseWord;
          }
        }
      }

      setResult({
        status: data.status,
        concept: data.meaning || query,
        root: parsedRoot,
        displayWord: displayWord,
        reason: data.reason
      });

    } catch (err) {
      console.error("通信エラー:", err);
      setError(true);
    } finally {
      setIsSearching(false);
    }
  };

  const renderDisplayWord = () => {
    if (!result) return null;
    
    if (result.displayWord.includes(' ')) {
      const words = result.displayWord.split(' ');
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-8">
          {words.map((word, index) => (
            <span 
              key={index} 
              className="text-5xl md:text-6xl font-extrabold text-[#6eff5e] tracking-tight pb-2 border-b-[5px] border-[#00f0ff]"
            >
              {word}
            </span>
          ))}
        </div>
      );
    }

    return (
      <h2 className="text-5xl md:text-6xl font-extrabold text-[#6eff5e] mb-8 tracking-tight capitalize">
        {result.displayWord}
      </h2>
    );
  };

  return (
    <div className="min-h-screen bg-[#351b4d] text-slate-200 font-sans p-6 flex flex-col items-center selection:bg-[#6eff5e] selection:text-[#351b4d]">
      
      <h1 className="text-[1000px] md:text-[1000px] font-extrabold text-[#6eff5e] mt-12 mb-10 tracking-tight leading-none">Swa i-tya!</h1>
      
      <form onSubmit={handleSearch} className="w-full max-w-md relative mb-12">
        <input 
          type="text" 
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder="日本語で検索..."
          className="w-full bg-[#3f205c] border-2 border-[#6eff5e] rounded-full py-4 px-6 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#6eff5e]/30 transition-all text-lg"
          disabled={isSearching}
        />
        <button 
          type="submit" 
          disabled={isSearching || !query}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#6eff5e] text-[#351b4d] p-3 rounded-full hover:bg-[#5add4e] transition-colors disabled:opacity-50"
        >
          <Search size={24} strokeWidth={3} />
        </button>
      </form>

      <div className="w-full max-w-md">
        
        {isSearching && (
          <div className="border-[3px] border-[#6eff5e] rounded-[32px] p-8">
             <h3 className="text-slate-300 font-bold mb-6 flex items-center gap-2">
               <span className="text-[#6eff5e] text-xl">{query}</span> 
               <span className="text-sm">{loadingMessages[loadingStep]}</span>
               <Loader2 className="animate-spin text-[#6eff5e] ml-auto" size={20} />
             </h3>
             <div className="animate-pulse space-y-6">
                <div className="h-16 bg-[#3f205c] rounded-xl w-3/4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-[#3f205c] rounded w-full"></div>
                  <div className="h-4 bg-[#3f205c] rounded w-11/12"></div>
                  <div className="h-4 bg-[#3f205c] rounded w-4/5"></div>
                </div>
             </div>
          </div>
        )}

        {result && !isSearching && !error && (
          <div className="border-[3px] border-[#6eff5e] rounded-[32px] p-8 relative">
             <div className="flex items-center gap-3 mb-6">
               <span className="text-[#6eff5e] font-bold text-xl">{result.concept}</span>
               
               {result.status === 'complexed' || result.status === 'semi_complexed' ? (
                 <span className="border border-[#6eff5e] text-[#6eff5e] text-xs font-bold px-3 py-1 rounded-full">
                   複合概念
                 </span>
               ) : (
                 <span className="border border-[#6eff5e] text-[#6eff5e] text-xs font-bold px-3 py-1 rounded-full">
                   {result.status === 'new' ? '新規' : '公式'}
                 </span>
               )}
             </div>
             
             {renderDisplayWord()}

             <div className="text-slate-100 leading-loose text-[15px] whitespace-pre-wrap font-medium">
               {result.reason}
             </div>
          </div>
        )}

        {error && !isSearching && (
          <div className="text-center mt-12">
            <p className="text-xl font-bold flex items-center justify-center gap-2">
              <span className="text-[#6eff5e]">{query}</span> 
              <span className="text-rose-400">の単語は生成されませんでした。</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}