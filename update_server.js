const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. ityaRules
content = content.replace(
  'あなたは人工言語「i-tya」の厳格なコンパイラ・言語学者だ。以下のルールに絶対に従い単語を生成せよ。指定のJSON形式以外は一切出力するな。',
  'あなたは人工言語「i-tya」の厳格なコンパイラ・言語学者だ。以下のルールに絶対に従い単語を生成せよ。'
);

content = content.replace(
  '1. JSONのみ出力。マークダウンの装飾や挨拶は一切不要。',
  '1. 以下の形式で出力せよ。最初に生成結果（意味・由来・解説など）を人間向けのプレーンテキストで出力し、その後セパレータ「---」を単独行に挟んで、システム向けの構造データをJSONで出力せよ。JSON外でのマークダウン修飾や挨拶は不要。'
);

// 2. translateRules
content = content.replace(
  'あなたはi-tya言語の翻訳コンパイラだ。日本語文章をi-tya語に翻訳し、JSONのみ出力せよ。',
  'あなたはi-tya言語の翻訳コンパイラだ。日本語文章をi-tya語に翻訳せよ。'
);

content = content.replace(
  /【出力フォーマット】\n{\n  "translation": "完成したi-tya語文章",\n  "breakdown": \[/g,
  '【出力フォーマット】\n以下の形式で出力せよ。最初に翻訳結果（i-tya語文章）をプレーンテキストで出力し、その後セパレータ「---」を単独行に挟んで、構造データをJSONで出力せよ。\n\n（ここに翻訳されたi-tya語の文章をプレーンテキストで出力）\n---\n{\n  "translation": "完成したi-tya語文章",\n  "breakdown": ['
);

// 3. reverseTranslateRules
content = content.replace(
  'あなたはi-tya言語の逆翻訳コンパイラだ。i-tya語の文章を日本語に翻訳し、JSONのみ出力せよ。',
  'あなたはi-tya言語の逆翻訳コンパイラだ。i-tya語の文章を日本語に翻訳せよ。'
);

content = content.replace(
  /【出力フォーマット】\n{\n  "translation": "日本語訳。辞書にない単語は「\(tit\)」のようにi-tya語をそのまま括弧で残せ。",\n  "breakdown": \[/g,
  '【出力フォーマット】\n以下の形式で出力せよ。最初に翻訳結果（日本語訳）をプレーンテキストで出力し、その後セパレータ「---」を単独行に挟んで、構造データをJSONで出力せよ。\n\n（ここに翻訳された日本語訳の文章をプレーンテキストで出力）\n---\n{\n  "translation": "日本語訳。辞書にない単語は「(tit)」のようにi-tya語をそのまま括弧で残せ。",\n  "breakdown": ['
);

// 4. callAIWithRetry
content = content.replace(
  /async function callAIWithRetry\(model, prompt, maxRetries = 3\) \{[\s\S]*?throw lastError;\n\}/g,
  `async function callAIWithRetry(model, prompt, res, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(\`[AI] Attempt \${attempt}/\${maxRetries}\`);
      const resultStream = await model.generateContentStream(prompt);
      
      let fullText = "";
      for await (const chunk of resultStream.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        if (res) res.write(\`data: \${JSON.stringify({ text: chunkText })}\\n\\n\`);
      }
      
      console.log(\`[AI] Stream complete (\${fullText.length} chars)\`);
      const parts = fullText.split('---');
      const jsonText = parts.length > 1 ? parts.slice(1).join('---') : fullText;
      const rawText = jsonText.replace(/\`\`\`json|\`\`\`/g, '').trim();
      
      const sanitized = rawText.replace(
        /"((?:[^"\\\\]|\\\\.)*)"/g,
        (m, inner) => '"' + inner.replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r').replace(/\\t/g, '\\\\t') + '"'
      );
      const parsed = JSON.parse(sanitized);
      if (parsed.root) parsed.root = parsed.root.toLowerCase();
      if (parsed.status === 'new') validateRoot(parsed.root);
      
      return parsed;
    } catch (err) {
      lastError = err;
      // 生のエラーを必ずログに出す
      console.error(\`[AI] Attempt\${attempt} failed - \${err.constructor.name}: \${err.message}\`);
      if (err.status) console.error(\`[AI] HTTP status: \${err.status}\`);

      // JSONパース or 語幹バリデーションエラーのみリトライ
      const isRetryable = err instanceof SyntaxError || err.message.includes('語幹') || err.message.includes('音韻') || err.message.includes('レベル1') || err.message.includes('語幹が空');
      // APIエラー（429/5xx等）はリトライせず即投げ
      if (!isRetryable || attempt >= maxRetries) throw err;
      console.warn(\`[AI] Validation error. Retrying...\`);
      if (res) res.write(\`event: retry\\ndata: {}\\n\\n\`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError;
}`
);

// 5. /api/generate
content = content.replace(
  'const generationPromise = (async () => {\n      const aiRes = await callAIWithRetry(generateModel, prompt);',
  `res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const generationPromise = (async () => {
      const aiRes = await callAIWithRetry(generateModel, prompt, res);`
);

content = content.replace(
  'inflightGenerate.set(concept, generationPromise);\n    try {\n      res.json(await generationPromise);\n    } finally {\n      inflightGenerate.delete(concept);\n    }',
  `inflightGenerate.set(concept, generationPromise);
    try {
      const finalRes = await generationPromise;
      res.write(\`data: \${JSON.stringify({ result: finalRes })}\\n\\n\`);
      res.write(\`event: done\\ndata: {}\\n\\n\`);
      res.end();
    } finally {
      inflightGenerate.delete(concept);
    }`
);

// 6. /api/translate
content = content.replace(
  'const translationPromise = (async () => {\n      const checkListStr = buildWordListStr();\n      const prompt = `\n文章: 「${sentence}」\n既存リスト: ${checkListStr}\n上記リストを最大限活用し、翻訳せよ。\n      `;\n\n      const parsed = await callAIWithRetry(translateModel, prompt);',
  `res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const translationPromise = (async () => {
      const checkListStr = buildWordListStr();
      const prompt = \`
文章: 「\${sentence}」
既存リスト: \${checkListStr}
上記リストを最大限活用し、翻訳せよ。
      \`;

      const parsed = await callAIWithRetry(translateModel, prompt, res);`
);

content = content.replace(
  'inflightTranslate.set(sentence, translationPromise);\n    try {\n      res.json(await translationPromise);\n    } finally {\n      inflightTranslate.delete(sentence);\n    }',
  `inflightTranslate.set(sentence, translationPromise);
    try {
      const finalRes = await translationPromise;
      res.write(\`data: \${JSON.stringify({ result: finalRes })}\\n\\n\`);
      res.write(\`event: done\\ndata: {}\\n\\n\`);
      res.end();
    } finally {
      inflightTranslate.delete(sentence);
    }`
);

// 7. /api/reverse-translate
content = content.replace(
  'const parsed = await callAIWithRetry(reverseTranslateModel, prompt);\n    return res.json(parsed);',
  `res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const parsed = await callAIWithRetry(reverseTranslateModel, prompt, res);
    res.write(\`data: \${JSON.stringify({ result: parsed })}\\n\\n\`);
    res.write(\`event: done\\ndata: {}\\n\\n\`);
    res.end();`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Update complete.');
