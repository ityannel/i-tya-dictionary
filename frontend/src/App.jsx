import React, { useState } from 'react';

function App() {
  const [concept, setConcept] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!concept) return;
    setLoading(true);

    try {
      const response = await fetch('https://i-tya-dictionary.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: concept }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("通信エラーだぜ:", error);
      alert("APIサーバーに繋がらねぇ。Renderがスリープしてるかもな。");
    } finally {
      setLoading(false);
    }
  };

  // 表示用の単語データを整理する関数
  const getDisplayData = () => {
    if (!result) return null;
    
    let root = "";
    let reason = result.reason || "";
    let conceptJa = result.meaning || concept;

    // AIが「既存のものを使え」と言ってきた時も、
    // ユーザーにはその単語が何であるかを堂々と見せる。
    if (result.status === 'new') {
      root = result.root;
    } else if (result.status === 'rejected' || result.status === 'complexed') {
      root = result.existing_concept || result.combination || "???";
    }

    return { root, conceptJa, reason, status: result.status };
  };

  const display = getDisplayData();

  return (
    <div style={{ 
      padding: '40px 20px', 
      fontFamily: '"JetBrains Mono", "Inter", "Hiragino Kaku Gothic ProN", sans-serif', 
      maxWidth: '850px', 
      margin: '0 auto',
      color: '#1a1a1a',
      lineHeight: '1.7'
    }}>
      <header style={{ textAlign: 'left', marginBottom: '80px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '1rem', letterSpacing: '0.3em', color: '#888', fontWeight: '700', textTransform: 'uppercase' }}>i-tya / Protocol Language</h1>
      </header>
      
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '100px' }}>
        <input
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="概念を検索..."
          style={{ 
            flex: 1, padding: '18px 24px', fontSize: '1.2rem',
            borderRadius: '16px', border: '2px solid #f0f0f0', outline: 'none',
            backgroundColor: '#f8f8f8', transition: 'all 0.3s ease'
          }}
          onFocus={(e) => e.target.style.borderColor = '#000'}
          onBlur={(e) => e.target.style.borderColor = '#f0f0f0'}
        />
        <button type="submit" disabled={loading} style={{ 
          padding: '0 40px', borderRadius: '16px', border: 'none',
          backgroundColor: '#000', color: '#fff', fontSize: '1.1rem', fontWeight: '700',
          cursor: 'pointer', transition: '0.2s', opacity: loading ? 0.5 : 1
        }}>
          {loading ? '...' : 'SEARCH'}
        </button>
      </form>

      {display && (
        <div style={{ animation: 'slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1)' }}>
          {/* メインの単語表示セクション */}
          <section style={{ marginBottom: '60px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '5rem', margin: 0, fontFamily: '"JetBrains Mono", monospace', fontWeight: '800', letterSpacing: '-0.05em' }}>
                {display.root}
              </h2>
              <span style={{ fontSize: '2rem', color: '#ccc', fontWeight: '300' }}>/</span>
              <span style={{ fontSize: '2rem', color: '#444', fontWeight: '600' }}>{display.conceptJa}</span>
            </div>
            <div style={{ marginTop: '10px' }}>
              <span style={{ 
                fontSize: '0.75rem', 
                letterSpacing: '0.1em',
                fontWeight: '800',
                color: display.status === 'new' ? '#3b82f6' : '#10b981',
                textTransform: 'uppercase'
              }}>
                {display.status === 'new' ? '• AI PROPOSAL' : '• OFFICIAL ARCHIVE'}
              </span>
            </div>
          </section>

          {/* 詞型（派生）リスト - カードスタイル */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '60px' }}>
            {[
              { label: '名詞', suffix: 'a', desc: '概念の固定' },
              { label: '動詞', suffix: 'i', desc: '事象の推移' },
              { label: '拡張', suffix: 'u', desc: '性質の付与' }
            ].map((type) => (
              <div key={type.suffix} style={{ 
                background: '#fff', padding: '24px', borderRadius: '20px', 
                border: '1px solid #eee', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>{type.label} / -{type.suffix}</div>
                <div style={{ fontSize: '1.5rem', fontFamily: '"JetBrains Mono", monospace', fontWeight: '700', color: '#000' }}>{display.root}{type.suffix}</div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>{type.desc}</div>
              </div>
            ))}
          </section>

          {/* 学術的解説セクション */}
          <section style={{ backgroundColor: '#fff', borderRadius: '24px' }}>
            <h3 style={{ 
              fontSize: '0.8rem', 
              color: '#aaa', 
              fontWeight: '800', 
              marginBottom: '20px', 
              textTransform: 'uppercase',
              letterSpacing: '0.2em'
            }}>語源と解説 / Etymology & Commentary</h3>
            <div style={{ 
              fontSize: '1.15rem', 
              color: '#222', 
              lineHeight: '2', 
              whiteSpace: 'pre-wrap',
              textAlign: 'justify'
            }}>
              {display.reason}
            </div>
          </section>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::placeholder { color: #ccc; }
      `}</style>
    </div>
  );
}

export default App;