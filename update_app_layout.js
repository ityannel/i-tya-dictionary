const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'frontend', 'src', 'App.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const oldLayout = `<div className="inner-result fade-in-up" style={{ marginTop: '20px', textAlign: 'left', overflow: 'hidden' }}>
                      <div className="concept-header">
                        <div className="concept-text">{streamingData.meaning_noun || streamingData.meaning || query}</div>
                        <span className="badge-new" style={{ opacity: 0.5, background: 'var(--bg-lighter)' }}>生成中...</span>
                      </div>
                      <div className="reason-text" style={{ whiteSpace: 'pre-wrap', minHeight: '60px', marginBottom: '16px' }}>
                        {streamingData.reason_noun || streamingData.reason || ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                        <h2 className="word-display" style={{ margin: 0, opacity: streamingData.root || streamingData.combination ? 1 : 0.3 }}>
                          {streamingData.status === 'complexed' || streamingData.status === 'semi_complexed'
                            ? streamingData.combination || "解析中..."
                            : (streamingData.root ? streamingData.root + "a" : "語幹を生成中...")}
                        </h2>
                      </div>
                    </div>`;

const newLayout = `<div className="inner-result fade-in-up" style={{ marginTop: '20px', textAlign: 'left', overflow: 'hidden', transition: 'all 0.3s ease' }}>
                      <div className="concept-header">
                        <div className="concept-text">{streamingData.meaning_noun || streamingData.meaning || query}</div>
                        <span className="badge-new" style={{ opacity: 0.5, background: 'var(--bg-lighter)' }}>生成中...</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <h2 className="word-display" style={{ margin: 0, opacity: streamingData.root || streamingData.combination ? 1 : 0.3 }}>
                          {streamingData.status === 'complexed' || streamingData.status === 'semi_complexed'
                            ? streamingData.combination || "解析中..."
                            : (streamingData.root ? streamingData.root + "a" : "語幹を生成中...")}
                        </h2>
                      </div>

                      <div className="reason-text" style={{ whiteSpace: 'pre-wrap', minHeight: '100px', transition: 'all 0.3s ease' }}>
                        {streamingData.reason_noun || streamingData.reason || ''}
                      </div>
                    </div>`;

content = content.replace(oldLayout, newLayout);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('App.jsx layout fixed.');
