const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'frontend', 'src', 'App.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add streamingText state
content = content.replace(
  'const [isReverseTranslateMode, setIsReverseTranslateMode] = useState(false);',
  `const [isReverseTranslateMode, setIsReverseTranslateMode] = useState(false);\n  const [streamingText, setStreamingText] = useState("");`
);

// 2. Add handleSSEStream helper
content = content.replace(
  'const handleAnoClick = () => {',
  `const handleSSEStream = async (res, onText, onDone) => {
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
  };

  const handleAnoClick = () => {`
);

// 3. executeSearch
const searchReplacement = `
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setError('overload'); setErrorMessage(errData.error || ''); setIsSearching(false); return;
      }
      
      let data = null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        await handleSSEStream(res, (text) => {
          safeTransition(() => setStreamingText(text));
        }, (resData) => {
          data = resData;
        });
      }

      if (!data) return; // Stream handled it or error

      if (data.status === 'invalid' || data.status === 'invailed') {
        setError('invalid'); setIsSearching(false); setStreamingText(""); return;
      }`;

content = content.replace(
  /if \(res\.status === 503\) \{\s*const errData = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\);\s*setError\('overload'\); setErrorMessage\(errData\.error \|\| ''\); setIsSearching\(false\); return;\s*\}\s*const data = await res\.json\(\);\s*if \(data\.status === 'invalid' \|\| data\.status === 'invailed'\) \{\s*setError\('invalid'\); setIsSearching\(false\); return;\s*\}/g,
  searchReplacement
);

// 4. executeTranslation
const transReplacement = `
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setError('overload'); setErrorMessage(errData.error || ''); setIsSearching(false); return;
      }
      if (!res.ok) { setError('connection'); setIsSearching(false); return; }
      
      let data = null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        await handleSSEStream(res, (text) => {
          safeTransition(() => setStreamingText(text));
        }, (resData) => {
          data = resData;
        });
      }

      if (!data) return;
      
      if (!data.translation) { setError('connection'); setIsSearching(false); setStreamingText(""); return; }`;

content = content.replace(
  /if \(res\.status === 503\) \{\s*const errData = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\);\s*setError\('overload'\); setErrorMessage\(errData\.error \|\| ''\); setIsSearching\(false\); return;\s*\}\s*if \(!res\.ok\) \{ setError\('connection'\); setIsSearching\(false\); return; \}\s*const data = await res\.json\(\);\s*if \(!data\.translation\) \{ setError\('connection'\); setIsSearching\(false\); return; \}/g,
  transReplacement
);

// 5. executeReverseTranslation
const reverseTransReplacement = `
      if (res.status === 503) {
        const errData = await res.json().catch(() => ({}));
        setError('overload'); setErrorMessage(errData.error || ''); setIsSearching(false); return;
      }
      if (!res.ok) { setError('connection'); setIsSearching(false); return; }
      
      let data = null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        await handleSSEStream(res, (text) => {
          safeTransition(() => setStreamingText(text));
        }, (resData) => {
          data = resData;
        });
      }

      if (!data) return;
      
      if (!data.translation) { setError('connection'); setIsSearching(false); setStreamingText(""); return; }`;

content = content.replace(
  /if \(res\.status === 503\) \{\s*const errData = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\);\s*setError\('overload'\); setErrorMessage\(errData\.error \|\| ''\); setIsSearching\(false\); return;\s*\}\s*if \(!res\.ok\) \{ setError\('connection'\); setIsSearching\(false\); return; \}\s*const data = await res\.json\(\);\s*if \(!data\.translation\) \{ setError\('connection'\); setIsSearching\(false\); return; \}/g,
  reverseTransReplacement
);


// We need to clear streamingText when searching starts
content = content.replace(
  'setIsSearching(true); setResult(null); setError(null); setTrivia("トリビアを読み込み中...");',
  'setIsSearching(true); setResult(null); setError(null); setTrivia("トリビアを読み込み中..."); setStreamingText("");'
);

content = content.replace(
  'setIsSearching(true); setResult(null); setError(null); });',
  'setIsSearching(true); setResult(null); setError(null); setStreamingText(""); });'
);

content = content.replace(
  'setIsSearching(true); setResult(null); setError(null); setReverseResult(null); });',
  'setIsSearching(true); setResult(null); setError(null); setReverseResult(null); setStreamingText(""); });'
);

content = content.replace(
  'setIsSearching(true); setResult(null); setError(null); setReverseTranslationResult(null); });',
  'setIsSearching(true); setResult(null); setError(null); setReverseTranslationResult(null); setStreamingText(""); });'
);


fs.writeFileSync(targetPath, content, 'utf8');
console.log('App.jsx updated.');
