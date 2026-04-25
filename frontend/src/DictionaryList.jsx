import React, { useState, useEffect, useRef, useCallback} from 'react';
const alphabets = ['all', 'a', 'i', 'u', 'h', 'k', 'l', 'm', 'n', 'p', 's', 't', 'w', 'y'];

export default function DictionaryList({onwordClick}){
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
            const response = await fetch(`https://i-tya-dictionary.onrender.com/api/dictionary?page=${page}&search=${selectedLetter}`);
            const data = await response.json();
            setWords(prevWords => [...prevWords, ...data.words]);
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
            {char === 'all' ? 'すべて' : char}
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
        {isLoading && <div className="loading-spinner">Loading...</div>}
        {!hasMore && words.length > 0 && <div className="end-msg">No more words to display</div>}
        {!isLoading && words.length === 0 && <div className="end-msg">No words found for the selected letter</div>}
      </div>
    </div>
  );
}