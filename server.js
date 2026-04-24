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

const ityaRules = `
あなたは人工言語「i-tya」の厳格なコンパイラ・言語学者です。
以下のドキュメントのルールに絶対に従い、単語を生成してください。また、以下で示すような、単語のレベルについては、細心の注意を図ること。レベル１の音節数が1の単語については、絶対に生成しないこと。
レベル2についても、枠は貴重であるから、本当にその単語が世界中の人々に対して重要かを見極めたうえで、選ぶこと。最終的に機械的なチェックが入ることも考慮してください。
単語はすべて小文字のアルファベットで生成してください。また、以下で示す音節構造には確実に従うこと。指定されたjson形式以外での出力は避けてください。

i-tya言語のガイドライン
Itya Minato

導入と言語哲学
　本文書では、人工言語「i-tya」の紹介と、そのガイドラインを示す。i-tyaは、日常生活における迅速な意思疎通を最優先に設計された言語だ。学術的な議論や情緒的な表現の深さを追求するのではなく、「覚える・読む・聞く・話す・書く」の全工程をいかに速く・簡単に行えるかということに重きを置いた言語である。

音韻
　i-tyaにおける音韻体系は明瞭さと発音の容易さを最大化するよう設計された。これを達成するために、i-tyaでは13のアルファベットとそれに付随する音節構造のみを使用する。

3つの母音: a, i, u
8つの子音: h, k, l, m, n, p, s, t
2つの半母音: w, y

2.1 音素選定の理由
　音素は、世界の言語を吟味し、音響的な区別に焦点を当てて、客観的な基準に基づいて選択した。13文字のそれぞれは、母語に関係なく、あらゆる人類の話者にとって話しやすく・聞き取りやすいように選択した。

2.1.1 母音（V）
　i-tyaは、3つの母音（a, i, u）のみを使用する。例えば、日本語における（[e], [o]）は、母音の三角形において、半端な位置にあるため、一部の話者にとって認識が難しい。i-tyaでは、母音の三角形
（右図）において、頂点となる、最も極端な点の3つ（[a], [i], [u]）のみを選択した。これにより、たとえ激しいアクセントや、騒音のある環境であっても、音韻体系的にそれぞれの距離が最大であり、発話が認識可能である。

2.1.2 子音（C）と半母音（G）
　i-tyaでは、基本的な音素として、8つの子音
（h, k, l, m, n, p, s, t）と、2つの半母音（w, y）を使用する。これらが選択された理由について、以下で解説する。

2.2 音節構造
　i-tyaは、子音（C）、半母音（G）、母音（V）において、(C)(G)Vモデルを用いる。
音素の一貫性を維持して、音響的なあいまいさを抑える。

2.2.1 許可された音素構成
　i-tyaは以下の4つの音素構成のみが許可されている。
V （母音のみ）: 母音のみからなる音節（例：a, i, u）。
CV（子音+母音）: 日本語にもみられる、最も基本的な音素構成（例：ka, ni, pu）。
GV（半母音+母音）: （例：wa, yu）この場合、半母音は音節頭において、子音と同様の機能をするから、許可される。
CGV（子音+半母音+母音）: 子音と母音の間に半母音（w, y）を挿入した音節（例：tya, swa）。

これにより、音韻体系の規則によると、生成できる音節の総数は 3 + 8×3 + 2×3 + 8×2×3  = 81音節であるとわかる。

2.2.2 音節の配列
VV連結の許可 : i-tyaは、言語学的な連音（サンディー）を一切許容しないから、母音の連続を認める。それにより、すべての音素の元の形を保持する。（例：aa, uaau）
閉音節の禁止 : 2.2.1より明白であるが、いかなる音節も子音で終わってはならず、母音である必要がある。これは、音声の認識をより簡単に行うためである。

語彙の構成
　i-tyaで、語彙は、言語的な重要度と使用頻度に応じてレベル分けをする。そのレベルごとに、語彙の音節数を決定する（例：「ma」私（レベル1）, 「koti」行く（レベル2））。

3.1 品詞の分類
　i-tyaにおいて、語彙は必ず、名詞、動詞、拡張詞のいずれかに分類される必要がある。またそれらの分類において、単語はそれぞれ「-a」「-i」「-u」で終わるように設定する。

　それぞれの判別は、必ず語末の母音によってのみ行われるべきで、一つの単語が複数の品詞を兼ねることは許可されない。つまり、その単語がどの品詞かは、語末母音によって一意に定まる。


名詞 : 概念、人、場所、物などの対象。-a。
動詞 : 動作、状態の変化、現象などの動的な事象。-i。
拡張詞 : 上記以外。性質、状態、接続詞、格など。-u。

3.2 語彙階層

レベル1（音節数1）:  もっとも使用頻度が高く、文章の論理構造を維持する最小単位の語彙群である。すべて1音節のみ（V, CV, GV, CGVのいずれか）をもって構成される。

設定可能な語彙数 : 81語
閉じた語類（Closed Class） : このレベルに属する単語は、言語学的な閉じた語類に分類される。時代の変化に合わせて、際限なく新しい単語を受け入れることのできる開いた語類に対して、言語におけるもっとも中心的な文法的要素、代名詞、前置詞、接続詞などが、閉じた語類にあたる。

レベル2（音節数2）:  数詞、普遍的な動詞と、それに関する名詞、拡張詞が設定される。

設定可能な語彙数 : 81((C)(G)V) × 81((C)(G)V) = 6561語
準開いた語類（Semi-Open Class） : このレベルに属する単語は、i-tyaにおいて準・開いた語類と定義した。約4000の限られた枠組みの中で、特に重要な新しい概念や行動について、柔軟な語彙生成をもって対応する。ただし、完全な開いた語類ではなく、一定の境界線を引く必要がある。
数詞の例外 : 数詞については普遍的であるにもかかわらず、複数音節にまたがることが避けられないため、二音節以上を基本として、すべての数詞をレベル2に分類する。数詞は名詞に分類され、すべて拡張詞「lu」から始まることとし、一の位を基本として無限に拡張が可能である。下に数詞の例を示す。

0
lua
10
lutuma
20
lupatuma
30
lunatuma
1
luma
11
lutumama
21
lupatumama
50
lulatuma
2
lupa
12
lutumapa
22
lupatumapa
80
luhatuma
3
luna
13
lutumana
23
lupatumana
99
luyatumaya
4
lusa
14
lutumasa
24
lupatumasa
100
lutupa
5
lula
15
lutumala
25
lupatumala
101
lutupama
6
luta
16
lutumata
26
lupatumata
121
lutupapatumama
7
luka
17
lutumaka
27
lupatumaka
150
lutupalatuma
8
luha
18
lutumaha
28
lupatumaha
200
lupatupa
9
luya
19
lutumaya
29
lupatumaya
1000
lutuna

レベル3（音節数3以上）: 上記のレベルに分類されない、より複雑な概念、専門用語、外来語などのための拡張用の語彙群が設定される。音節数に関しては、3以上を基本とする。
設定可能な語彙数 : 理論上無限
開いた語類（Open Class） : 完全な開いた語類に分類される。ただし、いかなる場合でも、3.1.1で触れた品詞による語末の変化が適用されなければならない。

【絶対遵守：出力JSONフォーマット】
ここで、語幹とは、生成された単語の共通部分であり、そこから名詞、動詞、拡張詞が派生することになる。
例えば、「koti（行く）」という動詞が生成された場合、その語幹は「kot」となり、そこから「kota（名詞）」「koti（動詞）」「kotu（拡張詞）」が派生することになる。
出力は必ず以下のJSON構造のみとし、余計なテキスト（マークダウンや挨拶）は一切含めないこと。
"root" には、末尾の母音(a,i,u)を含まない「語幹」のみを記述すること。
理由等は日本語で、だ・である体で出力すること。

reason: 
【最重要】ユーザー向けの学術的解説。 以下の要素を必ず含めること。

語源・由来: なぜその音（子音・母音）が選ばれたのか。

詞型の展開: 名詞(-a)、動詞(-i)、拡張詞(-u)にした時、それぞれどのような具体的意味の広がりを持つか。

哲学的背景: i-tyaの設計思想（迅速性・明瞭性）に基づいたその単語の立ち位置。
※「既存リストにあるので生成を拒否します」といったシステム的なメタ発言は厳禁。既に存在する場合も、その単語の純粋な解説だけを出力せよ。

1. 新概念として新しい語幹を生成した場合:
{
  "status": "new",
  "meaning": "（日本語での意味を簡潔に示してください）"
  "part_of_speech": "noun | verb | extender（ユーザーの入力に合わせて、いずれかを選び、その型をそのまま出力すること）"
  "root": "（語末に母音を含まない語幹を出力すること。語末の母音については、システム側で適当につけるため、必要ありません。）", 
  "reason": "
  （以下のようなフォーマットで出力してください）
  【意味】
  （日本語・常体で、語幹に関しての意味を二文程度で示してください。）
  【詞型の展開】
  （名詞、動詞、拡張詞のそれぞれの型で、どのような意味の広がりを持つかを示してください。）
  【語源・由来】
  （なぜその音が選ばれたのかを説明してください。システム的に、どのように音節構造に適合しているかなどの説明は必要ありません。）
  "
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
  （なぜその組み合わせが選ばれたのかを説明してください。）
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
  ]
}

3. 既存単語の組み合わせで完全に表現可能な場合:
{
  "status": "complexed",
  "meaning": "（日本語での意味を簡潔に示してください）",
  "combination": "（既存単語と拡張詞を組み合わせた具体的表現。かならず一つの表現のみ書くこと。カンマで区切ったり、括弧付けでの日本語の解説は全く持って不要です。）",
  "components": ["単語１", "単語２", ...],
  "reason": "
  （以下のようなフォーマットで出力してください）
  【意味】
  （日本語・常体で、語幹に関しての意味を二文程度で示してください。）
  【語源・由来】
  （なぜその単語が選ばれたのかを説明してください。システム的に、どのように音節構造に適合しているかなどの説明は必要ありません。）
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
      return res.json({ id: wordSnap.docs[0].id, data: { noun: existingWord.word_noun, verb: existingWord.word_verb, extender: existingWord.word_extender }, reason: "既存の単語が見つかりました！" });
    }

    const complexSnap = await db.collection('itya_complex').where("concept_ja", "==", concept).get();
    if (!complexSnap.empty) {
      const complexWord = complexSnap.docs[0].data();
      console.log(`[INFO] 過去の複合語データベースから発見！: ${complexWord.combination} (ID: ${complexSnap.docs[0].id})`);
      
      // AIが「complexed」を生成した時と同じフォーマットでフロントに返す
      return res.json({ 
        status: "complexed",
        meaning: complexWord.concept_ja,
        combination: complexWord.combination,
        complexity_type: complexWord.complexity_type || "semantic",
        components: complexWord.components || [],
        syntax_logic: complexWord.syntax_logic,
        reason: "[データベースの記憶より] 過去に生成された複合概念です。" 
      });
    }

    const allWords = await db.collection('itya_words').get();
    const checkListStr = allWords.docs.map(doc => {
    const d = doc.data();
    // データベースのスキーマ違いを吸収する
    const w = d.word_noun || d.word_verb || d.word_extender;
    
    // もし w がなくて、直接 root が登録されていればそれを使う（今回インポートしたデータ用）
    if (!w) {
        if (d.root) return `${d.meaning || d.concept_ja}: ${d.root}`;
        return ""; // 完全に壊れたデータは無視
    }

    // 従来のデータ用
    const root = w.length <= 2 ? w : w.slice(0, -1);
    return `${d.concept_ja || d.meaning}: ${root}`;
    }).filter(line => line !== "").join(', ');

    let basePrompt = `
    概念: 「${concept}」
    既存リスト: ${checkListStr}
    
    上記のリストを必ず確認し、類似・包含される概念がすでに存在しないかを最優先で精査しなさい。
    絶対にルールとJSONフォーマットに従い出力すること。`;

    let attempt = 0;
    const maxAttempts = 3; // AIにチャンスを与える最大回数
    let aiRes = null;
    let currentPrompt = basePrompt;

    while (attempt < maxAttempts) {
      try {
        console.log(`[LOG] AI生成試行 ${attempt + 1}回目...`);
        const result = await model.generateContent([ityaRules, currentPrompt]);
        const responseText = result.response.text().replace(/```json|```/g, '').trim();
        aiRes = JSON.parse(responseText);

        if (aiRes.status === 'new') {
          validateRoot(aiRes.root);
        } else if (aiRes.status === 'semi_complexed' && Array.isArray(aiRes.words)) {
          for (const word of aiRes.words) {
            if (word.status === 'new') {
              validateRoot(word.root);
            }
          }
        }
        
        break; 
        
      } catch (validationError) {
        attempt++;
        console.warn(`[WARN] AIが違反した単語を生成した（${attempt}回目）: ${validationError.message}`);
        
        if (attempt >= maxAttempts) {
          throw new Error(`AIが${maxAttempts}回連続で違反した！: ${validationError.message}`);
        }
        
        currentPrompt = basePrompt + `\n\n【システムからの絶対的警告】
        前回あなたが生成した回答は、以下の致命的なルール違反により拒否されました：
        「${validationError.message}」
        前回の回答（語幹や組み合わせ）は完全に破棄し、この指摘を深く反省した上で、同じエラーを絶対に繰り返さないアプローチで再生成してください。`;
      }
    }

    const batch = db.batch();

    if (aiRes.status === 'new') {
      // 新語保存
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
      // 完全複合語保存
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

    // バッチ実行
    await batch.commit();
    res.json(aiRes);

  } catch (error) {
    console.error("エラー！:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`i-tya dictionary is running on port ${PORT}`);
});

function validateRoot(root) {
  if (!root) throw new Error("AIが語幹を空っぽにしてきやがったぜ。");

  if (/\s/.test(root)) {
    throw new Error(`語幹にスペースが含まれてるぞ！ [${root}] 複合ならcomplexedを使え！`);
  }

  if (/[aiu]$/i.test(root)) {
    throw new Error(`語幹の末尾が母音だ！子音か半母音で終わらせろ！: [${root}]`);
  }

  const testWord = root + "a";

  const ityaRegex = /^(?:[hklmnpst]?[wy]?[aiu])+$/;

  if (!ityaRegex.test(testWord)) {
    throw new Error(`i-tyaの音韻規則に違反してるぞ！不正な子音の連続(hpaなど)や無効な文字が含まれてる: [${root}]`);
  }

  const vowelCount = (testWord.match(/[aiu]/g) || []).length;

  if (vowelCount <= 1) {
    throw new Error(`レベル1の単語を捏造しようとしたな！: [${root}]`);
  }
}