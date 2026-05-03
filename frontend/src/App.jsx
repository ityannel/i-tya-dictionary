import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ArrowUp, Link, Check, Settings, Languages, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import DictionaryList from './DictionaryList';
import anoSvg from './ano.svg';

// ─── 管理者ログインモーダル ───
function AdminLoginModal({ onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('https://i-tya-dictionary.onrender.com/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.ok) {
        onSuccess(password);
      } else {
        setShake(true);
        setPassword('');
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="admin-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`admin-modal-box ${shake ? 'admin-shake' : 'admin-slide-up'}`}>
        <div className="admin-modal-title">管理者認証</div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            className="admin-modal-input"
          />
          <div className="admin-modal-actions">
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className={`admin-modal-submit${isLoading || !password.trim() ? ' disabled' : ''}`}
            >
              {isLoading ? '認証中...' : '認証する'}
            </button>
            <button type="button" onClick={onClose} className="admin-modal-cancel">
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── エラー表示 ───
function ErrorDisplay({ error, errorMessage }) {
  const messages = {
    overload: { title: 'サーバー混雑中', desc: errorMessage || 'しばらく待ってからもう一度試してください。' },
    invalid: { title: '入力エラー', desc: 'i-tyaに変換できない入力です。日本語で入力してください。' },
    connection: { title: '接続失敗', desc: 'サーバーに接続できませんでした。ネットワークを確認してください。' },
  };
  const msg = messages[error] || { title: 'エラー', desc: '不明なエラーが発生しました。' };
  return (
    <div className="error-display fade-in-up">
      <div className="error-title">{msg.title}</div>
      <div className="error-desc">{msg.desc}</div>
    </div>
  );
}

// ─── メインアプリ ───
export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [trivia, setTrivia] = useState('');
  const [showTopBtn, setShowTopBtn] = useState(false);
  const clickedWordIdRef = useRef(null);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activePos, setActivePos] = useState('noun');
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('isAdmin') === 'true');
  const [adminPassword, setAdminPassword] = useState(() => sessionStorage.getItem('adminPassword') || '');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editConcept, setEditConcept] = useState('');
  const [editReason, setEditReason] = useState('');
  const [mode, setMode] = useState('auto');
  const [isTranslateMode, setIsTranslateMode] = useState(false);
  const [dictRefreshKey, setDictRefreshKey] = useState(0);
  const [translationResult, setTranslationResult] = useState(null);
  const timerRef = useRef(null);
  const isLongPress = useRef(false);
  const hasSearchedFromUrl = useRef(false);
  const [iconScale, setIconScale] = useState(1);
  const [displayIconType, setDisplayIconType] = useState('search');
  const [errorMessage, setErrorMessage] = useState('');
  const [anoClicked, setAnoClicked] = useState(false);
  const [reverseResult, setReverseResult] = useState(null);
  const [isReverseMode, setIsReverseMode] = useState(false);
  const [reverseTranslationResult, setReverseTranslationResult] = useState(null);
  const [isReverseTranslateMode, setIsReverseTranslateMode] = useState(false);

  const handleAnoClick = () => {
    if (anoClicked) return;
    setAnoClicked(true);
    setTimeout(() => {
      window.open('https://swa-wold.web.app/3d-space.html', '_blank');
      setAnoClicked(false);
    }, 900);
  };

  // 削除モード
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [wordMap, setWordMap] = useState({});

  const isExpanded = isSearching || result || translationResult || reverseResult || reverseTranslationResult || error;

  const handleTouchStart = () => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setMode(prev => prev === 'translate' ? 'word' : 'translate');
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

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
    let targetIcon = 'search';
    if (isExpanded) targetIcon = 'x';
    else if (mode === 'translate') targetIcon = 'translate';
    else if (mode === 'reverse') targetIcon = 'reverse';
    else if (mode === 'reverse-translate') targetIcon = 'reverse-translate';

    if (displayIconType !== targetIcon) {
      setIconScale(0);
      const timer = setTimeout(() => {
        setDisplayIconType(targetIcon);
        setIconScale(1);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, mode, displayIconType]);

  useEffect(() => {
    let triviaInterval;
    if (isSearching) {
      triviaInterval = setInterval(async () => {
        try {
          const trRes = await fetch('https://i-tya-dictionary.onrender.com/api/trivias');
          const trData = await trRes.json();
          if (Array.isArray(trData) && trData.length > 0) {
            setTrivia(trData[Math.floor(Math.random() * trData.length)]);
          }
        } catch (err) {
          console.log("トリビアの定期取得に失敗！", err);
        }
      }, 5000);
    }
    return () => clearInterval(triviaInterval);
  }, [isSearching]);

  useEffect(() => {
    const handleScroll = () => setShowTopBtn(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activeTransitionRef = useRef(null);

const safeTransition = (callback) => {
  if (!document.startViewTransition) {
    callback();
    return;
  }
  // If a transition is already running, finish it and just run callback directly
  if (activeTransitionRef.current) {
    callback();
    return;
  }
  const t = document.startViewTransition(() => {
    callback();
  });
  activeTransitionRef.current = t;
  t.finished.finally(() => {
    activeTransitionRef.current = null;
  });
};

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const loadingMessages = isReverseMode
    ? ["をi-tya辞書で逆引き中...", "の音節構造を解析中...", "の日本語訳を検索中..."]
    : isReverseTranslateMode
    ? ["をi-tyaから日本語に翻訳中...", "の文法構造を解析中...", "の各単語を照合中..."]
    : isTranslateMode
    ? ["を日本語からi-tyaに翻訳中...", "の文法構造を解析中...", "の単語を照合中..."]
    : ["をデータベースから検索中...", "の統語構造を分析中...", "の説明を生成中..."];

  useEffect(() => {
    let interval;
    if (isSearching) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isSearching, isTranslateMode, isReverseMode, isReverseTranslateMode]);

  const handleTitleClick = () => {
    clickCountRef.current += 1;
    if (clickCountRef.current === 5) {
      if (!isAdmin) {
        setShowAdminModal(true);
      } else {
        if (window.confirm('管理者権限を解除しますか？')) {
          setIsAdmin(false);
          setAdminPassword('');
          sessionStorage.removeItem('isAdmin');
          sessionStorage.removeItem('adminPassword');
          setDeleteMode(false);
          setSelectedIds([]);
        }
      }
      clickCountRef.current = 0;
    }
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 1000);
  };

  const handleAdminSuccess = (pass) => {
    setIsAdmin(true);
    setAdminPassword(pass);
    sessionStorage.setItem('isAdmin', 'true');
    sessionStorage.setItem('adminPassword', pass);
    setShowAdminModal(false);
  };

  const saveEdit = async () => {
    if (!result.id) { alert("ドキュメントIDがねえから更新できません！"); return; }
    try {
      const res = await fetch(`https://i-tya-dictionary.onrender.com/api/words/${result.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, meaning: editConcept, reason: editReason })
      });
      if (res.ok) {
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
        body: JSON.stringify({ password: adminPassword })
      });
      if (res.ok) {
        resetSearch();
        setDictRefreshKey(k => k + 1);
      } else {
        alert("NO権限");
      }
    } catch (err) {
      console.error("削除エラー:", err);
    }
  };

  // 選択トグル（削除モード時にDictionaryListから呼ばれる）
  const toggleSelectId = (id, word) => {
    setWordMap(prev => ({ ...prev, [id]: word }));
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const names = selectedIds.map(id => `「${wordMap[id]}」`).join('、');
    if (!window.confirm(`合計${selectedIds.length}この単語を削除していいですか？\n${names}`)) return;
    for (const id of selectedIds) {
      try {
        await fetch(`https://i-tya-dictionary.onrender.com/api/words/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: adminPassword })
        });
      } catch (err) {
        console.error("削除エラー:", err);
      }
    }
    setSelectedIds([]);
    setWordMap({});
    setDeleteMode(false);
    setDictRefreshKey(k => k + 1);
  };

  // i-tya語かどうかを正規表現で判定（ラテン文字のみ＋i-tya音韻文字）
  const isItyaWord = (text) => {
    const t = text.trim().toLowerCase();
    if (!t) return false;
    // i-tya語：a,i,u,h,k,l,m,n,p,s,t,w,y のみで構成（大文字固有名詞も許容）
    return /^[a-zA-Z\s,.'!?]+$/.test(t) && /^(?:[A-Z]?[hklmnpstwya-z]+[\s,.'!?]*)+$/.test(t);
  };

  // i-tya文章かどうか判定（複数単語 or 句読点あり）
  const isItyaSentence = (text) => {
    const t = text.trim();
    if (!t) return false;
    if (!isItyaWord(t)) return false; // i-tya語でなければfalse
    // 複数単語（スペース区切り）か句読点を含む場合は文章とみなす
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return true;
    if (/[,.'!?]/.test(t)) return true;
    return false;
  };

  const isTranslateSentence = (text) => {
    const t = text.trim();
    if (!t) return false;
    if (isItyaWord(t)) return false; // i-tya語は翻訳判定しない
    if (/[。、！？\s]/.test(t)) return true;
    if (/(?:する|した|して|している|しない|できる|できた|なった|ある|ない|いる|です|ます|ました|ません|だった|だろう|でしょう|ください|なさい|たい|させる|られる)$/.test(t)) return true;
    if (/[をにがへでと][ぁ-ん一-龥a-zA-Z]+[うくぐすつぬぶむるただ]$/.test(t)) return true;
    return t.length >= 12;
  };

  const resetSearch = () => {
    const targetId = clickedWordIdRef.current;
    const doReset = () => {
      setResult(null); setTranslationResult(null); setReverseResult(null); setReverseTranslationResult(null);
      setIsTranslateMode(false); setIsReverseMode(false); setIsReverseTranslateMode(false);
      setIsSearching(false); setQuery(''); setError(null); setErrorMessage(''); setMode('auto');
    };
    if (!document.startViewTransition) {
      doReset();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (targetId) {
          const el = document.querySelector(`[data-word-id="${targetId}"]`);
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      }));
      return;
    }
    safeTransition(doReset);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (targetId) {
        const el = document.querySelector(`[data-word-id="${targetId}"]`);
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    }));
  };

  const executeSearch = async (searchQuery) => {
    safeTransition(() => {
      setIsSearching(true); setResult(null); setError(null); setTrivia("トリビアを読み込み中...");
    });
    try {
      const trRes = await fetch('https://i-tya-dictionary.onrender.com/api/trivias');
      const trData = await trRes.json();
      if (Array.isArray(trData) && trData.length > 0)
        setTrivia(trData[Math.floor(Math.random() * trData.length)]);
    } catch {}

    try {
      const res = await fetch('https://i-tya-dictionary.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: searchQuery }),
      });
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setError('overload'); setErrorMessage(errData.error || ''); setIsSearching(false); return;
      }
      const data = await res.json();
      if (data.status === 'invalid' || data.status === 'invailed') {
        setError('invalid'); setIsSearching(false); return;
      }
      if (data.error && (data.error.includes('503') || data.error.includes('high demand') || data.error.includes('混雑'))) {
        setError('overload'); setErrorMessage(data.error); setIsSearching(false); return;
      }

      let parsedRoot = "-", displayWord = "???", suffix = "a", posKey = "noun";
      if (data.part_of_speech === "verb") { suffix = "i"; posKey = "verb"; }
      else if (data.part_of_speech === "extender") { suffix = "u"; posKey = "extender"; }

      if (data.data) {
        parsedRoot = data.data.noun ? data.data.noun.slice(0, -1) : "-";
        displayWord = data.data[posKey] || data.data.noun || "???";
      } else if (data.status === 'complexed' || data.status === 'semi_complexed') {
        parsedRoot = "複合概念"; displayWord = data.combination || "???";
      } else if (data.status === 'new' || data.status === 'existing') {
        if (data.root) { parsedRoot = data.root; displayWord = data.root + suffix; }
      }
      // AIが既存判定でdataもrootもない場合（root_word.2 直接返し）
      if (displayWord === "???" && data['root_word.2']) {
        const r = data['root_word.2'];
        const pos = data['part_of_speech_word.2'] || 'noun';
        const s = pos === 'verb' ? 'i' : pos === 'extender' ? 'u' : 'a';
        parsedRoot = r; displayWord = r + s; posKey = pos;
        if (pos === 'verb') suffix = 'i';
        else if (pos === 'extender') suffix = 'u';
      }

      const finishSearching = () => {
        const finalStatus = data.status || (data.data ? 'existing' : 'unknown');
        if (finalStatus === "new") {
          const effects = ["confetti", "stars", "fireworks"];
          triggerCelebration(effects[Math.floor(Math.random() * effects.length)]);
        }
        setResult({
          status: data.status || 'unknown',
          concept: data.meaning || data.meaning_noun || searchQuery,
          root: parsedRoot, displayWord,
          reason: data.reason || "解説はまだ準備されていません！",
          reason_noun: data.reason_noun || data.reason || "解説はまだ準備されていません！",
          reason_verb: data.reason_verb || data.reason || "解説はまだ準備されていません！",
          reason_extender: data.reason_extender || data.reason || "解説はまだ準備されていません！",
          meaning_noun: data.meaning_noun, meaning_verb: data.meaning_verb, meaning_extender: data.meaning_extender,
          wordData: data.data || (data.root ? { noun: data.root + 'a', verb: data.root + 'i', extender: data.root + 'u' } : null),
          isNew: finalStatus === 'new' || data.is_new === true,
          id: data.id
        });
        setActivePos(posKey || 'noun');
        setIsSearching(false);
      };
      safeTransition(() => {
        setTrivia(data.trivia || "この概念に関するトリビアはまだありません！");
        finishSearching();
      });
    } catch (err) {
      console.error("通信エラー！", err);
      safeTransition(() => { setError('connection'); setIsSearching(false); });
    }
  };

  const executeTranslation = async (sentence) => {
    safeTransition(() => { setIsSearching(true); setResult(null); setError(null); });
    try {
      const res = await fetch('https://i-tya-dictionary.onrender.com/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence }),
      });
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setError('overload'); setErrorMessage(errData.error || ''); setIsSearching(false); return;
      }
      if (!res.ok) { setError('connection'); setIsSearching(false); return; }
      const data = await res.json();
      if (!data.translation) { setError('connection'); setIsSearching(false); return; }
      safeTransition(() => { setTranslationResult(data); setIsSearching(false); });
    } catch (err) {
      console.error("翻訳通信エラー:", err);
      setError('connection'); setIsSearching(false);
    }
  };

  const executeReverse = async (word) => {
    safeTransition(() => { setIsSearching(true); setResult(null); setError(null); setReverseResult(null); });
    try {
      const trRes = await fetch('https://i-tya-dictionary.onrender.com/api/trivias');
      const trData = await trRes.json();
      if (Array.isArray(trData) && trData.length > 0)
        setTrivia(trData[Math.floor(Math.random() * trData.length)]);
    } catch {}
    try {
      const res = await fetch('https://i-tya-dictionary.onrender.com/api/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setError('overload'); setErrorMessage(errData.error || ''); setIsSearching(false); return;
      }
      if (!res.ok) { setError('connection'); setIsSearching(false); return; }
      const data = await res.json();
      if (data.error) { setError('invalid'); setIsSearching(false); return; }
      safeTransition(() => { setReverseResult(data); setIsSearching(false); });
    } catch (err) {
      console.error("逆引き通信エラー:", err);
      setError('connection'); setIsSearching(false);
    }
  };

  const executeReverseTranslation = async (sentence) => {
    safeTransition(() => { setIsSearching(true); setResult(null); setError(null); setReverseTranslationResult(null); });
    try {
      const trRes = await fetch('https://i-tya-dictionary.onrender.com/api/trivias');
      const trData = await trRes.json();
      if (Array.isArray(trData) && trData.length > 0)
        setTrivia(trData[Math.floor(Math.random() * trData.length)]);
    } catch {}
    try {
      const res = await fetch('https://i-tya-dictionary.onrender.com/api/reverse-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence }),
      });
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setError('overload'); setErrorMessage(errData.error || ''); setIsSearching(false); return;
      }
      if (!res.ok) { setError('connection'); setIsSearching(false); return; }
      const data = await res.json();
      if (!data.translation) { setError('connection'); setIsSearching(false); return; }
      safeTransition(() => { setReverseTranslationResult(data); setIsSearching(false); });
    } catch (err) {
      console.error("逆翻訳通信エラー:", err);
      setError('connection'); setIsSearching(false);
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || isSearching) return;
    clickedWordIdRef.current = null;
    if (isItyaSentence(query)) {
      // i-tya文章 → 日本語へ逆翻訳
      setIsReverseTranslateMode(true); setIsReverseMode(false); setIsTranslateMode(false);
      setTranslationResult(null); setReverseResult(null);
      executeReverseTranslation(query);
    } else if (isItyaWord(query)) {
      // i-tya単語 → 逆引き
      setIsReverseMode(true); setIsReverseTranslateMode(false); setIsTranslateMode(false);
      setTranslationResult(null); setReverseResult(null);
      executeReverse(query);
    } else if (mode === 'translate' || isTranslateSentence(query)) {
      // 日本語文章 → i-tya翻訳
      setIsTranslateMode(true); setIsReverseMode(false); setIsReverseTranslateMode(false);
      setTranslationResult(null); executeTranslation(query);
    } else {
      // 日本語単語 → 検索
      setIsTranslateMode(false); setIsReverseMode(false); setIsReverseTranslateMode(false);
      setTranslationResult(null);
      executeSearch(query);
    }
  };

  const handleDictionaryClick = (wordData) => {
    // 削除モード中は詳細画面に飛ばず選択トグル
    if (deleteMode) {
      toggleSelectId(wordData.id, wordData.word);
      return;
    }

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
        id: wordData.id
      });
      setIsSearching(false); setError(null);
    };

    safeTransition(safeDetail);
  };

  const triggerCelebration = (type) => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    if (type === 'confetti') {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#70ff70', '#ffffff', '#4a1c53'] });
    } else if (type === 'stars') {
      const defaults = { spread: 360, ticks: 50, gravity: 0, decay: 0.94, startVelocity: 30, colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'] };
      const shoot = () => {
        confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ['star'] });
        confetti({ ...defaults, particleCount: 10, scalar: 0.75, shapes: ['circle'] });
      };
      setTimeout(shoot, 0); setTimeout(shoot, 100); setTimeout(shoot, 200);
    } else if (type === 'fireworks') {
      (function frame() {
        confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#70ff70'] });
        confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ffffff'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
    }
  };

  return (
    <div className="app-container">
      {showAdminModal && (
        <AdminLoginModal onClose={() => setShowAdminModal(false)} onSuccess={handleAdminSuccess} />
      )}

      {/* 管理者バッジ（アイコンのみ） */}
      {isAdmin && (
        <button
          className="admin-badge-btn"
          onClick={() => {
            if (window.confirm('管理者権限を解除しますか？')) {
              setIsAdmin(false); setAdminPassword('');
              sessionStorage.removeItem('isAdmin'); sessionStorage.removeItem('adminPassword');
              setDeleteMode(false); setSelectedIds([]);
            }
          }}
          title="管理者モード（クリックで解除）"
        >
          <ShieldCheck size={22} strokeWidth={2} />
        </button>
      )}

      <div className={`content-wrapper ${isExpanded ? 'moved-up' : ''}`}>
        <div className="title-row">
          <h1
            onClick={handleTitleClick}
            className={`main-title ${isExpanded ? 'squashed' : ''} ${error ? 'is-error' : ''}`}
          >
            Swa i-tya!
          </h1>
          <button
            className={`ano-btn ${anoClicked ? 'ano-btn--flying' : ''}`}
            onClick={handleAnoClick}
            aria-label="SwaSwa!"
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <img src={anoSvg} alt="ano" className="ano-img" style={{ height: '1em', width: 'auto' }} />
          </button>
        </div>

        <form id="search-form" onSubmit={handleSearch} className="search-form">
          <div className={`morph-box ${isExpanded ? 'expanded' : ''} ${error ? 'is-error' : ''}`}>
            <input
              type="text"
              className={`morph-input ${isExpanded ? 'hidden' : ''}`}
              placeholder={mode === 'translate' ? "文章を翻訳..." : mode === 'reverse' ? "i-tyaで検索..." : mode === 'reverse-translate' ? "文章を翻訳..." : "日本語で検索..."}
              value={query}
              onChange={(e) => {
                const newText = e.target.value;
                setQuery(newText);
                if (newText.trim() !== '') {
                  if (isItyaSentence(newText)) setMode('reverse-translate');
                  else if (isItyaWord(newText)) setMode('reverse');
                  else setMode(isTranslateSentence(newText) ? 'translate' : 'word');
                }
              }}
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
                  <div className="admin-edit-form">
                    <div className="admin-edit-title">管理者データベース編集</div>
                    <input
                      className="admin-edit-input"
                      value={editConcept}
                      onChange={(e) => setEditConcept(e.target.value)}
                      placeholder="意味・概念を編集"
                    />
                    <textarea
                      className="admin-edit-textarea"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="解説を編集"
                    />
                    <div className="admin-edit-actions">
                      <button type="button" className="admin-save-btn" onClick={saveEdit}>上書き保存</button>
                      <button type="button" className="admin-cancel-btn" onClick={() => setIsEditing(false)}>キャンセル</button>
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
                              if (el) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }
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
                          : (result.reason_extender || result.reason))}
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
                        }}>
                          <Settings size={20} strokeWidth={2.5} />
                        </button>
                      )}
                      {isAdmin && result.id && (
                        <button className="index-btn admin-btn" onClick={() => deleteWord(result.id, result.displayWord)}>
                          <X size={20} strokeWidth={2.5} />
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
                        const text = result.status === 'new'
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
                      {' → '}<strong>{item.itya}</strong>
                      {item.status === 'new' && <span className="badge-new" style={{ fontSize: '0.8rem', marginLeft: '6px' }}>新規</span>}
                    </div>
                  ))}
                </div>
                <div className="share-buttons">
                  <button className="index-btn" onClick={() => {
                    navigator.clipboard.writeText(translationResult.translation);
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
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
              <ErrorDisplay error={error} errorMessage={errorMessage} />
            )}

            {reverseResult && !isSearching && !error && (
              <div className="inner-result fade-in-up">
                <div className="concept-text">
                  {query}
                  <span className="badge-compound">逆引き</span>
                </div>
                {reverseResult.found ? (
                  <>
                    <h2 className="word-display" style={{ fontSize: '2.2rem', lineHeight: '1.4' }}>
                      {reverseResult.meaning}
                    </h2>
                    <div className="reason-text">
                      {reverseResult.pos && (
                        <div style={{ marginBottom: '8px', opacity: 0.7 }}>
                          品詞: {reverseResult.pos === 'noun' ? '名詞 (-a)' : reverseResult.pos === 'verb' ? '動詞 (-i)' : '拡張詞 (-u)'}
                        </div>
                      )}
                      {reverseResult.forms && (
                        <div style={{ marginBottom: '12px' }}>
                          <span style={{ opacity: 0.6 }}>名詞: </span><strong>{reverseResult.forms.noun}</strong>
                          {'　'}<span style={{ opacity: 0.6 }}>動詞: </span><strong>{reverseResult.forms.verb}</strong>
                          {'　'}<span style={{ opacity: 0.6 }}>拡張詞: </span><strong>{reverseResult.forms.extender}</strong>
                        </div>
                      )}
                      {reverseResult.reason && <div>{reverseResult.reason}</div>}
                    </div>
                  </>
                ) : (
                  <div className="reason-text" style={{ opacity: 0.7 }}>
                    「{query}」はi-tya辞書に登録されていません。
                  </div>
                )}
                <div className="share-buttons">
                  <button className="index-btn" onClick={() => {
                    navigator.clipboard.writeText(`${query} → ${reverseResult.meaning || '未登録'}`);
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }}>
                    {copied ? <Check size={20} strokeWidth={3} /> : <Link size={20} strokeWidth={2.5} />}
                  </button>
                  <button className="index-btn" onClick={() => {
                    const text = `i-tya語「${query}」の意味は「${reverseResult.meaning}」です！\n\n#i_tya #NT函館`;
                    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                  }}>
                    <FontAwesomeIcon icon={faXTwitter} />
                  </button>
                </div>
              </div>
            )}

            {reverseTranslationResult && !isSearching && !error && (
              <div className="inner-result fade-in-up">
                <div className="concept-text">
                  {query}
                  <span className="badge-compound">翻訳</span>
                </div>
                <h2 className="word-display word-display-but-japanese" style={{ fontSize: '2.2rem', lineHeight: '1.4' }}>
                  {reverseTranslationResult.translation}
                </h2>
                <div className="reason-text">
                  {reverseTranslationResult.breakdown?.map((item, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <strong>{item.itya}</strong>
                      {' → '}<span style={{ opacity: 0.6 }}>{item.japanese}</span>
                      {item.role && <span style={{ opacity: 0.45, fontSize: '0.85em', marginLeft: '6px' }}>（{item.role}）</span>}
                    </div>
                  ))}
                </div>
                <div className="share-buttons">
                  <button className="index-btn" onClick={() => {
                    navigator.clipboard.writeText(reverseTranslationResult.translation);
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }}>
                    {copied ? <Check size={20} strokeWidth={3} /> : <Link size={20} strokeWidth={2.5} />}
                  </button>
                  <button className="index-btn" onClick={() => {
                    const text = `i-tya文「${query}」の日本語訳は「${reverseTranslationResult.translation}」です！\n\n#i_tya #NT函館`;
                    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                  }}>
                    <FontAwesomeIcon icon={faXTwitter} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type={isExpanded ? "button" : "submit"}
            className={`search-button ${isExpanded ? 'stored' : ''}`}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
              if (isLongPress.current) { e.preventDefault(); isLongPress.current = false; return; }
              if (isExpanded) { e.preventDefault(); resetSearch(); }
            }}
            style={{ userSelect: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
          >
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${iconScale})`,
              transition: iconScale === 0
                ? 'transform 0.15s ease-in'
                : 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
              {displayIconType === 'x' && <X size={28} strokeWidth={3.5} />}
              {displayIconType === 'translate' && <Languages size={28} strokeWidth={2} />}
              {displayIconType === 'reverse' && <Search size={28} strokeWidth={2} style={{ transform: 'scaleX(-1)' }} />}
              {displayIconType === 'reverse-translate' && <Languages size={28} strokeWidth={2} style={{ transform: 'scaleX(-1)' }} />}
              {displayIconType === 'search' && <Search size={28} strokeWidth={3.5} />}
            </span>
          </button>
        </form>

        {!isExpanded && (
          <div className="dictionary-wrapper fade-in-up">
            <p className="total-count">{total}語収録中</p>

            {/* 管理者削除モードツールバー */}
            {isAdmin && (
              <div className="admin-delete-toolbar">
                {!deleteMode ? (
                  <button
                    className="admin-delete-mode-btn"
                    onClick={() => { setDeleteMode(true); setSelectedIds([]); setWordMap({}); }}
                  >
                    削除モード
                  </button>
                ) : (
                  <>
                    <button
                      className="admin-delete-mode-btn admin-delete-mode-btn--cancel"
                      onClick={() => { setDeleteMode(false); setSelectedIds([]); setWordMap({}); }}
                    >
                      キャンセル
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        className="admin-delete-mode-btn admin-delete-mode-btn--confirm"
                        onClick={executeBulkDelete}
                      >
                        合計{selectedIds.length}個を削除
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <DictionaryList
              key={dictRefreshKey}
              onWordClick={handleDictionaryClick}
              onTotalLoaded={(count) => setTotal(count)}
              isAdmin={isAdmin}
              deleteMode={deleteMode}
              selectedIds={selectedIds}
              onSelectToggle={toggleSelectId}
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