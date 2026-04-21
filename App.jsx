import React, { useState } from 'react';

function App() {
  const [concept, setConcept] = useState(''); // 入力した文字
  const [result, setResult] = useState(null); // APIからの返り値
  const [loading, setLoading] = useState(false); // 通信中フラグ

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 👈 ここをお前のRenderのURLに書き換えろ！
      const response = await fetch('https://i-tya-dictionary.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: concept }),
      });

      const data = await response.json();
      setResult(data); // 届いたJSONをセット
    } catch (error) {
      console.error("通信エラーだぜ:", error);
      alert("サーバーが寝てやがるか、URLが間違ってるぜ。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>i-tya Dictionary</h1>
      
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="日本語を入力..."
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          {loading ? '生成中...' : '検索'}
        </button>
      </form>

      {/* 結果表示エリア */}
      {result && (
        <div style={{ background: '#f4f4f4', padding: '20px', borderRadius: '8px', borderLeft: '5px solid #007bff' }}>
          <h2>結果: {result.meaning || concept}</h2>
          
          {/* statusによって出す情報を分ける */}
          {result.status === 'new' && (
            <div>
              <p><strong>新語:</strong> {result.root}a / {result.root}i / {result.root}u</p>
              <p><strong>理由:</strong> {result.reason}</p>
            </div>
          )}

          {result.status === 'rejected' && (
            <div>
              <p style={{ color: 'red' }}><strong>拒否:</strong> {result.reason}</p>
              <p><strong>既存の概念:</strong> {result.existing_concept}</p>
            </div>
          )}

          {/* デバッグ用に生のJSONも見れるようにしておくと便利だ */}
          <details style={{ marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#666' }}>Raw JSON</summary>
            <pre style={{ fontSize: '0.7rem', background: '#eee', padding: '10px' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default App;