const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// --- 1. Firestoreの初期化 ---
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- 2. Gemini APIの初期化 ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const app = express();
app.use(cors());
app.use(express.json());

// --- 3. 単語生成APIエンドポイント ---
app.post('/api/generate', async (req, res) => {
  const { concept } = req.body;

  if (!concept) {
    return res.status(400).json({ error: "概念(concept)を入力してください。" });
  }

  try {
    console.log(`[LOG] '${concept}' のi-tya単語を生成中...`);

    const prompt = `
      あなたは人工言語「i-tya」のコンパイラです。以下のルールに厳密に従い、JSON形式で単語を出力してください。
      入力された概念: ${concept}
      
      【絶対ルール】
      1. すべての単語は小文字のアルファベットのみで生成すること。
      2. 母音は a, i, u の3つのみを使用すること（e, o は絶対に使用禁止）。
      3. 一つの語根（ルート）を決定し、そこから名詞(-a)、動詞(-i)、拡張詞(-u)の3パターンを派生させること。
      4. 以下のシステム拡張詞（予約語）と完全に一致する単語は生成しないこと: ku, mu, kyu, tu, tyu, nu, pu, pyu, syu, yu, hu, nyu, su, lu

      【出力フォーマット】
      必ず以下のJSON構造で出力してください。
      {
        "root_meaning": "語根の意味",
        "words": {
          "noun": "名詞の単語",
          "verb": "動詞の単語",
          "extender": "拡張詞の単語"
        }
      }
    `;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const responseText = result.response.text();
    console.log("[DEBUG] Geminiからの生データ:", responseText); 

    const generatedData = JSON.parse(responseText);

    // --- 安全なデータ取り出し ---
    const noun = generatedData.words?.noun || generatedData.noun || "error-a";
    const verb = generatedData.words?.verb || generatedData.verb || "error-i";
    const extender = generatedData.words?.extender || generatedData.extender || "error-u";

    // --- 4. Firestoreにデータを保存 ---
    const docRef = await db.collection('itya_words').add({
      concept_ja: concept,
      root_meaning: generatedData.root_meaning || "ルートの意味",
      word_noun: noun,
      word_verb: verb,
      word_extender: extender,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[SUCCESS] Firestoreに保存しました (ID: ${docRef.id})`);
    res.json({ id: docRef.id, data: { noun, verb, extender } });

  } catch (error) {
    console.error("[ERROR]", error);
    res.status(500).json({ error: "単語の生成または保存に失敗しました。" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`i-tya Genesis Engine is running on port ${PORT}`);
});