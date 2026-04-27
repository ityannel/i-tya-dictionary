
import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ArrowUp, Link, Check} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import DictionaryList from './DictionaryList';

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [trivia, setTrivia] = useState('');
  const [showTopBtn, setShowTopBtn] = useState(false);
  const clickedWordIdRef = useRef(null);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activePos, setActivePos] = useState('noun');

  const hasSearchedFromUrl = useRef(false);

  useEffect(() => {
    if (hasSearchedFromUrl.current) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      hasSearchedFromUrl.current = true;
      setQuery(q);
      executeSearch(q);
    }
  }, []);


  useEffect(() => {
    let triviaInterval;
    if (isSearching) {
      triviaInterval = setInterval(async () => {
        try {
          const trRes = await fetch('https://i-tya-dictionary.onrender.com/api/trivias');
          const trData = await trRes.json();
          if (Array.isArray(trData) && trData.length > 0) {
            const random = trData[Math.floor(Math.random() * trData.length)];
            setTrivia(random);
          }
        } catch (err) {
          console.log("トリビアの定期取得に失敗！", err);
        }
      }, 5000);
    }
    return () => clearInterval(triviaInterval);
  }, [isSearching]);

  useEffect(() => {
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  // 検索リセット — 単語IDを使って要素位置へ戻る
  const resetSearch = () => {
    const targetId = clickedWordIdRef.current;

    const doReset = () => {
      setResult(null);
      setIsSearching(false);
      setQuery('');
      setError(false);
    };

    if (!document.startViewTransition) {
      doReset();
      // 辞書リストが再レンダリングされるまで2フレーム待つ
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (targetId) {
            const el = document.querySelector(`[data-word-id="${targetId}"]`);
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
          }
        });
      });
      return;
    }

    const transition = document.startViewTransition(doReset);
    transition.updateCallbackDone.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (targetId) {
            const el = document.querySelector(`[data-word-id="${targetId}"]`);
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
          }
        });
      });
    });
  };

  const executeSearch = async (searchQuery) => {
    setIsSearching(true);
    setResult(null);
    setError(false);
    setTrivia("トリビアを読み込み中...");

    try {
      const trRes = await fetch('https://i-tya-dictionary.onrender.com/api/trivias');
      const trData = await trRes.json();
      if (Array.isArray(trData) && trData.length > 0) {
        const random = trData[Math.floor(Math.random() * trData.length)];
        setTrivia(random);
      }
    } catch (err) {
      console.log("初回トリビアの取得に失敗しました。");
    }

    try {
      const res = await fetch('https://i-tya-dictionary.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: searchQuery }),
      });

      const data = await res.json();

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
        parsedRoot = data.data.noun ? data.data.noun.slice(0, -1) : "-";
        displayWord = data.data[posKey] || data.data.noun || "???";
      } else if (data.status === 'complexed' || data.status === 'semi_complexed') {
        parsedRoot = "複合概念";
        displayWord = data.combination || "???";
      } else if (data.status === 'new' || data.status === 'existing') {
        if (data.root) {
          parsedRoot = data.root;
          displayWord = data.root + suffix;
        }
      }

      const finishSearching = () => {
        const finalStatus = data.status || (data.data ? 'existing' : 'unknown');
        const isNewWord = finalStatus === 'new' || data.is_new === true;
        const isComplexWord = finalStatus === 'complexed' || finalStatus === 'semi_complexed' || data.combination;

        if (finalStatus === "new") {
          const effects = ["confetti", "stars", "fireworks"];
          const randomEffects = effects[Math.floor(Math.random() * effects.length)];
          triggerCelebration(randomEffects);
        }

        setResult({
          status: data.status || 'unknown',
          concept: data.meaning || data.meaning_noun|| searchQuery,
          root: parsedRoot,
          displayWord: displayWord,
          reason: data.reason || "解説はまだ準備されていません！",
          reason_noun: data.reason_noun || data.reason || "解説はまだ準備されていません！",
          reason_verb: data.reason_verb || data.reason || "解説はまだ準備されていません！",
          reason_extender: data.reason_extender || data.reason || "解説はまだ準備されていません！",
          meaning_noun: data.meaning_noun,
          meaning_verb: data.meaning_verb,
          meaning_extender: data.meaning_extender,
          wordData: data.data || (data.root ? {
            noun: data.root + 'a',
            verb: data.root + 'i',
            extender: data.root + 'u'
          } : null),
          isNew: isNewWord,
          isComplex: !isComplexWord
        });
        setActivePos(posKey || 'noun');
        setIsSearching(false);
      };

      setTrivia(data.trivia || "この概念に関するトリビアはまだないぜ。");

      finishSearching();

    } catch (err) {
      console.error("通信エラー！", err);
      setError(true);
      setIsSearching(false);
    }
  };

  const handleSearch = async (e) => {
  e.preventDefault();
  if (!query || isSearching) return;
  clickedWordIdRef.current = null;
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      executeSearch(query);
    });
  } else {
    executeSearch(query);
  }
};

  const handleDictionaryClick = (wordData) => {
    clickedWordIdRef.current = wordData.id; // IDを保存（スクロール位置ではなく）
    window.scrollTo({ top: 0, behavior: 'instant' });

    const showDetail = () => {
      setTrivia('');
      let parsedRoot = wordData.fullData?.root || "-";
      if (wordData.type === 'complex') parsedRoot = "複合概念";

      setResult({
        status: wordData.type === 'complex' ? 'complexed' : 'existing',
        concept: wordData.meaning,
        root: parsedRoot,
        displayWord: wordData.word,
        reason: wordData.fullData?.reason || "解説はまだ準備されていません！",
        reason_noun: wordData.fullData?.reason_noun || wordData.fullData?.reason || "解説はまだ準備されていません！",
        reason_verb: wordData.fullData?.reason_verb || wordData.fullData?.reason || "解説はまだ準備されていません！",
        reason_extender: wordData.fullData?.reason_extender || wordData.fullData?.reason || "解説はまだ準備されていません！",
        meaning_noun: wordData.fullData?.meaning_noun,
        meaning_verb: wordData.fullData?.meaning_verb,
        meaning_extender: wordData.fullData?.meaning_extender,
        wordData: wordData.type !== 'complex' ? {
          noun: wordData.fullData?.word_noun,
          verb: wordData.fullData?.word_verb,
          extender: wordData.fullData?.word_extender
        } : null,
      });
      setIsSearching(false);
      setError(false);
    };

    if (document.startViewTransition) {
      document.startViewTransition(showDetail);
    } else {
      showDetail();
    }
  };

  const triggerCelebration = (type) => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    if (type === 'confetti') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#70ff70', '#ffffff', '#4a1c53']
      });
    } else if (type === 'stars') {
      const defaults = { spread: 360, ticks: 50, gravity: 0, decay: 0.94, startVelocity: 30, colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'] };
      const shoot = () => {
        confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ['star'] });
        confetti({ ...defaults, particleCount: 10, scalar: 0.75, shapes: ['circle'] });
      };
      setTimeout(shoot, 0);
      setTimeout(shoot, 100);
      setTimeout(shoot, 200);
    } else if (type === 'fireworks') {
      (function frame() {
        confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#70ff70'] });
        confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ffffff'] });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
  };

  const isExpanded = isSearching || result || error;

  return (
    <div className="app-container">
      <div className={`content-wrapper ${isExpanded ? 'moved-up' : ''}`}>
        <h1 className={`main-title ${isExpanded ? 'squashed' : ''} ${error ? 'is-error' : ''}`}>
          Swa i-tya!
        </h1>

        <form id="search-form" onSubmit={handleSearch} className="search-form">
          <div className={`morph-box ${isExpanded ? 'expanded' : ''} ${error ? 'is-error' : ''}`}>

            <input
              type="text"
              className={`morph-input ${isExpanded ? 'hidden' : ''}`}
              placeholder="日本語で検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isExpanded}
            />

            {isSearching && (
              <div className="skeleton-wrapper fade-in-up">
                <p className="searching-text">
                  <span>{query}</span> {loadingMessages[loadingStep]}
                </p>
                {trivia && (
                  <div className="trivia-box">
                    <span className="trivia-text">{trivia}</span>
                  </div>
                )}
                <div className="skeleton-line concept-skel"></div>
                <div className="skeleton-box word-skel"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line mid"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line mid"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line long"></div>
                <div className="skeleton-line mid"></div>
              </div>
            )}

            {result && !isSearching && !error && (
              <div className="inner-result fade-in-up">
                <div className="concept-header">
                  <div className="concept-text">
                    {result.wordData && result.meaning_noun
                      ? (activePos === 'noun' ? result.meaning_noun
                        : activePos === 'verb' ? result.meaning_verb
                        : result.meaning_extender)
                      : result.concept}
                    {result.status === 'new' && <span className="badge-new">新規</span>}
                    {result.status === 'complexed' && <span className="badge-compound">複合概念</span>}
                  </div>

                  {result.status !== 'complexed' && result.wordData && (
                    <select
                      className="pos-select"
                      value={activePos}
                      onChange={(e) => {
                        const el = document.querySelector('.word-display');
                        const el2 = document.querySelector('.reason-text');
                        [el, el2].forEach(el => {
                          if (el) {
                            el.style.animation = 'none';
                            el.offsetHeight; // reflow
                            el.style.animation = '';
                          }
                        });
                        setActivePos(e.target.value);
                      }}
                    >
                      <option value="noun">名詞</option>
                      <option value="verb">動詞</option>
                      <option value="extender">拡張詞</option>
                    </select>
                  )}
                </div>

                <h2 className="word-display">
                  {result.wordData && result.status !== 'complexed' ? result.wordData[activePos] : result.displayWord}
                </h2>
                
                <div className="reason-text">
                  {result.status === 'complexed' || !result.wordData
                    ? result.reason
                    : (activePos === 'noun' ? (result.reason_noun || result.reason)
                       : activePos === 'verb' ? (result.reason_verb || result.reason)
                       : (result.reason_extender || result.reason))
                  }
                </div>

                <div className="share-buttons">
                  <button className="index-btn" onClick={() => {
                    const url = `${window.location.origin}?q=${encodeURIComponent(result.concept)}`;
                    navigator.clipboard.writeText(url);
                    window.history.pushState({}, '', `?q=${encodeURIComponent(result.concept)}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}>
                    {copied ? <Check size={20} strokeWidth={3} /> : <Link size={20} strokeWidth={2.5} />}
                  </button>
                  <button className="index-btn" onClick={() => {
                    const url = `${window.location.origin}?q=${encodeURIComponent(result.concept)}`;
                    const isNew = result.status === 'new';
                    const text = isNew
                      ? `「${result.concept}」をi-tyaに登録しました！\n「${result.displayWord}」\n\n#i_tya #NT函館`
                      : `「${result.concept}」をi-tyaで調べました！\n「${result.displayWord}」\n\n#i_tya #NT函館`;
                    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                  }}>
                    <FontAwesomeIcon icon={faXTwitter} />
                  </button>
                </div>
              </div>
            )}

            {error && !isSearching && (
              <div className="inner-result fade-in-up">
                <p className="concept-text">エラー！</p>
                <h2 className="word-display">Error</h2>
                <div className="reason-text">データベースとの接続に失敗しました！</div>
              </div>
            )}
          </div>

          <button
            onClick={isExpanded ? resetSearch : undefined}
            type={isExpanded ? "button" : "submit"}
            className={`search-button ${isExpanded ? 'stored' : ''}`}
          >
            {isExpanded ? <X size={28} strokeWidth={3.5} /> : <Search size={28} strokeWidth={3.5} />}
          </button>
        </form>

        {!isExpanded && (
          <div className="dictionary-wrapper fade-in-up">
            <p className="total-count">{total}語収録中</p>
            <DictionaryList 
              onWordClick={handleDictionaryClick}
              onTotalLoaded={(count) => setTotal(count)} 
            />
          </div>
        )}

        {/* 戻るボタン */}
        <button
          className={`scroll-top-btn ${showTopBtn ? 'show' : ''}`}
          onClick={scrollToTop}
          aria-label="トップへ戻る"
        >
          <ArrowUp size={28} strokeWidth={3.5} />
        </button>
      </div>
    </div>
  );
}
