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

  const resetSearch = () => {
    const doReset = () => {
      setIsSearching(false);
      setResult(null);
      setQuery('');
      setError(false);
    };

    if (document.startViewTransition) {
      document.startViewTransition(doReset);
    } else {
      doReset();
    }
  };               

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    const startSearching = () => {
      setIsSearching(true);
      setResult(null);
      setError(false);
    }
    
    if(document.startViewTransition){
      document.startViewTransition(startSearching);
    } else {
      startSearching();
    }

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

      if (data.data) {
        // 【パターンA】Firestoreから「既存単語」が直接返ってきた場合
        parsedRoot = data.data.noun ? data.data.noun.slice(0, -1) : "-";
        displayWord = data.data[posKey] || data.data.noun || "???";
      } else if (data.status === 'complexed' || data.status === 'semi_complexed') {
        // 【パターンB】複合概念（LLMからでも、Firestoreからでも）
        parsedRoot = "複合概念";
        displayWord = data.combination || "???";
      } else if (data.status === 'new' || data.status === 'existing') {
        // 【パターンC】LLMが生成した「新規語幹」または「既存語幹」
        if (data.root) {
          parsedRoot = data.root;
          displayWord = data.root + suffix;
        } else {
          displayWord = "???";
        }
      }

      const finalStatus = data.status || (data.data ? 'existing' : 'unknown');

      setResult({
        status: finalStatus,
        concept: data.meaning || query,
        root: parsedRoot,
        displayWord: displayWord,
        reason: data.reason || "解説はまだ準備されていません！"
      });

    } catch (err) {
      console.error("通信エラー！", err);
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
        <h2 className="word-display">
          {words.map((word, index) => (
            <React.Fragment key={index}>
              {word}{index !== words.length - 1 && ' '}
            </React.Fragment>
          ))}
        </h2>
      );
    }

    return (
      <h2 className="word-display">
        {result.displayWord}
      </h2>
    );
  };

  const isExpanded = isSearching || result || error;

  return (
    <div className="app-container">
      <div className={`content-wrapper ${isExpanded ? 'moved-up' : ''}`}>
        <h1 className={`main-title ${isExpanded ? 'squashed' : ''}`}>
          Swa i-tya!
        </h1>

        <form id="search-form" onSubmit={handleSearch} className="search-form">
          <div className={`morph-box ${isExpanded ? 'expanded' : ''}`}>
            
            <input 
              type="text" 
              className={`morph-input ${isExpanded ? 'hidden' : ''}`}
              placeholder="日本語で検索..."
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              disabled={isExpanded}
            />

            {isSearching && (
              <div className="skeleton-wrapper fade-in-up">
                <p className="searching-text">
                  <span>{query}</span> {loadingMessages[loadingStep]}
                </p>
                <div className="skeleton-container">
                  <div className="skeleton-box short"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line mid"></div>
                  <div className="skeleton-box tall"></div>
                </div>
              </div>
            )}

            {result && !isSearching && !error && (
              <div className="inner-result fade-in-up">
                
                <p className="concept-text">
                  {result.concept}
                  {result.status === 'new' && (
                    <span className="badge badge-new">新規</span>
                  )}
                  {(result.status === 'complexed' || result.status === 'semi_complexed') && (
                    <span className="badge badge-compound">複合概念</span>
                  )}
                </p>

                {renderDisplayWord()}
                <div className="reason-text">
                  {result.reason}
                </div>
              </div>
            )}

            {error && !isSearching && (
              <div className="inner-result fade-in-up">
                <p className="concept-text" style={{ color: '#ff4d4d' }}>エラー！</p>
                <h2 className="word-display" style={{ borderColor: '#ff4d4d', color: 'white' }}>Error</h2>
                <div className="reason-text">データベースとの接続に失敗しました！</div>
              </div>
            )}
          </div>

          <button 
            onClick={isExpanded ? resetSearch : handleSearch}
            type={!isExpanded ? "submit" : "button"}
            className={`search-button ${isExpanded ? 'stored' : ''}`}
          >
            <Search size={28} strokeWidth={3.5} />
          </button>
        </form>
      </div>
    </div>
  );
}