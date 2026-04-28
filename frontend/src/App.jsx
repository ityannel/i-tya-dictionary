import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ArrowUp, Link, Check, Settings } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import DictionaryList from './DictionaryList';

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null); // null | 'overload' | 'invalid' | 'connection'
  const [loadingStep, setLoadingStep] = useState(0);
  const [trivia, setTrivia] = useState('');
  const [showTopBtn, setShowTopBtn] = useState(false);
  const clickedWordIdRef = useRef(null);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activePos, setActivePos] = useState('noun');
  const [isAdmin, setIsAdmin] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editConcept, setEditConcept] = useState('');
  const [editReason, setEditReason] = useState('');
  const [mode, setMode] = useState('auto');
  const [isTranslateMode, setIsTranslateMode] = useState(false);
  const [translationResult, setTranslationResult] = useState(null);

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

  const loadingMessages = isTranslateMode
    ? [
        "をi-tyaに翻訳中...",
        "の文法構造を解析中...",
        "の単語を照合中..."
      ]
    : [
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
  }, [isSearching, isTranslateMode]);

  const handleTitleClick = () => {
    clickCountRef.current += 1;

    if (clickCountRef.current === 5) {
      const pass = prompt("管理者パスワードを入力してください：");
      if (pass === "itya_admin_NT") {
        setIsAdmin(true);
        alert("管理者権限を承認しました！");
      } else {
        alert("誰だお前は！");
      }
      clickCountRef.current = 0;
    }

    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1000);
  };

  const saveEdit = async () => {
    if (!result.id) {
      alert("ドキュメントIDがねえから更新できません！");
      return;
    }

    try {
      const res = await fetch(`https://i-tya-dictionary.onrender.com/api/words/${result.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: "itya_admin_NT",
          meaning: editConcept,
          reason: editReason
        })
      });

      if (res.ok) {
        alert("編集完了");
        setResult({ ...result, concept: editConcept, reason: editReason });
        setIsEditing(false);
      } else {
        alert("更新エラー！サーバーを確認してください！");
      }
    } catch (err) {
      console.error("編集通信エラー", err);
    }
  };

  const deleteWord = async (id, word) => {
    if (!window.confirm(`「${word}」をデータベースから抹消していいんだな？`)) return;

    try {
      const res = await fetch(`https://i-tya-dictionary.onrender.com/api/words/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: "itya_admin_NT" })
      });

      if (res.ok) {
        alert("消去！");
        window.location.reload();
      } else {
        alert("NO権限");
      }
    } catch (err) {
      console.error("削除エラー:", err);
    }
  };

  // 【修正】自動判定の精度向上版
  const isTranslateSentence = (text) => {
    if (mode === 'word') return false;
    if (mode === 'translate') return true;

    // 助詞・句読点
    if (/[はをがにでもとやのへからだけまでしかこそさえ。、！？]/.test(text)) return true;
    // 動詞活用形
    if (/(?:する|した|して|している|しない|できる|できた|なった|ある|ない|いる|です|ます|ました|ません|だった|だろう|でしょう)$/.test(text)) return true;
    // スペース区切り（複数語）
    if (/\s/.test(text.trim())) return true;
    // 10文字以上
    return text.length >= 10;
  };

  const resetSearch = () => {
    const targetId = clickedWordIdRef.current;

    const doReset = () => {
      setResult(null);
      setTranslationResult(null);
      setIsTranslateMode(false);
      setIsSearching(false);
      setQuery('');
      setError(null);
      setMode('auto'); // 【修正】リセット時にモードも戻す
    };

    if (!document.startViewTransition) {
      doReset();
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
    setError(null);
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

      // 【修正】ステータスチェックをres.json()より先に行う
      if (res.status === 503) {
        setError('overload');
        setIsSearching(false);
        return;
      }

      const data = await res.json();

      if (data.status === 'invalid' || data.status === 'invailed') {
        setError('invalid');
        setIsSearching(false);
        return;
      }
      // サーバーがoverloadをerrorフィールドで返してきた場合も拾う
      if (data.error && (data.error.includes('503') || data.error.includes('high demand') || data.error.includes('混雑'))) {
        setError('overload');
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
          concept: data.meaning || data.meaning_noun || searchQuery,
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
      setError('connection');
      setIsSearching(false);
    }
  };

  const executeTranslation = async (sentence) => {
    setIsSearching(true);
    setResult(null);
    setError(null);

    const MAX_RETRIES = 4;
    const RETRY_DELAY_MS = 3000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch('https://i-tya-dictionary.onrender.com/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sentence }),
        });

        // 503（high demand）はリトライ、最終的に失敗したらoverloadエラー
        if (res.status === 503) {
          console.warn(`[翻訳] 503 high demand、${attempt}回目リトライ待機中...`);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
            continue;
          } else {
            setError('overload');
            setIsSearching(false);
            return;
          }
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("翻訳APIエラー:", res.status, errData);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          setError('connection');
          setIsSearching(false);
          return;
        }

        const data = await res.json();

        if (!data.translation) {
          console.error("翻訳結果が不正:", data);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          setError('connection');
          setIsSearching(false);
          return;
        }

        setTranslationResult(data);
        setIsSearching(false);
        return;

      } catch (err) {
        console.error(`翻訳通信エラー（${attempt}回目）:`, err);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        } else {
          setError('connection');
          setIsSearching(false);
        }
      }
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query || isSearching) return;
    clickedWordIdRef.current = null;

    if (isTranslateSentence(query)) {
      setIsTranslateMode(true);
      setTranslationResult(null);
      executeTranslation(query);
    } else {
      setIsTranslateMode(false);
      setTranslationResult(null);
      if (document.startViewTransition) {
        document.startViewTransition(() => executeSearch(query));
      } else {
        executeSearch(query);
      }
    }
  };

  const handleDictionaryClick = (wordData) => {
    clickedWordIdRef.current = wordData.id;
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
      setError(null);
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

  // 現在のモード表示用（ピルのどちらをアクティブにするか）
  const currentIsTranslate = isTranslateSentence(query);

  const isExpanded = isSearching || result || translationResult || error;

  return (
    <div className="app-container">
      <div className={`content-wrapper ${isExpanded ? 'moved-up' : ''}`}>
        <h1 onClick={handleTitleClick} className={`main-title ${isExpanded ? 'squashed' : ''} ${error ? 'is-error' : ''}`}>
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
              </div>
            )}

            {result && !isSearching && !error && (
              <div className="inner-result fade-in-up">
                {isEditing ? (
                  <div className="admin-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                    <div style={{ color: '#ff4d4d', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}>🔧 管理者データベース編集モード</div>
                    <input
                      value={editConcept}
                      onChange={(e) => setEditConcept(e.target.value)}
                      style={{ fontSize: '1.2rem', padding: '12px', borderRadius: '8px', border: '2px solid #ff4d4d', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                      placeholder="意味・概念を編集"
                    />
                    <textarea
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      style={{ fontSize: '1rem', padding: '12px', height: '150px', borderRadius: '8px', border: '2px solid #ff4d4d', background: 'rgba(0,0,0,0.2)', color: 'white', resize: 'vertical' }}
                      placeholder="解説を編集"
                    />
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '10px' }}>
                      <button type="button" onClick={saveEdit} style={{ background: '#ff4d4d', color: 'white', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>
                        上書き保存
                      </button>
                      <button type="button" onClick={() => setIsEditing(false)} style={{ background: 'transparent', color: '#ff4d4d', padding: '12px 24px', borderRadius: '30px', border: '2px solid #ff4d4d', cursor: 'pointer', fontWeight: 'bold' }}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="concept-header">
                      <div className="concept-text">
                        {result.wordData && result.meaning_noun
                          ? (activePos === 'noun' ? result.meaning_noun
                            : activePos === 'verb' ? result.meaning_verb
                            : result.meaning_extender)
                          : result.concept}
                        {result.status === 'new' && <span className="badge-new">新規</span>}
                        {(result.status === 'complexed' || result.status === 'semi_complexed') && <span className="badge-compound">複合概念</span>}
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
                                el.offsetHeight;
                                el.style.animation = '';
                              }
                            });
                            setActivePos(e.target.value);
                            e.target.blur();
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
                      {isAdmin && (
                        <button className="index-btn admin-btn" onClick={() => {
                          setIsEditing(true);
                          const currentConcept = result.wordData && result.meaning_noun
                            ? (activePos === 'noun' ? result.meaning_noun
                              : activePos === 'verb' ? result.meaning_verb
                              : result.meaning_extender)
                            : result.concept;
                          const currentReason = result.status === 'complexed' || !result.wordData
                            ? result.reason
                            : (activePos === 'noun' ? (result.reason_noun || result.reason)
                              : activePos === 'verb' ? (result.reason_verb || result.reason)
                              : (result.reason_extender || result.reason));
                          setEditConcept(currentConcept || '');
                          setEditReason(currentReason || '');
                        }} style={{ color: '#ff4d4d', borderColor: '#ff4d4d' }}>
                          <Settings size={20} strokeWidth={2.5} />
                        </button>
                      )}

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
                  </>
                )}
              </div>
            )}

            {translationResult && !isSearching && !error && (
              <div className="inner-result fade-in-up">
                <div className="concept-text">
                  {query}
                  <span className="badge-compound">翻訳</span>
                </div>
                <h2 className="word-display" style={{ fontSize: '2.2rem', lineHeight: '1.4' }}>
                  {translationResult.translation}
                </h2>
                <div className="reason-text">
                  {translationResult.breakdown?.map((item, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <span style={{ opacity: 0.6 }}>{item.japanese}</span>
                      {' → '}
                      <strong>{item.itya}</strong>
                      {item.status === 'new' && (
                        <span className="badge-new" style={{ fontSize: '0.8rem', marginLeft: '6px' }}>新規</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="share-buttons">
                  <button className="index-btn" onClick={() => {
                    navigator.clipboard.writeText(translationResult.translation);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}>
                    {copied ? <Check size={20} strokeWidth={3} /> : <Link size={20} strokeWidth={2.5} />}
                  </button>
                  <button className="index-btn" onClick={() => {
                    const text = `「${query}」をi-tyaに翻訳しました！\n「${translationResult.translation}」\n\n#i_tya #NT函館`;
                    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                  }}>
                    <FontAwesomeIcon icon={faXTwitter} />
                  </button>
                </div>
              </div>
            )}

            {error && !isSearching && (
              <div className="inner-result fade-in-up">
                <p className="concept-text">
                  {error === 'overload' ? 'サーバー混雑中' : 'エラー！'}
                </p>
                <h2 className="word-display">
                  {error === 'overload' ? 'High Demand' : 'Error'}
                </h2>
                <div className="reason-text">
                  {error === 'overload' && 'AIサーバーが混雑しています。しばらく待ってから再試行してください。'}
                  {error === 'invalid' && '入力を理解できませんでした。別の表現で試してみてください。'}
                  {error === 'connection' && 'サーバーとの接続に失敗しました。ネットワークを確認してください。'}
                </div>
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

        {/* 【修正】モード切り替えをピルUI化 */}
        {query && !isExpanded && (
          <div className="mode-indicator">
            <div className="mode-toggle-pill">
              <button
                type="button"
                className={`mode-pill-btn ${!currentIsTranslate ? 'active' : ''}`}
                onClick={() => setMode('word')}
              >
                🔍 単語
              </button>
              <button
                type="button"
                className={`mode-pill-btn ${currentIsTranslate ? 'active' : ''}`}
                onClick={() => setMode('translate')}
              >
                📝 翻訳
              </button>
            </div>
          </div>
        )}

        {!isExpanded && (
          <div className="dictionary-wrapper fade-in-up">
            <p className="total-count">{total}語収録中</p>
            <DictionaryList
              onWordClick={handleDictionaryClick}
              onTotalLoaded={(count) => setTotal(count)}
              isAdmin={isAdmin}
              onDelete={deleteWord}
            />
          </div>
        )}

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