const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const ityaRules = `
あなたは人工言語「i-tya」の厳格なコンパイラ・言語学者だ。以下のルールに絶対に従い単語を生成せよ。指定のJSON形式以外は一切出力するな。

【i-tya言語の基本ルール】
・目的: 迅速な意思疎通。「覚える・読む・聞く・話す・書く」の速度重視。
・音韻: 13文字。母音(a,i,u)、子音(h,k,l,m,n,p,s,t)、半母音(w,y)。
・音節構造: (C)(G)V。許可構成は V, CV, GV, CGV のみ(計81音節)。VV連続は許可(連音なし)。子音終わりは絶対禁止。
・品詞: 語末母音で一意に定まる。兼任不可。-a(名詞)、-i(動詞)、-u(拡張詞/その他)。

【語彙階層とレベル】
・Lv1(1音節): 閉じた語類(文法要素等)。末尾母音が違えば別概念。新語生成は原則禁止。
・Lv2(2音節): 準開いた語類。枠は貴重なため新語生成は慎重に行う。数詞はすべてLv2(名詞・lu開始・多音節可)。
・Lv3(3音節以上): 開いた語類(専門用語・外来語等)。

【絶対遵守事項：単語生成と出力】
1. JSONのみ出力。マークダウンの装飾や挨拶は一切不要。
2. root(語幹)は、末尾の母音(a,i,u)を**絶対に除外**した骨組みを出力せよ（例: wasa -> was）。
3. ユーザーの【既存・拒否リスト】を必ず確認せよ。同義・類義・上位下位概念は"existing"とする。
4. 既存単語の組み合わせで表現可能な場合は"complexed"か"semi_complexed"とし、安易な新語生成(new)は避ける。
5. "complexed"の要素は既存リストに存在する単語のみ。捏造は絶対禁止。不足があるなら必ず"semi_complexed"にせよ。組み合わせ表現ができる場合"rejected"にはしない。
6. 固有名詞は音訳＋名詞化(-a)。語頭大文字、i-tya音韻適合必須（例: Nyuyoka）。
7. reasonは日本語の「だ・である」体。既存単語と重複した等、システム的なメタ発言は厳禁。
8. ドキュメント内例文の単語は未学習扱い("new")とする。

【JSONフォーマット】※状況に応じて以下のいずれかの構造のみ出力
[1. 新概念の生成]
{"status":"new", "meaning":"日本語訳", "part_of_speech":"noun|verb|extender", "root":"語末母音なし語幹", "reason":"【意味】...\n【詞型の展開】...\n【語源・由来】...", "trivia":"豆知識1文"}

[2. 新語と既存語の組合せ] (※3より優先。不足概念が1つでもある場合)
{"status":"semi_complexed", "meaning":"日本語訳", "combination":"新語 既存語", "reason":"【意味】...\n【語源・由来】...", "words":[{"status":"new", "meaning":"...", "part_of_speech":"...", "root":"...", "reason":"..."}, {"status":"existing", "meaning":"...", "part_of_speech":"...", "root":"..."}], "trivia":"豆知識"}

[3. 既存単語のみの組合せ] (完全既存表現・捏造厳禁)
{"status":"complexed", "meaning":"日本語訳", "combination":"既存語 拡張詞", "components":["単語1","単語2"], "reason":"【意味】...\n【語源・由来】..."}

[4. 既存・類似概念]
{"part_of_speech_word.2":"noun|verb|extender", "root_word.2":"既存語幹"}

[5. 無効・ルール違反]
{"status":"invalid", "reason":"理由"}
`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview", systemInstruction: ityaRules});

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const { concept } = req.body;

  if (!concept) {
    return res.status(400).json({ status: "invailed", reason: "入力が空か、無効な単語です！"});
  }

  try {
    console.log(`[LOG] '${concept}' の単語を検索中`);

    const wordSnap = await db.collection('itya_words').where('concept_ja', '==', concept).get();
    if (!wordSnap.empty) {
      const existingWord = wordSnap.docs[0].data();
      console.log(`[INFO] もう単語があります！: ${existingWord.word_noun} (ID: ${wordSnap.docs[0].id})`);
      return res.json({ 
        status: "existing",
        id: wordSnap.docs[0].id, 
        data: { 
          noun: existingWord.word_noun, 
          verb: existingWord.word_verb, 
          extender: existingWord.word_extender 
        }, 
        reason: existingWord.reason || "既存の単語ですが、詳細な解説データが保存されていません。" 
      });
    }

    const complexSnap = await db.collection('itya_complex').where("concept_ja", "==", concept).get();
    if (!complexSnap.empty) {
      const complexWord = complexSnap.docs[0].data();
      console.log(`[INFO] 過去の複合語データベースから発見！: ${complexWord.combination} (ID: ${complexSnap.docs[0].id})`);
      return res.json({ 
        status: "complexed",
        meaning: complexWord.concept_ja,
        combination: complexWord.combination,
        complexity_type: complexWord.complexity_type || "semantic",
        components: complexWord.components || [],
        syntax_logic: complexWord.syntax_logic,
        reason: complexWord.reason || "[データベースの記憶より] 過去に生成された複合概念ですが、詳細な解説がありません。" 
      });
    }

    const allWords = await db.collection('itya_words').get();
    const checkListStr = allWords.docs.map(doc => {
    const d = doc.data();
    const w = d.word_noun || d.word_verb || d.word_extender;
    if (!w) {
        if (d.root) return `${d.meaning || d.concept_ja}: ${d.root}`;
        return "";
    }

    const root = w.length <= 2 ? w : w.slice(0, -1);
    return `${d.concept_ja || d.meaning}: ${root}`;
    }).filter(line => line !== "").join(', ');

    let basePrompt = `
    概念: 「${concept}」
    既存リスト: ${checkListStr}
    
    上記のリストを必ず確認し、類似・包含される概念がすでに存在しないかを最優先で精査しなさい。
    絶対にルールとJSONフォーマットに従い出力すること。`;

    let attempt = 0;
    const maxAttempts = 3;
    let aiRes = null;
    let currentPrompt = basePrompt;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function performAiGeneration(concept, maxRetries) {
  let currentPrompt = basePrompt;
  let validationFailCount = 0; // 🚨 ルール違反のカウント

  // 10回くらい回す覚悟でいろ。ただしルール違反は3回までだ。
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      console.log(`[LOG] AI生成試行 ${attempt}回目...`);
      const result = await model.generateContent([ityaRules, currentPrompt]);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);

      // サニタイズ（大文字を小文字に強制変換）
      if (parsed.root) parsed.root = parsed.root.toLowerCase();
      
      // バリデーション実行
      if (parsed.status === 'new') validateRoot(parsed.root);
      // (semi_complexedのバリデーションもここに入れる)

      return parsed; // ✅ 成功したら即座に返す！

    } catch (err) {
      // 🚨 503エラー（High Demand）の場合は、ルール違反カウントを増やさずにリトライ！
      const isApiError = err.message.includes("503") || err.message.includes("Service Unavailable");
      
      if (!isApiError) {
        validationFailCount++;
        console.warn(`[WARN] ルール違反（${validationFailCount}回目）: ${err.message}`);
      } else {
        console.warn(`[WARN] サーバー混雑中（503）。リトライを継続します。`);
      }

      if (validationFailCount >= maxRetries) {
        throw new Error(`AIが${maxRetries}回連続でミス！`);
      }

      // エクスポネンシャル・バックオフ（待機）
      const waitTime = Math.pow(2, Math.min(attempt, 5)) * 1000;
      console.log(`[LOG] ${waitTime / 1000}秒待機して再開`);
      await new Promise(r => setTimeout(r, waitTime));
      if (!isApiError) {
        currentPrompt = basePrompt + `\n\n【警告】前回「${err.message}」というミスをしました！気を付けてくださいね。`;
      }
    }
  }
}

    aiRes = await performAiGeneration(concept, maxAttempts);
    const batch = db.batch();

    if (aiRes.status === 'new') {
      validateRoot(aiRes.root);
      const newDoc = db.collection('itya_words').doc();
      batch.set(newDoc, {
        concept_ja: concept,
        word_noun: aiRes.root + "a",
        word_verb: aiRes.root + "i",
        word_extender: aiRes.root + "u",
        reason: aiRes.reason,
        level: 2,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

    } else if (aiRes.status === 'complexed') {
      const newComplex = db.collection('itya_complex').doc();
      batch.set(newComplex, {
        concept_ja: concept,
        combination: aiRes.combination,
        complexity_type: aiRes.complexity_type,
        components: aiRes.components,
        syntax_logic: aiRes.syntax_logic,
        reason: aiRes.reason,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

    } else if (aiRes.status === 'semi_complexed') {
      if (Array.isArray(aiRes.words)) {
        for (const w of aiRes.words) {
          if (w.status === 'new') {
            validateRoot(w.root);
            const partDoc = db.collection('itya_words').doc();
            batch.set(partDoc, {
              concept_ja: w.meaning || `(Part of ${concept})`,
              word_noun: w.root + "a",
              word_verb: w.root + "i",
              word_extender: w.root + "u",
              reason: w.reason || "複合語の構成要素として生成",
              level: 2,
              created_at: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
      
      const newComplex = db.collection('itya_complex').doc();
      batch.set(newComplex, {
        concept_ja: concept,
        combination: aiRes.combination,
        words: aiRes.words,
        reason: aiRes.reason,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (aiRes.trivia) {
      const triviaDoc = db.collection('itya_trivia').doc();
      batch.set(triviaDoc, {
        content: aiRes.trivia,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
    res.json(aiRes);

  } catch (error) {
    console.error("エラー！:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trivia/random', async (req, res) => {
  try {
    const snapshot = await db.collection('itya_trivia').get();
    if (snapshot.empty) {
      return res.json({ trivia: "i-tyaは、日常生活における迅速な意思疎通を最優先に設計された言語です。" });
    }
    
    const docs = snapshot.docs;
    const randomDoc = docs[Math.floor(Math.random() * docs.length)];
    
    res.json({ trivia: randomDoc.data().content });
  } catch (error) {
    console.error("トリビア取得エラー:", error);
    res.status(500).json({ error: "Failed to fetch trivia" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`i-tya dictionary is running on port ${PORT}`);
});

function validateRoot(root) {
  if (!root) throw new Error("語幹が空！");

  if (/\s/.test(root)) {
    throw new Error(`語幹にスペース！ [${root}] `);
  }

  if (/[aiu]$/i.test(root)) {
    throw new Error(`語幹の末尾が母音！: [${root}]`);
  }

  const testWord = root + "a";

  const ityaRegex = /^(?:[hklmnpst]?[wy]?[aiu])+$/;

  if (!ityaRegex.test(testWord)) {
    throw new Error(`i-tyaの音韻規則に違反しました！不正な子音の連続や無効な文字が含まれています: [${root}]`);
  }

  const vowelCount = (testWord.match(/[aiu]/g) || []).length;

  if (vowelCount <= 1) {
    throw new Error(`レベル1の単語を作ったよ！: [${root}]`);
  }
}