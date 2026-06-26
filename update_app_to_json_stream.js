const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'frontend', 'src', 'App.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Rename streamingText to streamingData
content = content.replace(
  'const [streamingText, setStreamingText] = useState("");',
  'const [streamingData, setStreamingData] = useState(null);'
);

// 2. Change handleSSEStream
const oldHandleSSEStream = `const handleSSEStream = async (res, onText, onDone) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedStream = '';
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      
      let lines = sseBuffer.split('\\n\\n');
      sseBuffer = lines.pop(); // keep incomplete part
      
      for (const block of lines) {
        const blockLines = block.split('\\n');
        let eventType = 'message';
        for (const line of blockLines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const payloadStr = line.substring(6);
            if (eventType === 'retry') {
              accumulatedStream = '';
              onText('生成をやり直しています...');
            } else if (eventType === 'done') {
              // stream finished
            } else {
              try {
                const payload = JSON.parse(payloadStr);
                if (payload.text) {
                  accumulatedStream += payload.text;
                  const textPart = accumulatedStream.split('---')[0];
                  onText(textPart);
                }
                if (payload.result) {
                  onDone(payload.result);
                }
              } catch(e) {}
            }
          }
        }
      }
    }
  };`;

const newHandleSSEStream = `const parsePartialJson = (jsonStr) => {
    const result = {};
    const keys = ['status', 'root', 'meaning_noun', 'meaning_verb', 'meaning_extender', 'reason', 'reason_noun', 'reason_verb', 'reason_extender', 'translation', 'combination'];
    
    for (const key of keys) {
      const regex = new RegExp(\`"\${key}"\\\\s*:\\\\s*"((?:[^"\\\\\\\\]|\\\\\\\\.)*)\`);
      const match = jsonStr.match(regex);
      if (match) {
        result[key] = match[1].replace(/\\\\n/g, '\\n').replace(/\\\\"/g, '"');
      }
    }
    return result;
  };

  const handleSSEStream = async (res, onData, onDone) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedStream = '';
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      
      let lines = sseBuffer.split('\\n\\n');
      sseBuffer = lines.pop();
      
      for (const block of lines) {
        const blockLines = block.split('\\n');
        let eventType = 'message';
        for (const line of blockLines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const payloadStr = line.substring(6);
            if (eventType === 'retry') {
              accumulatedStream = '';
              onData({ status: 'retry', reason: '生成をやり直しています...' });
            } else if (eventType === 'done') {
              // stream finished
            } else {
              try {
                const payload = JSON.parse(payloadStr);
                if (payload.text) {
                  accumulatedStream += payload.text;
                  const partial = parsePartialJson(accumulatedStream);
                  onData(partial);
                }
                if (payload.result) {
                  onDone(payload.result);
                }
              } catch(e) {}
            }
          }
        }
      }
    }
  };`;

content = content.replace(oldHandleSSEStream, newHandleSSEStream);

// 3. Update all execute functions that use handleSSEStream
content = content.replace(
  /await handleSSEStream\(res, \(text\) => \{\s*safeTransition\(\(\) => setStreamingText\(text\)\);\s*\},/g,
  `await handleSSEStream(res, (data) => {
          safeTransition(() => setStreamingData(data));
        },`
);

// 4. Fix state resets
content = content.replace(/setStreamingText\(""\)/g, 'setStreamingData(null)');

// 5. Update UI rendering in isSearching
const oldUI = `{streamingText ? (
                  mode === 'translate' || isTranslateMode || isReverseTranslateMode ? (
                    <div className="translation-box fade-in-up" style={{ marginTop: '20px', textAlign: 'left' }}>
                      <div className="trans-header">
                        {isReverseTranslateMode ? '日本語 翻訳結果' : 'i-tya語 翻訳結果'} <span style={{fontSize:'0.85em', fontWeight:'normal', opacity:0.7}}>(生成中...)</span>
                      </div>
                      <div className="trans-result" style={{ whiteSpace: 'pre-wrap', minHeight: '80px', color: 'var(--text)' }}>
                        {streamingText}
                      </div>
                    </div>
                  ) : (
                    <div className="inner-result fade-in-up" style={{ marginTop: '20px', textAlign: 'left' }}>
                      <div className="concept-header">
                        <div className="concept-text">{query}</div>
                        <span className="badge-new" style={{ opacity: 0.5, background: 'var(--bg-lighter)' }}>生成中...</span>
                      </div>
                      <div className="reason-text" style={{ whiteSpace: 'pre-wrap', minHeight: '100px' }}>
                        {streamingText}
                      </div>
                    </div>
                  )
                ) : (`;

const newUI = `{streamingData ? (
                  mode === 'translate' || isTranslateMode || isReverseTranslateMode ? (
                    <div className="translation-box fade-in-up" style={{ marginTop: '20px', textAlign: 'left' }}>
                      <div className="trans-header">
                        {isReverseTranslateMode ? '日本語 翻訳結果' : 'i-tya語 翻訳結果'} <span style={{fontSize:'0.85em', fontWeight:'normal', opacity:0.7}}>(生成中...)</span>
                      </div>
                      <div className="trans-result" style={{ whiteSpace: 'pre-wrap', minHeight: '80px', color: 'var(--text)' }}>
                        {streamingData.translation || streamingData.reason || ''}
                      </div>
                    </div>
                  ) : (
                    <div className="inner-result fade-in-up" style={{ marginTop: '20px', textAlign: 'left' }}>
                      <div className="concept-header">
                        <div className="concept-text">{streamingData.meaning_noun || query}</div>
                        <span className="badge-new" style={{ opacity: 0.5, background: 'var(--bg-lighter)' }}>生成中...</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <h2 className="word-display" style={{ margin: 0 }}>
                          {streamingData.status === 'complexed' || streamingData.status === 'semi_complexed'
                            ? streamingData.combination || "???"
                            : (streamingData.root ? streamingData.root + "a" : "???")}
                        </h2>
                      </div>
                      <div className="reason-text" style={{ whiteSpace: 'pre-wrap', minHeight: '100px' }}>
                        {streamingData.reason_noun || streamingData.reason || ''}
                      </div>
                    </div>
                  )
                ) : (`;

content = content.replace(oldUI, newUI);

// Fix the trivia display condition
content = content.replace(
  '{trivia && !streamingText && (',
  '{trivia && !streamingData && ('
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('App.jsx updated to parse streaming JSON.');
