import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ArrowUp, Link, Check, Settings, Languages, ShieldCheck, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';
import DictionaryList from './DictionaryList';
import anoSvg from './ano.svg';

// ─── SE（効果音）ユーティリティ ───
const getAudioContext = (() => {
  let ctx = null;
  return () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
})();

function playTone({ frequency = 440, type = 'sine', duration = 0.12, volume = 0.3, attack = 0.01, decay = 0.05, frequencyEnd = null }) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (frequencyEnd) osc.frequency.exponentialRampToValueAtTime(frequencyEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration - decay);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) { /* SE失敗は無視 */ }
}

// 検索ボタンを押したときのSE
const SE_SEARCH = () => {
  playTone({ frequency: 600, type: 'sine', duration: 0.1, volume: 0.25, frequencyEnd: 900 });
};

// 結果が表示されたとき（全ケース共通）のSE（ファンファーレ）
const SE_RESULT = () => {
  try {
    const ctx = getAudioContext();
    // メロディー: タタタ・ターン（付点リズム）
    const melody = [
      { freq: 523.3, t: 0,   dur: 0.1  },  // C5
      { freq: 523.3, t: 110, dur: 0.1  },  // C5
      { freq: 523.3, t: 220, dur: 0.1  },  // C5
      { freq: 392.0, t: 330, dur: 0.18 },  // G4
      { freq: 523.3, t: 510, dur: 0.5  },  // C5 ターン
    ];
    melody.forEach(({ freq, t, dur }) => {
      setTimeout(() => {
        playTone({ frequency: freq, type: 'triangle', duration: dur, volume: 0.28, attack: 0.01, decay: dur * 0.6 });
      }, t);
    });
    // 和音で厚みを出す（ターンのとき）
    setTimeout(() => {
      playTone({ frequency: 329.6, type: 'triangle', duration: 0.5, volume: 0.15, attack: 0.01, decay: 0.4 }); // E4
      playTone({ frequency: 392.0, type: 'triangle', duration: 0.5, volume: 0.15, attack: 0.01, decay: 0.4 }); // G4
    }, 510);
  } catch (e) { /* SE失敗は無視 */ }
};

// 新規単語が登録されたときのSE（ドラムロール→ジャーン）
const SE_NEW_WORD = () => {
  try {
    const ctx = getAudioContext();

    // ─── ドラムロール（スネア連打）───
    const snareHits = 14;
    for (let i = 0; i < snareHits; i++) {
      // 加速しながら連打
      const interval = 120 - i * 7;
      const t = Array.from({ length: i }, (_, j) => 120 - j * 7).reduce((a, b) => a + b, 0);
      setTimeout(() => {
        // ノイズバッファでスネア音を生成
        const bufSize = ctx.sampleRate * 0.08;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let k = 0; k < bufSize; k++) data[k] = (Math.random() * 2 - 1);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        const vol = 0.08 + (i / snareHits) * 0.18;
        g.gain.setValueAtTime(vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000 + i * 100;
        src.connect(filter); filter.connect(g); g.connect(ctx.destination);
        src.start(); src.stop(ctx.currentTime + 0.08);
      }, t);
    }

    // ─── ロール終了時間を計算 ───
    const rollDuration = Array.from({ length: snareHits }, (_, i) => 120 - i * 7).reduce((a, b) => a + b, 0);

    // ─── ジャーン（和音） ───
    const fanfareTime = rollDuration + 30;
    const chordNotes = [261.6, 329.6, 392.0, 523.3]; // C4, E4, G4, C5
    chordNotes.forEach((freq, i) => {
      setTimeout(() => {
        playTone({ frequency: freq, type: 'triangle', duration: 1.2, volume: 0.22, attack: 0.01, decay: 0.9 });
      }, fanfareTime + i * 18);
    });

    // ─── シンバル（ジャーンに重ねる） ───
    setTimeout(() => {
      const bufSize = ctx.sampleRate * 0.6;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufSize; k++) data[k] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      const hipass = ctx.createBiquadFilter();
      hipass.type = 'highpass';
      hipass.frequency.value = 8000;
      src.connect(hipass); hipass.connect(g); g.connect(ctx.destination);
      src.start(); src.stop(ctx.currentTime + 0.6);
    }, fanfareTime);

  } catch (e) { /* SE失敗は無視 */ }
};

// バツで戻るときのSE
const SE_BACK = () => {
  playTone({ frequency: 500, type: 'sine', duration: 0.12, volume: 0.2, frequencyEnd: 300 });
};

// 辞書の単語を押したときのSE
const SE_WORD_CLICK = () => {
  playTone({ frequency: 700, type: 'sine', duration: 0.08, volume: 0.2 });
};

// ─── i-tya語発音ユーティリティ ───
// 音韻規則: (C)(G)V構造、子音h/k/l/m/n/p/s/t、半母音w/y、母音a/i/u
// アクセント: 必ず第一音節に強勢（仕様書 2.2.3）
function parseItyaSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const cons  = new Set(['h','k','l','m','n','p','s','t']);
  const glide = new Set(['w','y']);
  const vowel = new Set(['a','i','u']);
  const syls = [];
  let i = 0;
  while (i < w.length) {
    let syl = '';
    if (i < w.length && cons.has(w[i]))  { syl += w[i]; i++; }
    if (i < w.length && glide.has(w[i])) { syl += w[i]; i++; }
    if (i < w.length && vowel.has(w[i])) { syl += w[i]; i++; }
    if (syl) syls.push(syl); else { i++; }
  }
  return syls.filter(Boolean);
}

// ローマ字→カタカナ変換（日本語TTSで正確なi-tya発音を実現）
const ROMA_TO_KANA = {
  'a':'ア','i':'イ','u':'ウ',
  'ha':'ハ','hi':'ヒ','hu':'フ',
  'ka':'カ','ki':'キ','ku':'ク',
  'la':'ラ','li':'リ','lu':'ル',
  'ma':'マ','mi':'ミ','mu':'ム',
  'na':'ナ','ni':'ニ','nu':'ヌ',
  'pa':'パ','pi':'ピ','pu':'プ',
  'sa':'サ','si':'スィ','su':'ス',
  'ta':'タ','ti':'ティ','tu':'トゥ',
  'wa':'ワ','wi':'ウィ','wu':'ウ',
  'ya':'ヤ','yi':'イ','yu':'ユ',
  'hwa':'ファ','hwi':'フィ','hwu':'フ',
  'kwa':'クァ','kwi':'クィ','kwu':'ク',
  'lwa':'ルァ','lwi':'ルィ','lwu':'ル',
  'mwa':'ムァ','mwi':'ムィ','mwu':'ム',
  'nwa':'ヌァ','nwi':'ヌィ','nwu':'ヌ',
  'pwa':'プァ','pwi':'プィ','pwu':'プ',
  'swa':'スァ','swi':'スィ','swu':'ス',
  'twa':'トァ','twi':'トィ','twu':'ト',
  'hya':'ヒャ','hyi':'ヒ','hyu':'ヒュ',
  'kya':'キャ','kyi':'キ','kyu':'キュ',
  'lya':'リャ','lyi':'リ','lyu':'リュ',
  'mya':'ミャ','myi':'ミ','myu':'ミュ',
  'nya':'ニャ','nyi':'ニ','nyu':'ニュ',
  'pya':'ピャ','pyi':'ピ','pyu':'ピュ',
  'sya':'シャ','syi':'シ','syu':'シュ',
  'tya':'チャ','tyi':'チ','tyu':'チュ',
};

function ityaToKana(word) {
  const syls = parseItyaSyllables(word);
  return syls.map(s => ROMA_TO_KANA[s] || s).join('');
}

// テキスト全体をi-tya音節リストに分解
function buildSyllableMap(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const syllables = [];
  words.forEach((w) => {
    const syls = parseItyaSyllables(w); // 元wordをそのまま渡す（大文字保持）

    // 元のword文字列を走査して、各音節に対応する文字列（大文字・記号込み）を割り当てる
    // アルファベットをsyl.length分消費し、途中の記号はそのまま取り込む
    const charGroups = [];
    let wi = 0;
    syls.forEach((syl) => {
      let chars = '';
      let consumed = 0;
      while (wi < w.length && consumed < syl.length) {
        if (/[a-zA-Z]/.test(w[wi])) { chars += w[wi]; consumed++; wi++; }
        else { chars += w[wi]; wi++; }
      }
      charGroups.push(chars);
    });
    // 末尾に残った記号（?など）を最後の音節グループへ結合
    if (charGroups.length > 0 && wi < w.length) {
      charGroups[charGroups.length - 1] += w.slice(wi);
    }

    syls.forEach((syl, si) => {
      const sylLower = syl.toLowerCase();
      const kana = ROMA_TO_KANA[sylLower] || sylLower;
      syllables.push({ word: w, syl, kana, displayChars: charGroups[si] != null ? charGroups[si] : syl });
    });
  });
  return syllables;
}

// ─── カラオケ表示コンポーネント ───
function KaraokeDisplay({ text, activeSylIndex, syllables }) {
  if (!text || !syllables || syllables.length === 0) return <span>{text}</span>;
  const isSpeaking = activeSylIndex >= 0;
  const wordGroups = [];
  let cur = null;
  syllables.forEach((s, i) => {
    if (!cur || cur.word !== s.word) { cur = { word: s.word, syls: [] }; wordGroups.push(cur); }
    cur.syls.push({ ...s, idx: i });
  });
  return (
    <span className="karaoke-text">
      {wordGroups.map((g, wi) => (
        <React.Fragment key={wi}>
          {wi > 0 && ' '}
          <span className="karaoke-word">
            {g.syls.map(s => (
              <span
                key={s.idx}
                className={`karaoke-syl${isSpeaking ? (s.idx === activeSylIndex ? ' karaoke-active' : ' karaoke-dim') : ''}`}
              >
                {s.displayChars != null ? s.displayChars : s.syl}
              </span>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

// 音節ごとのおおよその発音時間(ms)を推定
// rate=0.85、日本語1モーラ≒約180ms を基準に音節の長さで調整
function estimateSylDuration(kana, rate = 0.85) {
  const base = 110 / rate;
  // 2文字カナ（拗音）は1.3モーラ相当
  return kana.length >= 2 ? base * 1.3 : base;
}

function speakItya(text, onSyllable, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  // 前回のタイマーを管理するため window に退避
  if (window._ityaTimers) window._ityaTimers.forEach(clearTimeout);
  window._ityaTimers = [];

  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const jaVoice =
      voices.find(v => v.lang === 'ja-JP' && /kyoko|otoya|google 日本語|haruka/i.test(v.name)) ||
      voices.find(v => v.lang === 'ja-JP') ||
      voices.find(v => v.lang.startsWith('ja')) || null;

    const rate = 0.85;
    const words = text.trim().split(/\s+/).filter(Boolean);

    // 記号を除去してカナ変換（大文字は維持したまま音節解析）
    const isQuestion = /\?/.test(text);
    const kanaText = words.map(w => {
      const clean = w.replace(/[^a-zA-Z]/g, '');
      return ityaToKana(clean);
    }).join('\u3000');
    if (!kanaText.trim()) return;

    const syllables = buildSyllableMap(text);

    const u = new SpeechSynthesisUtterance(kanaText);
    u.lang = 'ja-JP';
    u.pitch = isQuestion ? 1.6 : 1.3;  // ?文はピッチ上げ
    u.rate = rate;
    u.volume = 1.0;
    if (jaVoice) u.voice = jaVoice;

    u.onstart = () => {
      if (!onSyllable) return;
      // 各音節のタイミングをsetTimeoutで自前スケジュール
      let elapsed = 0;
      syllables.forEach((s, i) => {
        const t = window.setTimeout(() => {
          onSyllable(i, syllables);
        }, elapsed);
        window._ityaTimers.push(t);
        elapsed += estimateSylDuration(s.kana, rate);
      });
    };

    u.onend = () => {
      if (window._ityaTimers) window._ityaTimers.forEach(clearTimeout);
      if (onSyllable) onSyllable(-1, syllables);
      if (onEnd) onEnd();
    };
    u.onerror = () => {
      if (window._ityaTimers) window._ityaTimers.forEach(clearTimeout);
      if (onSyllable) onSyllable(-1, syllables);
      if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(u);
  };
  if (window.speechSynthesis.getVoices().length > 0) doSpeak();
  else window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
}

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
  const [activeSyl, setActiveSyl] = useState(-1);
  const [sylMap, setSylMap] = useState([]);
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
    SE_BACK();
    const targetId = clickedWordIdRef.current;
    const doReset = () => {
      setResult(null); setTranslationResult(null); setReverseResult(null); setReverseTranslationResult(null);
      setIsTranslateMode(false); setIsReverseMode(false); setIsReverseTranslateMode(false);
      setIsSearching(false); setQuery(''); setError(null); setErrorMessage(''); setMode('auto');
      setActiveSyl(-1); setSylMap([]);
    };
    const scrollToWord = () => {
      if (!targetId) return;
      // rAF x2でReactのDOM更新完了後にスクロール
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-word-id="${targetId}"]`);
          if (el) { el.scrollIntoView({ behavior: 'instant', block: 'center' }); return; }
          // まだなければMutationObserverで待機
          const observer = new MutationObserver(() => {
            const el2 = document.querySelector(`[data-word-id="${targetId}"]`);
            if (el2) { el2.scrollIntoView({ behavior: 'instant', block: 'center' }); observer.disconnect(); }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          setTimeout(() => observer.disconnect(), 2000);
        });
      });
    };
    if (!document.startViewTransition) { doReset(); scrollToWord(); return; }
    const t = document.startViewTransition(() => { doReset(); });
    t.finished.finally(() => { scrollToWord(); });
  };

  const executeSearch = async (searchQuery) => {
    safeTransition(() => {
      setIsSearching(true); setResult(null); setError(null); setTrivia("トリビアを読み込み中...");
      setActiveSyl(-1); setSylMap([]);
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

      const finishSearching = () => {
        const finalStatus = data.status || (data.data ? 'existing' : 'unknown');
        const isNew = finalStatus === 'new' || data.is_new === true;
        if (isNew) {
          triggerCelebration(true);  // 盛大
          SE_NEW_WORD();
        } else {
          triggerCelebration(false); // 通常エフェクト（毎回）
        }
        SE_RESULT();
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
      const hasNewWord = Array.isArray(data.words) && data.words.some(w => w.is_new || w.status === 'new');
      safeTransition(() => { SE_RESULT(); triggerCelebration(hasNewWord); setTranslationResult(data); setIsSearching(false); });
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
      safeTransition(() => { SE_RESULT(); triggerCelebration(false); setReverseResult(data); setIsSearching(false); });
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
      safeTransition(() => { SE_RESULT(); triggerCelebration(false); setReverseTranslationResult(data); setIsSearching(false); });
    } catch (err) {
      console.error("逆翻訳通信エラー:", err);
      setError('connection'); setIsSearching(false);
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || isSearching) return;
    SE_SEARCH();
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

    const showDetail = () => {
      SE_WORD_CLICK();
      window.scrollTo({ top: 0, behavior: 'instant' });
      setTrivia('');
      setActiveSyl(-1); setSylMap([]);
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

    safeTransition(showDetail);
  };

  const triggerCelebration = (grand = false) => {
    const duration = grand ? 5000 : 2500;
    const end = Date.now() + duration;

    // ─── エフェクト定義集 ───
    const effects = {
      // 紙吹雪（テーマカラー）
      confetti: () => {
        confetti({ particleCount: grand ? 220 : 100, spread: 80, origin: { y: 0.55 }, colors: ['#70ff70', '#ffffff', '#4a1c53', '#ffdd00', '#ff70c0'] });
      },
      // 星
      stars: () => {
        const defaults = { spread: 360, ticks: 60, gravity: 0.2, decay: 0.93, startVelocity: grand ? 35 : 25, colors: ['#FFE400','#FFBD00','#E89400','#ff70c0','#70ffff'] };
        const shoot = () => {
          confetti({ ...defaults, particleCount: grand ? 60 : 30, scalar: 1.3, shapes: ['star'] });
          confetti({ ...defaults, particleCount: grand ? 20 : 8, scalar: 0.8, shapes: ['circle'] });
        };
        shoot();
        if (grand) { setTimeout(shoot, 150); setTimeout(shoot, 300); }
      },
      // 花火（左右から）
      fireworks: () => {
        let i = 0;
        const max = grand ? 80 : 30;
        (function frame() {
          confetti({ particleCount: 3, angle: 60,  spread: 60, origin: { x: 0,    y: 0.8 }, colors: ['#70ff70','#ffdd00','#ff70c0'] });
          confetti({ particleCount: 3, angle: 120, spread: 60, origin: { x: 1,    y: 0.8 }, colors: ['#ffffff','#70ffff','#4a1c53'] });
          confetti({ particleCount: 2, angle: 90,  spread: 80, origin: { x: 0.5,  y: 0.9 }, colors: ['#ffdd00','#ff70c0'] });
          if (++i < max) requestAnimationFrame(frame);
        }());
      },
      // 虹の紙吹雪（左→右へ流れる）
      rainbow: () => {
        const colors = ['#ff0000','#ff7700','#ffdd00','#00ff00','#00aaff','#7700ff','#ff00aa'];
        colors.forEach((color, ci) => {
          setTimeout(() => {
            confetti({ particleCount: grand ? 30 : 15, spread: 50, origin: { x: ci / (colors.length - 1), y: 0.4 }, colors: [color], scalar: 1.1, gravity: 0.6 });
          }, ci * (grand ? 80 : 120));
        });
      },
      // ハート
      hearts: () => {
        const heartShape = confetti.shapeFromText({ text: '❤', scalar: 2 });
        confetti({ shapes: [heartShape], particleCount: grand ? 60 : 25, spread: 120, origin: { y: 0.5 }, scalar: 1.5, gravity: 0.5, ticks: grand ? 80 : 50 });
        if (grand) setTimeout(() => {
          confetti({ shapes: [heartShape], particleCount: 40, spread: 90, origin: { x: 0.3, y: 0.6 }, scalar: 1.2, gravity: 0.6, ticks: 70 });
          confetti({ shapes: [heartShape], particleCount: 40, spread: 90, origin: { x: 0.7, y: 0.6 }, scalar: 1.2, gravity: 0.6, ticks: 70 });
        }, 300);
      },
      // 雪（ゆっくり落下）
      snow: () => {
        let i = 0;
        const max = grand ? 60 : 25;
        (function frame() {
          confetti({ particleCount: 2, angle: 90, spread: 120, origin: { x: Math.random(), y: 0 }, colors: ['#ffffff','#aaddff','#ddeeff'], gravity: 0.3, ticks: 200, scalar: 1.2, shapes: ['circle'] });
          if (++i < max) setTimeout(frame, 80);
        }());
      },
      // 三角形・四角形ミックス
      shapes: () => {
        confetti({ particleCount: grand ? 140 : 60, spread: 100, origin: { y: 0.5 }, shapes: ['square','circle'], colors: ['#70ff70','#ff70c0','#ffdd00','#70ffff','#ffffff'], scalar: 1.2 });
      },
      // キラキラ（中央爆発）
      sparkle: () => {
        [0, 100, 200, 300].forEach(t => setTimeout(() => {
          confetti({ particleCount: grand ? 50 : 20, spread: 360, ticks: 50, gravity: 0, decay: 0.95, startVelocity: grand ? 20 : 12, origin: { x: 0.5, y: 0.5 }, colors: ['#FFE400','#ffffff','#70ffff','#ff70c0'] });
        }, t));
      },
      // 絵文字パーティ
      emoji: () => {
        const emojis = ['🎉','✨','🌟','💫','🎊'];
        emojis.forEach((e, i) => {
          setTimeout(() => {
            confetti({ shapes: [confetti.shapeFromText({ text: e, scalar: 2 })], particleCount: grand ? 20 : 10, spread: 100, origin: { x: 0.2 + i * 0.15, y: 0.5 }, scalar: 1.5, gravity: 0.5, ticks: 60 });
          }, i * 80);
        });
      },
    };

    if (grand) {
      // 盛大モード: 複数エフェクトを連続発火
      effects.fireworks();
      setTimeout(() => effects.stars(),    400);
      setTimeout(() => effects.confetti(), 700);
      setTimeout(() => effects.rainbow(),  1100);
      setTimeout(() => effects.hearts(),   1600);
      setTimeout(() => effects.sparkle(),  2200);
      setTimeout(() => effects.emoji(),    2800);
      setTimeout(() => effects.fireworks(), 3500);
      setTimeout(() => {
        confetti({ particleCount: 300, spread: 180, origin: { y: 0.5 }, colors: ['#70ff70','#ffffff','#4a1c53','#ffdd00','#ff70c0','#70ffff'], scalar: 1.3 });
      }, 4200);
    } else {
      // 通常モード: ランダムに1〜2種類
      const keys = Object.keys(effects);
      const pick = keys[Math.floor(Math.random() * keys.length)];
      effects[pick]();
      if (Math.random() < 0.4) {
        const pick2 = keys[Math.floor(Math.random() * keys.length)];
        setTimeout(() => effects[pick2](), 500);
      }
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
                            setActiveSyl(-1); setSylMap([]);
                            e.target.blur();
                          }}
                        >
                          <option value="noun">名詞</option>
                          <option value="verb">動詞</option>
                          <option value="extender">拡張詞</option>
                        </select>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <h2 className="word-display" style={{ margin: 0 }}>
                        <KaraokeDisplay
                          text={result.wordData && result.status !== 'complexed' ? result.wordData[activePos] : result.displayWord}
                          activeSylIndex={activeSyl}
                          syllables={sylMap}
                        />
                      </h2>
                      <button type="button"
                        className="index-btn pronounce-icon-btn"
                        onClick={() => speakItya(
                          result.wordData && result.status !== 'complexed'
                            ? (result.wordData[activePos] || result.displayWord)
                            : result.displayWord,
                          (idx, syls) => { setActiveSyl(idx); setSylMap(syls); },
                          () => setActiveSyl(-1)
                        )}>
                        <Volume2 size={20} strokeWidth={2.5} />
                      </button>
                    </div>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <h2 className="word-display" style={{ fontSize: '2.2rem', lineHeight: '1.4', margin: 0 }}>
                    <KaraokeDisplay text={translationResult.translation} activeSylIndex={activeSyl} syllables={sylMap} />
                  </h2>
                  <button type="button" className="index-btn pronounce-icon-btn"
                    onClick={() => speakItya(translationResult.translation,
                      (idx, syls) => { setActiveSyl(idx); setSylMap(syls); },
                      () => setActiveSyl(-1))}>
                    <Volume2 size={20} strokeWidth={2.5} />
                  </button>
                </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <h2 className="word-display" style={{ fontSize: '2.2rem', lineHeight: '1.4', margin: 0 }}>
                        <KaraokeDisplay text={query} activeSylIndex={activeSyl} syllables={sylMap} />
                      </h2>
                      <button type="button" className="index-btn pronounce-icon-btn"
                        onClick={() => speakItya(query,
                          (idx, syls) => { setActiveSyl(idx); setSylMap(syls); },
                          () => setActiveSyl(-1))}>
                        <Volume2 size={20} strokeWidth={2.5} />
                      </button>
                    </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <h2 className="word-display word-display-but-japanese" style={{ fontSize: '2.2rem', lineHeight: '1.4', margin: 0 }}>
                    <KaraokeDisplay text={query} activeSylIndex={activeSyl} syllables={sylMap} />
                  </h2>
                  <button type="button" className="index-btn pronounce-icon-btn"
                    onClick={() => speakItya(query,
                      (idx, syls) => { setActiveSyl(idx); setSylMap(syls); },
                      () => setActiveSyl(-1))}>
                    <Volume2 size={20} strokeWidth={2.5} />
                  </button>
                </div>
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