import React, { useState, useEffect, useRef, useCallback } from 'react';

const alphabets = ['all', 'a', 'i', 'u', 'h', 'k', 'l', 'm', 'n', 'p', 's', 't', 'w', 'y'];

// 品詞バッジの設定
const POS_CONFIG = {
  noun:     { label: '名', title: '名詞 (-a)',   color: '#4a9eff' },
  verb:     { label: '動', title: '動詞 (-i)',   color: '#ff7b4a' },
  extender: { label: '拡', title: '拡張詞 (-u)', color: '#a259ff' },
};

// 複合語バッジの設定
const TYPE_CONFIG = {
  complex:      { label: '複', title: '既存語の組み合わせ',       color: '#2ecc71' },
  semi_complex: { label: '半', title: '新語＋既存語の組み合わせ', color: '#f39c12' },
};

function WordBadge({ entry }) {
  if (entry.type === 'word') {
    const cfg = POS_CONFIG[entry.pos];
    if (!cfg) return null;
    return (
      <span
        className="dict-badge"
        title={cfg.title}
        style={{ background: cfg.color }}
      >
        {cfg.label}
      </span>
    );
  }
  // complex / semi_complex
  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.complex;
  return (
    <span
      className="dict-badge"
      title={cfg.title}
      style={{ background: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export default function DictionaryList({ onWordClick, onTotalLoaded, isAdmin, deleteMode, selectedIds }) {
  const [words, setWords] = useState([]);
  const [page, setPage] = useState(1);
  const [selectedLetter, setSelectedLetter] = useState('all');
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const observer = useRef();

  const lastWordElementRef = useCallback(node => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);

  useEffect(() => {
    const fetchDictionary = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `https://i-tya-dictionary.onrender.com/api/dictionary?page=${page}&letter=${selectedLetter}`
        );
        const data = await res.json();
        setWords(prev => {
          if (page === 1) return data.words;
          const existingIds = new Set(prev.map(w => w.id));
          return [...prev, ...data.words.filter(w => !existingIds.has(w.id))];
        });
        if (onTotalLoaded && data.total !== undefined) onTotalLoaded(data.total);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error('辞書の読み込みに失敗。', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDictionary();
  }, [page, selectedLetter]);

  const handleIndexClick = (letter) => {
    if (selectedLetter === letter) return;
    setSelectedLetter(letter);
    setPage(1);
    setWords([]);
  };

  return (
    <div className="dictionary-container fade-in">
      {/* 索引ナビ */}
      <div className="index-nav">
        {alphabets.map(char => (
          <button
            key={char}
            onClick={() => handleIndexClick(char)}
            className={`index-btn ${selectedLetter === char ? 'active' : ''}`}
          >
            {char === 'all' ? 'ALL' : char}
          </button>
        ))}
      </div>

      {/* 凡例 */}
      <div className="dict-legend">
        {Object.entries(POS_CONFIG).map(([key, cfg]) => (
          <span key={key} className="dict-legend-item">
            <span className="dict-badge" style={{ background: cfg.color }}>{cfg.label}</span>
            <span className="dict-legend-label">{cfg.title}</span>
          </span>
        ))}
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <span key={key} className="dict-legend-item">
            <span className="dict-badge" style={{ background: cfg.color }}>{cfg.label}</span>
            <span className="dict-legend-label">{cfg.title}</span>
          </span>
        ))}
      </div>

      {/* 単語一覧 */}
      <div className="word-list">
        {words.map((entry, index) => {
          const isLast = index === words.length - 1;
          const isSelected = selectedIds && selectedIds.includes(entry.id);
          return (
            <div
              ref={isLast ? lastWordElementRef : null}
              key={entry.id}
              data-word-id={entry.id}
              className={`word-card${deleteMode ? ' delete-mode' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => onWordClick(entry)}
            >
              <WordBadge entry={entry} />
              <span className="word-itya">{entry.word}</span>
              <span className="word-ja">{entry.meaning}</span>
              {deleteMode && (
                <span className="word-card-select-indicator">
                  {isSelected ? '✓' : '○'}
                </span>
              )}
            </div>
          );
        })}
        {isLoading && <div className="loading-spinner">ロード中...</div>}
        {!hasMore && words.length > 0 && (
          <div className="end-msg">これ以上表示できる単語がありません！</div>
        )}
        {!isLoading && words.length === 0 && (
          <div className="end-msg">この文字で始まる単語はありません！</div>
        )}
      </div>
    </div>
  );
}