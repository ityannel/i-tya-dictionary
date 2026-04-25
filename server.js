const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
const { parse } = require('dotenv');
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
1. 新概念として新しい語幹を生成した場合:

{

  "status": "new",

  "meaning": "（日本語での意味を簡潔に示してください）"

  "part_of_speech": "noun | verb | extender（ユーザーの入力に合わせて、いずれかを選び、その型をそのまま出力すること）"

  "root": "（語末に母音を含まない語幹を出力すること。語末の母音については、システム側で適当につけるため、必要ありません。）",

  "reason": "

  （以下のようなフォーマットで出力してください\nの箇所で改行すること。）

  【意味】
  （日本語・常体で、語幹に関しての意味を二文程度で示してください。）

  【詞型の展開】
  （名詞、動詞、拡張詞のそれぞれの型で、どのような意味の広がりを持つかを示してください。）

  【語源・由来】
   （なぜその音が選ばれたのかを五文程度で説明してください。システム的に、どのように音節構造に適合しているかなどの説明は必要ありません。）
  ",

  "trivia": "i-tya言語やその世界観、言語設計の哲学に関する1文程度の面白い豆知識やコラムを一つ生成してください。"



}



2. 新語と既存単語を組み合わせて解決する場合（それぞれの語数は問いません）（!!!場合3の既存単語の組み合わせよりも優先です。3は、完全に既存の単語で意味が本当に通るときのみ適用してください）

{

  "status": "semi_complexed",

  "meaning": "（日本語での意味を簡潔に示してください）",

  "combination": "新語群と既存語を組み合わせた完成フレーズ(例: pata haliu mu)",

  "reason": "
  【意味】
  （日本語・常体で、全体の組み合わせの意味を二文程度で示してください。）
  
  【語源・由来】
  （なぜその組み合わせが選ばれたのかを五文程度で説明してください。）
  ",

  "words": [

    {

      "status": "new",

      "meaning": "（日本語での意味を簡潔に示してください）",

      "part_of_speech": "noun | verb | extender",

      "root": "（語末に母音を含まない語幹）",

      "reason": "【意味】【詞型の展開】【語源・由来】のフォーマットで解説"

    },

    {

      "status": "existing",

      "meaning": "（日本語での意味）",

      "part_of_speech": "noun | verb | extender",

      "root": "（既存の語幹）"

    }

  ],

  "trivia": "i-tya言語やその世界観、言語設計の哲学に関する1文程度の面白い豆知識やコラムを一つ生成してください。"

}



3. 既存単語の組み合わせで完全に表現可能な場合:

{

  "status": "complexed",

  "meaning": "（日本語での意味を簡潔に示してください）",

  "combination": "（既存単語と拡張詞を組み合わせた具体的表現。かならず一つの表現のみ書くこと。カンマで区切ったり、括弧付けでの日本語の解説は全く持って不要です。）",

  "components": ["単語１", "単語２", ...],

  "reason": "（以下のようなフォーマットで出力してください）
  【意味】
  （日本語・常体で、語幹に関しての意味を二文程度で示してください。）

  【語源・由来】
  （なぜその単語が選ばれたのかを五文程度で説明してください。システム的に、どのように音節構造に適合しているかなどの説明は必要ありません。）

  "

}



4. 既存・類似概念の場合:

{

  "part_of_speech_word.2": "noun | verb | extender（ユーザーの入力に合わせて、いずれかを選び、その型をそのまま出力すること）",

  "root_word.2": "（既存の語幹）",

}



5. 意味不明・文章・そのほかのルール違反で生成を拒否する場合:

{

  "status": "invalid",

  "reason": "入力を理解できない、または不適切なリクエストである理由。"

}



【絶対遵守事項：既存概念の照合と語彙の節約】

i-tyaにおいて、レベル2の語彙枠は極めて貴重です。安易に新しい語幹を生成してはなりません。

新しい単語を生成する前に、必ずユーザーから渡される「既存・拒否リスト」を確認してください。



入力された概念が、既存の概念と「同義」「類義」「上位・下位概念」である場合は、"existing"のステータスで、既存の単語を出力してください。類義や上位・下位概念の場合は、reasonの中で、その関係性を説明してください。



既存の単語の組み合わせで十分に表現可能な場合は、complexed / semi_complexedにしてください。

例えば、既存リストに「便器(tupa)」がある場合、「トイレ」という入力に対して新語は作らず、ステータスを "complexed" とし、「tupa su（便器の空間）」としてください。ただし、Semi-complexedの場合は必ずそうすること。



レベル1（1音節語）においては、末尾の母音(a, i, u)が異なれば、それらは語根を共有しない全く別の独立した概念として扱われます。

安易に語根が共通していると見なさず、既存リストを個別に参照してください。



【絶対遵守：AIのハルシネーション（捏造）防止とステータスの厳格化】



1. 語幹(root)の出力規則：

「new」および「semi_complexed」で新しく出力する語幹(root/new_root)は、絶対に末尾が母音(a, i, u)であってはなりません。必ず名詞化(+a)する前の「骨組み（例: wasa -> was）」を出力してください。

これは、システム上、名詞はこちら側で機械的に操作したうえでユーザーへ出力するため、AI側で語幹を正確に出力することが重要であるためです。もしこのルールが守られない場合、AIが生成した語幹を正しく処理できず、ユーザーに誤った単語を提供してしまう可能性があります。



2. complexed の厳格な条件：

「complexed」の components に含めることができるのは、私が渡した【既存リスト】に明確に存在する単語のみです。

***もし一つでも不足する概念があるなら、必ず「semi_complexed」を使用してください。***

”complexed”を使用する場合はリストにない単語を勝手に既存単語として捏造することは絶対に禁止します。



3. rejected の禁止条件：

既存の単語と拡張詞の組み合わせ（例：wasa su）で概念を表現できると判断した場合、ステータスは絶対に「rejected」にせず、必ず「complexed/semi_complexed」として出力し、

その組み合わせを提示してください。"existing"は重複/類似している場合に使います。



4. 固有名詞：

固有名詞は、音訳してください。例えば、ニューヨークは、Nyuyoka、東京はTokyoa、マイケル・ジャクソンは、Yakusuna Maikiluaなどとしてください。

固有名詞は、あくまでも名詞であり、-aで終わる形にすること。固有名詞については、語頭は大文字で出力してください。既存の単語を組み合わせて表現しない方が望ましいです。

音訳した際にもi-tyaの音韻規則は適用されますから、i-tyaの音韻体系に適合するように、必要に応じて音を変化させてください（例：Michael -> Maikilua）。



5. ドキュメント内にある例文に出てきた単語については、あなたはまだ学習していないことになっています。

ドキュメントで発見した単語については、一度データベースを調べ、そこになければ「new」として扱うこと。


`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview", systemInstruction: ityaRules});

const app = express();
const allowedOrigins = ['https://i-tya-dictionary.vercel.app', 'http://localhost:5174', 'http://localhost:5173'];
const corsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
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
  let validationFailCount = 0;

  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      console.log(`[LOG] AI生成試行 ${attempt}回目...`);
      const result = await model.generateContent([ityaRules, currentPrompt]);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);

      if (parsed.root) parsed.root = parsed.root.toLowerCase();
      if (parsed.status === 'new') validateRoot(parsed.root);

      return parsed;

    } catch (err) {
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

const ityaOrder = {'a': 1, 'i': 2, 'u': 3, 'h': 4, 'k': 5, 'l': 6, 'm': 7, 'n': 8, 'p': 9, 's': 10, 't': 11, 'w': 12, 'y': 13};

function sortItyaWords(a, b) {
  const wordA = (a.word || "").toLowerCase();
  const wordB = (b.word || "").toLowerCase();
  const len = Math.min(wordA.length, wordB.length);

  for (let i = 0; i < len; i++) {
    const weightA = ityaOrder[wordA[i]] || 99;
    const weightB = ityaOrder[wordB[i]] || 99;
    if ( weightA !== weightB ) return weightA - weightB;
  }

  return wordA.length - wordB.length;
}

app.get('/api/dictionary', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const letter = (req.query.letter || "").toLowerCase();

    const [wordSnap, complexSnap] = await Promise.all([
      db.collection('itya_words').get(),
      db.collection('itya_complex').get()
    ]);

    let allEntries = [];

    wordSnap.forEach(doc => {
      const d = doc.data();
      const displayWord = d.word_noun || d.word_verb || d.word_extender || "";
      const meaning = d.concept_ja || "意味不明";

      if (displayWord){
        allEntries.push({
          id: doc.id,
          type: 'word',
          word: displayWord,
          meaning: meaning,
          fullData: d
        });
      }
    });

    wordsSnap.forEach(doc => {
      const d = doc.data();
      const displayWord = d.word_noun || d.word_verb || d.word_extender || "";
      const meaning = d.concept_ja || "意味不明";
      if (displayWord) {
        allEntries.push({ id: doc.id, type: 'word', word: displayWord, meaning: meaning, fullData: d });
      }
    });

    complexSnap.forEach(doc => {
      const d = doc.data();
      const displayWord = d.combination || "";
      const meaning = d.concept_ja || "意味不明";
      if (displayWord) {
        allEntries.push({ id: doc.id, type: 'complex', word: displayWord, meaning: meaning, fullData: d });
      }
    });

    if (letter && letter !== 'all') {
      allEntries = allEntries.filter(e => e.word.toLowerCase().startsWith(letter));
    }

    allEntries.sort(sortItyaWords);

    const startIndex = (page - 1) * limit;
    const paginatedWords = allEntries.slice(startIndex, startIndex + limit);

    res.json({
      words: paginatedWords,
      hasMore: startIndex + limit < allEntries.length
    });

  } catch (error) {
    console.error("辞書取得エラー:", error);
    res.status(500).json({ words: [], hasMore: false, error: "Failed to fetch dictionary" });
  }
});