import React, { useState, useEffect, useRef, useCallback } from 'react';
const alphabets = ['all', 'a', 'i', 'u', 'h', 'k', 'l', 'm', 'n', 'p', 's', 't', 'w', 'y'];

export default function DictionaryList({ onWordClick }) {
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
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore]);

  useEffect(() => {
    const fetchDictionary = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`https://i-tya-dictionary.onrender.com/api/dictionary?page=${page}&letter=${selectedLetter}`);
        const data = await res.json();
        setWords(prev => {
          if (page === 1) return data.words;

          const existingIds = new Set(prev.map(w => w.id));
          const uniqueNewWords = data.words.filter(w => !existingIds.has(w.id));

          return [...prev, ...uniqueNewWords];
        });

        setHasMore(data.hasMore);
      } catch (error) {
        console.error('辞書の読み込みに失敗。。', error);
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
  };

  return (
    <div className="dictionary-container fade-in">

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

      <div className="word-list">
        {words.map((entry, index) => {
          const isLast = index === words.length - 1;
          return (
            <div
              ref={isLast ? lastWordElementRef : null}
              key={entry.id}
              className="word-card"
              onClick={() => onWordClick(entry)}
            >
              <span className="word-itya">{entry.word}</span>
              <span className="word-ja">{entry.meaning}</span>
            </div>
          );
        })}
        {isLoading && <div className="loading-spinner">ロード中...</div>}
        {!hasMore && words.length > 0 && <div className="end-msg">これ以上表示できる単語がありません！</div>}
        {!isLoading && words.length === 0 && <div className="end-msg">この文字で始まる単語はありません！</div>}
      </div>
    </div>
  );
}

// import React, { useState, useEffect, useRef, useCallback } from 'react';

// const alphabets = ['all', 'a', 'i', 'u', 'h', 'k', 'l', 'm', 'n', 'p', 's', 't', 'w', 'y'];

// const generateDummyData = (count) => {
//   const consonants = ['p', 't', 'k', 'm', 'n', 's', 'h', 'l', ''];
//   const vowels = ['a', 'i', 'u'];
//   const data = [];
//   for (let i = 1; i <= count; i++) {
//     const wordLength = (i % 3) + 2;
//     let word = '';
//     for (let j = 0; j < wordLength; j++) {
//       const c = consonants[(i * 3 + j * 7) % consonants.length];
//       const v = vowels[(i * 5 + j * 3) % vowels.length];
//       word += c + v;
//     }
//     data.push({
//       id: `dummy-${i}`,
//       type: 'word',
//       word: word,
//       meaning: `テスト用の意味 ${i}`,
//       fullData: { root: word.slice(0, -1) }
//     });
//   }
//   return data.sort((a, b) => a.word.localeCompare(b.word));
// };

// const ALL_DUMMY_DATA = generateDummyData(200);

// export default function DictionaryList({ onWordClick }) {
//   const [words, setWords] = useState([]);
//   const [page, setPage] = useState(1);
//   const [selectedLetter, setSelectedLetter] = useState('all');
//   const [hasMore, setHasMore] = useState(true);
//   const [isLoading, setIsLoading] = useState(false);

//   const observer = useRef();

//   const lastWordElementRef = useCallback(node => {
//     if (isLoading) return;
//     if (observer.current) observer.current.disconnect();
//     observer.current = new IntersectionObserver(entries => {
//       if (entries[0].isIntersecting && hasMore) {
//         setPage(prevPage => prevPage + 1);
//       }
//     });
//     if (node) observer.current.observe(node);
//   }, [isLoading, hasMore]);

//   useEffect(() => {
//     setIsLoading(true);
//     const filtered = selectedLetter === 'all'
//       ? ALL_DUMMY_DATA
//       : ALL_DUMMY_DATA.filter(w => w.word.startsWith(selectedLetter));
//     setWords(filtered);
//     setHasMore(false);
//     setIsLoading(false);
//   }, [selectedLetter]);

//   const handleIndexClick = (letter) => {
//     if (selectedLetter === letter) return;
//     setSelectedLetter(letter);
//     setPage(1);
//   };

//   return (
//     <div className="dictionary-container fade-in">
//       <div className="index-nav">
//         {alphabets.map(char => (
//           <button
//             key={char}
//             onClick={() => handleIndexClick(char)}
//             className={`index-btn ${selectedLetter === char ? 'active' : ''}`}
//           >
//             {char === 'all' ? 'ALL' : char}
//           </button>
//         ))}
//       </div>

//       <div className="word-list">
//         {words.map((entry, index) => {
//           const isLast = index === words.length - 1;
//           return (
//             <div
//               ref={isLast ? lastWordElementRef : null}
//               key={entry.id}
//               data-word-id={entry.id}
//               className="word-card"
//               onClick={() => onWordClick(entry)}
//             >
//               <span className="word-itya">{entry.word}</span>
//               <span className="word-ja">{entry.meaning}</span>
//             </div>
//           );
//         })}
//         {isLoading && <div className="loading-spinner">ロード中...</div>}
//         {!hasMore && words.length > 0 && <div className="end-msg">No more words to display</div>}
//         {!isLoading && words.length === 0 && <div className="end-msg">No words found for the selected letter</div>}
//       </div>
//     </div>
//   );
// }
