const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
//  定数
// ─────────────────────────────────────────────
const CACHE_FILE = path.join(__dirname, 'cache.json');
const CACHE_TTL = 12 * 60 * 60 * 1000;   // 12時間
const TRIVIA_TTL = 60 * 60 * 1000;        // 1時間
const AI_MODEL = "gemini-3-flash-preview";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "your_secret_password";

// ─────────────────────────────────────────────
//  2層キャッシュ
// ─────────────────────────────────────────────
const memCache = {
  words: [],
  complex: [],
  trivias: [],
  loadedAt: 0,
  triviaLoadedAt: 0
};

function saveCacheFile() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      words: memCache.words,
      complex: memCache.complex,
      trivias: memCache.trivias,
      loadedAt: memCache.loadedAt,
      triviaLoadedAt: memCache.triviaLoadedAt
    }), 'utf8');
    console.log('[CACHE] cache.json に保存しました');
  } catch (e) {
    console.warn('[CACHE] cache.json の保存に失敗:', e.message);
  }
}

function loadCacheFile() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const age = Date.now() - (raw.loadedAt || 0);
      if (age < CACHE_TTL) {
        memCache.words = raw.words || [];
        memCache.complex = raw.complex || [];
        memCache.trivias = raw.trivias || [];
        memCache.loadedAt = raw.loadedAt || 0;
        memCache.triviaLoadedAt = raw.triviaLoadedAt || 0;
        console.log(`[CACHE] cache.json から復元 (${memCache.words.length}語, ${memCache.complex.length}複合語, 経過${Math.round(age / 60000)}分)`);
        return true;
      } else {
        console.log('[CACHE] cache.json が古いため無視します（TTL超過）');
      }
    }
  } catch (e) {
    console.warn('[CACHE] cache.json の読み込みに失敗:', e.message);
  }
  return false;
}

async function refreshCacheFromFirebase() {
  console.log('[CACHE] Firebaseから全件取得開始...');
  const [wordsSnap, complexSnap, triviaSnap] = await Promise.all([
    db.collection('itya_words').get(),
    db.collection('itya_complex').get(),
    db.collection('itya_trivia').limit(100).get()
  ]);
  memCache.words = wordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  memCache.complex = complexSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  memCache.trivias = triviaSnap.docs.map(d => d.data().content).filter(Boolean);
  memCache.loadedAt = Date.now();
  memCache.triviaLoadedAt = Date.now();
  saveCacheFile();
  console.log(`[CACHE] 取得完了: ${memCache.words.length}語, ${memCache.complex.length}複合語`);
}

async function ensureCache() {
  if (memCache.loadedAt > 0 && (Date.now() - memCache.loadedAt) < CACHE_TTL) return;
  await refreshCacheFromFirebase();
}

async function ensureTriviaCache() {
  if (memCache.triviaLoadedAt > 0 && (Date.now() - memCache.triviaLoadedAt) < TRIVIA_TTL) return;
  const snap = await db.collection('itya_trivia').limit(100).get();
  memCache.trivias = snap.docs.map(d => d.data().content).filter(Boolean);
  memCache.triviaLoadedAt = Date.now();
  saveCacheFile();
}

// ─────────────────────────────────────────────
//  キャッシュユーティリティ
// ─────────────────────────────────────────────
function findInCacheByConceptJa(concept) {
  const word = memCache.words.find(w => w.concept_ja === concept);
  if (word) return { type: 'word', data: word };
  const comp = memCache.complex.find(c => c.concept_ja === concept);
  if (comp) return { type: 'complex', data: comp };
  return null;
}

function findInCacheByRoot(root) {
  return memCache.words.find(w => {
    const wRoot = (w.word_noun || w.word_verb || w.word_extender || '');
    const r = wRoot.length <= 2 ? wRoot : wRoot.slice(0, -1);
    return r === root;
  }) || null;
}

function addWordToCache(id, data) {
  const exists = memCache.words.find(w => w.id === id || w.concept_ja === data.concept_ja);
  if (!exists) {
    memCache.words.push({ id, ...data });
    saveCacheFile();
  }
}

function addComplexToCache(id, data) {
  const exists = memCache.complex.find(c => c.id === id || c.concept_ja === data.concept_ja);
  if (!exists) {
    memCache.complex.push({ id, ...data });
    saveCacheFile();
  }
}

function removeFromCache(id) {
  memCache.words = memCache.words.filter(w => w.id !== id);
  memCache.complex = memCache.complex.filter(c => c.id !== id);
  saveCacheFile();
}

function buildWordListStr() {
  return memCache.words.map(w => {
    const word = w.word_noun || w.word_verb || w.word_extender;
    if (!word) return '';
    const root = word.length <= 2 ? word : word.slice(0, -1);
    return `${w.concept_ja || w.meaning}: ${root}`;
  }).filter(Boolean).join(', ');
}

function buildDictionaryEntries() {
  const words = memCache.words
    .filter(w => w.word_noun || w.word_verb || w.word_extender)
    .map(w => ({
      id: w.id,
      type: 'word',
      word: w.word_noun || w.word_verb || w.word_extender,
      meaning: w.concept_ja || '意味不明',
      fullData: w
    }));
  const complex = memCache.complex
    .filter(c => c.combination)
    .map(c => ({
      id: c.id,
      type: 'complex',
      word: c.combination,
      meaning: c.concept_ja || '意味不明',
      fullData: c
    }));
  return [...words, ...complex];
}

// ─────────────────────────────────────────────
//  起動時キャッシュ初期化
// ─────────────────────────────────────────────
loadCacheFile();

// ─────────────────────────────────────────────
//  インフライトマップ（重複リクエスト防止）
// ─────────────────────────────────────────────
const inflightGenerate = new Map();
const inflightTranslate = new Map();

// ─────────────────────────────────────────────
//  Firebase 初期化
// ─────────────────────────────────────────────
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ─────────────────────────────────────────────
//  ミドルウェア（一度だけ設定）
// ─────────────────────────────────────────────
app.use(express.json());

const allowedOrigins = [
  'https://i-tya-dictionary.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 200
}));

// ─────────────────────────────────────────────
//  AI 設定
// ─────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
9. part_of_speechについては、入力されたものに対して最も適当な形を選んでください。たとえば、「最新にする」だったら動詞、「最新」だったら名詞、「最新の」だったら拡張詞です。
10. 文章はそれぞれの説明で２文程度にしてください。

【JSONフォーマット】※状況に応じて以下のいずれかの構造のみ出力
1. 新概念として新しい語幹を生成した場合:
{
  "status": "new",
  "meaning_noun": "（名詞形の日本語表現。例：「走ること、走り」）",
  "meaning_verb": "（動詞形の日本語表現。例：「走る」）",
  "meaning_extender": "（拡張詞形の日本語表現。例：「走っている、走るような」）",
  "part_of_speech": "noun | verb | extender",
  "root": "（語末に母音を含まない語幹を出力すること。語末の母音については、システム側で適当につけるため、必要ありません。）",
  "reason_noun": "【意味】\n（名詞としての意味）\n\n【詞型の展開】\n（名詞の場合の使われ方）\n\n【語源・由来】\n（由来）",
  "reason_verb": "【意味】\n（動詞としての意味）\n\n【詞型の展開】\n（動詞の場合の使われ方）",
  "reason_extender": "【意味】\n（拡張詞としての意味）\n\n【詞型の展開】\n（拡張詞の場合の使われ方）",
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
      "reason_noun": "【意味】\n（名詞としての意味）\n\n【詞型の展開】\n（名詞の場合の使われ方）\n\n【語源・由来】\n（由来）",
      "reason_verb": "【意味】\n（動詞としての意味）\n\n【詞型の展開】\n（動詞の場合の使われ方）",
      "reason_extender": "【意味】\n（拡張詞としての意味）\n\n【詞型の展開】\n（拡張詞の場合の使われ方）"
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
  "root_word.2": "（既存の語幹）"
}

5. 意味不明・文章・そのほかのルール違反で生成を拒否する場合:

{
  "status": "invalid",
  "reason": "入力を理解できない、または不適切なリクエストである理由。"
}

【絶対遵守：AIのハルシネーション（捏造）防止とステータスの厳格化】

1. 語幹(root)の出力規則：
「new」および「semi_complexed」で新しく出力する語幹(root/new_root)は、絶対に末尾が母音(a, i, u)であってはなりません。必ず名詞化(+a)する前の「骨組み（例: wasa -> was）」を出力してください。

2. complexed の厳格な条件：
「complexed」の components に含めることができるのは、私が渡した【既存リスト】に明確に存在する単語のみです。
***もし一つでも不足する概念があるなら、必ず「semi_complexed」を使用してください。***
"complexed"を使用する場合はリストにない単語を勝手に既存単語として捏造することは絶対に禁止します。

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

const translateRules = `
あなたはi-tya言語の翻訳コンパイラだ。日本語文章をi-tya語に翻訳し、JSONのみ出力せよ。

【i-tya基本ルール】
音韻: 母音(a,i,u)、子音(h,k,l,m,n,p,s,t)、半母音(w,y)。音節構造(C)(G)V。子音終わり禁止。
品詞: -a=名詞、-i=動詞、-u=拡張詞。語末母音で一意に決まる。兼任不可。

【文法の核心：後置修飾】
i-tyaは完全な後置修飾言語だ。直前のブロック全体に対して後ろの要素が修飾する。
文章全体は「修飾を重ねた一つの巨大な名詞句」と考えよ。
語順の基本はSV型。主語（-a）→動詞（-i）→その他修飾の順。
重要な情報・確定させたい情報を先に置き、補足を後から加える。

【時制】
未確定時制（何もつけない）: 現在・未来・習慣・普遍的真理。変化する余地がある事象。
確定時制（nu）: 過去・完了。いかなる手段でも変更不可能な確定した事実。
例: Ma pati lamena nu.（私はラーメンを食べた）
nuの位置で確定範囲が変わる:
  Ma pati nu lamena. → 「食べた」という事実を強調
  Ma pati lamena nu. → 「ラーメンを食べる」という行為全体が確定

【否定】
hu（否定拡張詞）を挿入。huの位置で否定範囲が変わる。
  Ma pati lamena hu. → ラーメンを食べない
  Ma hu pati lamena. → 食べるという行為全体を否定

【疑問】
文末にnyu（疑問拡張詞）を配置。倒置なし。
nyuの位置で質問の焦点が変わる。
  Pa pati lamena nu nyu? → ラーメンを食べましたか？
  Pa nyu pati lamena nu? → "あなた"が食べましたか？
疑問詞: a=何/誰、a su=どこ、a tyu=いつ、a syu=なぜ、a tu=どうやって、i=何をした

【格拡張詞（助詞に相当）】
ku=～へ（方向・到達点）: Ma soti Nyuyoka ku nu.（私はNYへ行った）
mu=～から/の（起点・所属）: Ma soti Hakotatea mu nu.（私は函館から来た）
su=～で/に（空間・時間）: Ma pati habaga Nyuyoka su nu.（NYでハンバーガーを食べた）
tu=～で/を使って（手段・道具）: Ma pati habaga syuka tu nu.（手でハンバーガーを食べた）

【接続詞拡張詞（先行文の末尾に置く）】
pu=そして（付加・両方成立）: Ma pati patu pu, ma shakiti kata.
pyu=または（選択・どちらか一方）
syu=だから（確定した因果）: Ma pati nu syu, ma petati.
yu=もし～なら（未確定の条件）: Pa pati lamena yu, pa petati.

文頭は大文字。固有名詞の語頭は大文字。文章終了時に「.」疑問文は「?」感嘆文は「!」。文章の切れ目では「,」

【レベル1既定語（レベル1については新語生成禁止です。）】
人称: ma=私、pa=あなた、na=彼/彼女/それ
指示: sa=これ、la=あれ
場所・概念: wa=空間/場所、ya=事実、swa=言葉/記号、kya=道/方向
時間: pwa=前、mwa=後
時制・否定・疑問: nu=完了、hu=否定、nyu=疑問
格: ku=～へ、mu=～から/の、su=～で/に、tu=手段
接続: pu=そして、pyu=または、syu=だから、yu=もし
その他: myu=進行中、kyu=～たち(複数)、lu=数字prefix

【新語生成ルール】
rootは末尾母音(a,i,u)を除いた語幹のみ。末尾が母音であってはならない。
既存リストを必ず確認し、類似概念があればそれを使え。

【出力フォーマット】
{
  "translation": "完成したi-tya語文章",
  "breakdown": [
    {
      "japanese": "日本語の要素",
      "itya": "対応するi-tya語",
      "status": "existing | new | grammar",
      "root": "新語の場合のみ語幹（末尾母音なし）",
      "meaning_noun": "新語の場合のみ",
      "meaning_verb": "新語の場合のみ",
      "meaning_extender": "新語の場合のみ",
      "reason_noun": "新語の場合のみ【意味】\n\n【詞型の展開】\n\n【語源・由来】",
      "reason_verb": "新語の場合のみ【意味】\n\n【詞型の展開】",
      "reason_extender": "新語の場合のみ【意味】\n\n【詞型の展開】"
    }
  ]
}
`;

const generateModel = genAI.getGenerativeModel({ model: AI_MODEL, systemInstruction: ityaRules });
const translateModel = genAI.getGenerativeModel({ model: AI_MODEL, systemInstruction: translateRules });

// ─────────────────────────────────────────────
//  AI呼び出しユーティリティ
//  ・リトライ最大3回（バリデーションエラーのみ）
//  ・APIエラーは即座に生のエラーメッセージをログに出して上流に投げる
// ─────────────────────────────────────────────
async function callAIWithRetry(model, prompt, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] 試行 ${attempt}/${maxRetries}`);
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      console.log(`[AI] レスポンス受信 (${text.length}文字)`);
      const parsed = JSON.parse(text);
      if (parsed.root) parsed.root = parsed.root.toLowerCase();
      if (parsed.status === 'new') validateRoot(parsed.root);
      return parsed;
    } catch (err) {
      lastError = err;
      // 生のエラーを必ずログに出す
      console.error(`[AI] 試行${attempt}失敗 - ${err.constructor.name}: ${err.message}`);
      if (err.status) console.error(`[AI] HTTPステータス: ${err.status}`);

      // JSON/バリデーションエラーならリトライ
      const isValidationError = err instanceof SyntaxError || err.message.includes('語幹') || err.message.includes('音韻') || err.message.includes('レベル1');
      if (isValidationError && attempt < maxRetries) {
        console.warn(`[AI] バリデーションエラー。リトライします...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      // APIエラー（4xx/5xx）はリトライせず即投げ
      throw err;
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────
//  バリデーション
// ─────────────────────────────────────────────
function validateRoot(root) {
  if (!root) throw new Error('語幹が空！');
  const normalizedRoot = root.toLowerCase();
  if (/\s/.test(normalizedRoot)) throw new Error(`語幹にスペース！ [${root}]`);
  if (/[aiu]$/.test(normalizedRoot)) throw new Error(`語幹の末尾が母音！: [${root}]`);
  const testWord = normalizedRoot + 'a';
  const ityaRegex = /^(?:[hklmnpst]?[wy]?[aiu])+$/;
  if (!ityaRegex.test(testWord)) throw new Error(`i-tyaの音韻規則に違反: [${root}]`);
  const vowelCount = (testWord.match(/[aiu]/g) || []).length;
  if (vowelCount <= 1) throw new Error(`レベル1の単語を作ったよ！: [${root}]`);
}

// ─────────────────────────────────────────────
//  i-tya独自ソート
// ─────────────────────────────────────────────
const ityaOrder = { 'a': 1, 'i': 2, 'u': 3, 'h': 4, 'k': 5, 'l': 6, 'm': 7, 'n': 8, 'p': 9, 's': 10, 't': 11, 'w': 12, 'y': 13 };

function sortItyaWords(a, b) {
  const wordA = (a.word || '').toLowerCase();
  const wordB = (b.word || '').toLowerCase();
  const len = Math.min(wordA.length, wordB.length);
  for (let i = 0; i < len; i++) {
    const wa = ityaOrder[wordA[i]] || 99;
    const wb = ityaOrder[wordB[i]] || 99;
    if (wa !== wb) return wa - wb;
  }
  return wordA.length - wordB.length;
}

// ─────────────────────────────────────────────
//  ルート定義
// ─────────────────────────────────────────────

// 管理者認証
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(403).json({ ok: false });
  }
});

// トリビア取得
app.get('/api/trivias', async (req, res) => {
  try {
    await ensureTriviaCache();
    if (memCache.trivias.length > 0) return res.json(memCache.trivias);
    return res.json(['i-tyaは、日常生活における迅速な意思疎通を最優先に設計された言語です。']);
  } catch (error) {
    console.error('[/api/trivias]', error);
    res.status(500).json({ error: error.message });
  }
});

// トリビア追加
app.post('/api/trivias', async (req, res) => {
  const { content, password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'NO権限！' });
  try {
    await db.collection('itya_trivia').add({ content, createdAt: new Date() });
    if (content) { memCache.trivias.push(content); saveCacheFile(); }
    res.json({ message: 'トリビア追加（笑）' });
  } catch (error) {
    console.error('[POST /api/trivias]', error);
    res.status(500).json({ error: error.message });
  }
});

// 単語生成
app.post('/api/generate', async (req, res) => {
  const { concept } = req.body;
  if (!concept) return res.status(400).json({ status: 'invalid', reason: '入力が空か、無効な単語です！' });

  try {
    console.log(`[/api/generate] '${concept}' の単語を検索中`);
    await ensureCache();

    // キャッシュヒット
    const cached = findInCacheByConceptJa(concept);
    if (cached) {
      if (cached.type === 'word') {
        const w = cached.data;
        console.log(`[/api/generate] キャッシュヒット（単語）: ${w.word_noun} (ID: ${w.id})`);
        return res.json({
          status: 'existing', id: w.id,
          data: { noun: w.word_noun, verb: w.word_verb, extender: w.word_extender },
          meaning_noun: w.meaning_noun || '', meaning_verb: w.meaning_verb || '', meaning_extender: w.meaning_extender || '',
          reason: w.reason || '既存の単語です。',
          reason_noun: w.reason_noun || w.reason || '解説がありません。',
          reason_verb: w.reason_verb || w.reason || '解説がありません。',
          reason_extender: w.reason_extender || w.reason || '解説がありません。'
        });
      }
      if (cached.type === 'complex') {
        const c = cached.data;
        console.log(`[/api/generate] キャッシュヒット（複合語）: ${c.combination} (ID: ${c.id})`);
        return res.json({
          status: 'complexed', id: c.id,
          meaning: c.concept_ja, combination: c.combination,
          complexity_type: c.complexity_type || 'semantic',
          components: c.components || [],
          syntax_logic: c.syntax_logic,
          reason: c.reason || '過去に生成された複合概念です。'
        });
      }
    }

    // インフライト（並走リクエスト）
    if (inflightGenerate.has(concept)) {
      console.log(`[/api/generate] '${concept}' は生成中。結果を待ちます...`);
      return res.json(await inflightGenerate.get(concept));
    }

    const checkListStr = buildWordListStr();
    const prompt = `
概念: 「${concept}」
既存リスト: ${checkListStr}

上記のリストを必ず確認し、類似・包含される概念がすでに存在しないかを最優先で精査しなさい。
絶対にルールとJSONフォーマットに従い出力すること。`;

    const generationPromise = (async () => {
      const aiRes = await callAIWithRetry(generateModel, prompt);

      // AIが既存と判断した場合
      if (aiRes.status === 'existing' && aiRes['root_word.2']) {
        const found = findInCacheByRoot(aiRes['root_word.2']);
        if (found) {
          return {
            status: 'existing', id: found.id, meaning: found.concept_ja,
            data: { noun: found.word_noun, verb: found.word_verb, extender: found.word_extender },
            meaning_noun: found.meaning_noun || '', meaning_verb: found.meaning_verb || '', meaning_extender: found.meaning_extender || '',
            reason_noun: found.reason_noun || found.reason || '解説がありません。',
            reason_verb: found.reason_verb || found.reason || '解説がありません。',
            reason_extender: found.reason_extender || found.reason || '解説がありません。'
          };
        }
      }

      // Firebaseへ書き込み
      const batch = db.batch();

      if (aiRes.status === 'new') {
        validateRoot(aiRes.root);
        const newDoc = db.collection('itya_words').doc();
        const wordData = {
          concept_ja: concept,
          meaning_noun: aiRes.meaning_noun || '', meaning_verb: aiRes.meaning_verb || '', meaning_extender: aiRes.meaning_extender || '',
          word_noun: aiRes.root + 'a', word_verb: aiRes.root + 'i', word_extender: aiRes.root + 'u',
          reason: aiRes.reason, reason_noun: aiRes.reason_noun || '', reason_verb: aiRes.reason_verb || '', reason_extender: aiRes.reason_extender || '',
          level: 2, created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(newDoc, wordData);
        addWordToCache(`tmp_${Date.now()}`, wordData);

      } else if (aiRes.status === 'complexed') {
        const newComplex = db.collection('itya_complex').doc();
        const complexData = {
          concept_ja: concept, meaning: concept,
          combination: aiRes.combination, complexity_type: aiRes.complexity_type,
          components: aiRes.components, syntax_logic: aiRes.syntax_logic,
          reason: aiRes.reason, created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(newComplex, complexData);
        addComplexToCache(`tmp_${Date.now()}`, complexData);

      } else if (aiRes.status === 'semi_complexed') {
        if (Array.isArray(aiRes.words)) {
          for (const w of aiRes.words) {
            if (w.status === 'new') {
              validateRoot(w.root);
              const partDoc = db.collection('itya_words').doc();
              const partData = {
                concept_ja: w.meaning || `(Part of ${concept})`,
                meaning: w.meaning || `(Part of ${concept})`,
                word_noun: w.root + 'a', word_verb: w.root + 'i', word_extender: w.root + 'u',
                reason: w.reason || '複合語の構成要素として生成',
                level: 2, created_at: admin.firestore.FieldValue.serverTimestamp()
              };
              batch.set(partDoc, partData);
              addWordToCache(`tmp_${Date.now()}_${w.root}`, partData);
            }
          }
        }
        const newComplex = db.collection('itya_complex').doc();
        const semiData = {
          concept_ja: concept, meaning: concept,
          combination: aiRes.combination, words: aiRes.words,
          reason: aiRes.reason, created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(newComplex, semiData);
        addComplexToCache(`tmp_${Date.now()}`, semiData);
      }

      if (aiRes.trivia) {
        const triviaDoc = db.collection('itya_trivia').doc();
        batch.set(triviaDoc, { content: aiRes.trivia, created_at: admin.firestore.FieldValue.serverTimestamp() });
        memCache.trivias.push(aiRes.trivia);
      }

      await batch.commit();
      return aiRes;
    })();

    inflightGenerate.set(concept, generationPromise);
    try {
      res.json(await generationPromise);
    } finally {
      inflightGenerate.delete(concept);
    }

  } catch (error) {
    inflightGenerate.delete(concept);
    console.error('[/api/generate] エラー:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 翻訳
app.post('/api/translate', async (req, res) => {
  const { sentence } = req.body;
  if (!sentence) return res.status(400).json({ error: '文章が空！' });

  try {
    await ensureCache();

    if (inflightTranslate.has(sentence)) {
      console.log('[/api/translate] 並走検出。結果を待ちます...');
      return res.json(await inflightTranslate.get(sentence));
    }

    const translationPromise = (async () => {
      const checkListStr = buildWordListStr();
      const prompt = `
文章: 「${sentence}」
既存リスト: ${checkListStr}
上記リストを最大限活用し、翻訳せよ。
      `;

      const parsed = await callAIWithRetry(translateModel, prompt);

      const batch = db.batch();
      let hasNewWords = false;

      for (const item of parsed.breakdown || []) {
        if (item.status === 'new' && item.root) {
          try {
            validateRoot(item.root);
            const alreadyExists = memCache.words.find(w =>
              w.concept_ja === item.japanese || w.word_noun === item.root + 'a'
            );
            if (alreadyExists) {
              console.log(`[/api/translate] 新語スキップ（重複）: ${item.root}`);
              continue;
            }
            const newDoc = db.collection('itya_words').doc();
            const wordData = {
              concept_ja: item.japanese,
              meaning_noun: item.meaning_noun || '', meaning_verb: item.meaning_verb || '', meaning_extender: item.meaning_extender || '',
              word_noun: item.root + 'a', word_verb: item.root + 'i', word_extender: item.root + 'u',
              reason_noun: item.reason_noun || '', reason_verb: item.reason_verb || '', reason_extender: item.reason_extender || '',
              level: 2, created_at: admin.firestore.FieldValue.serverTimestamp()
            };
            batch.set(newDoc, wordData);
            addWordToCache(newDoc.id, wordData);
            hasNewWords = true;
          } catch (e) {
            console.warn(`[/api/translate] 語幹エラー: ${item.root} - ${e.message}`);
          }
        }
      }

      if (hasNewWords) await batch.commit();
      return parsed;
    })();

    inflightTranslate.set(sentence, translationPromise);
    try {
      res.json(await translationPromise);
    } finally {
      inflightTranslate.delete(sentence);
    }

  } catch (error) {
    inflightTranslate.delete(sentence);
    console.error('[/api/translate] エラー:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 辞書一覧
app.get('/api/dictionary', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const letter = (req.query.letter || req.query.search || '').toLowerCase();

    await ensureCache();

    let allEntries = buildDictionaryEntries();
    if (letter && letter !== 'all') {
      allEntries = allEntries.filter(e => e.word.toLowerCase().startsWith(letter));
    }
    allEntries.sort(sortItyaWords);

    const startIndex = (page - 1) * limit;
    const paginatedWords = allEntries.slice(startIndex, startIndex + limit);
    const total = buildDictionaryEntries().length;

    res.json({ words: paginatedWords, hasMore: startIndex + limit < allEntries.length, total });
  } catch (error) {
    console.error('[/api/dictionary] エラー:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 単語編集
app.put('/api/words/:wordId', async (req, res) => {
  const { wordId } = req.params;
  const { password, meaning, reason } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: '権限がねえぞ！' });

  try {
    let docRef = db.collection('itya_words').doc(wordId);
    let doc = await docRef.get();
    if (doc.exists) {
      await docRef.update({ concept_ja: meaning, reason, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      docRef = db.collection('itya_complex').doc(wordId);
      doc = await docRef.get();
      if (doc.exists) {
        await docRef.update({ concept_ja: meaning, reason, updated_at: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        return res.status(404).json({ error: '該当する単語が見つからねえ！' });
      }
    }
    const target = memCache.words.find(w => w.id === wordId) || memCache.complex.find(c => c.id === wordId);
    if (target) { target.concept_ja = meaning; target.reason = reason; saveCacheFile(); }
    res.json({ message: '更新成功だ！' });
  } catch (error) {
    console.error('[PUT /api/words]', error);
    res.status(500).json({ error: error.message });
  }
});

// 単語削除
app.delete('/api/words/:wordId', async (req, res) => {
  const { wordId } = req.params;
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'お前に消す権限はねえ！' });

  try {
    let docRef = db.collection('itya_words').doc(wordId);
    let doc = await docRef.get();
    if (doc.exists) {
      await docRef.delete();
    } else {
      docRef = db.collection('itya_complex').doc(wordId);
      doc = await docRef.get();
      if (doc.exists) {
        await docRef.delete();
      } else {
        return res.status(404).json({ error: '消す単語が見つからねえ！' });
      }
    }
    removeFromCache(wordId);
    res.json({ message: 'データベースから抹消したぜ！' });
  } catch (error) {
    console.error('[DELETE /api/words]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
//  サーバー起動
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`i-tya dictionary is running on port ${PORT}`);
});