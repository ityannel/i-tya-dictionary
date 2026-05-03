const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const CACHE_FILE = path.join(__dirname, 'cache.json');
const CACHE_TTL = 12 * 60 * 60 * 1000;   // 12 hours
const TRIVIA_TTL = 60 * 60 * 1000;        // 1 hour
const AI_MODEL = "gemini-3.1-flash-lite-preview";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "itya!";

// ─────────────────────────────────────────────
//  Two-layer cache
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
    console.log('[CACHE] Saved to cache.json');
  } catch (e) {
    console.warn('[CACHE] Failed to save cache.json:', e.message);
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
        console.log(`[CACHE] Restored from cache.json (${memCache.words.length} words, ${memCache.complex.length} complex, ${Math.round(age / 60000)} min elapsed)`);
        return true;
      } else {
        console.log('[CACHE] cache.json is stale, ignoring (TTL exceeded)');
      }
    }
  } catch (e) {
    console.warn('[CACHE] Failed to load cache.json:', e.message);
  }
  return false;
}

async function refreshCacheFromFirebase() {
  console.log('[CACHE] Fetching all data from Firebase...');
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
  console.log(`[CACHE] Fetch complete: ${memCache.words.length} words, ${memCache.complex.length} complex`);
}

let refreshingPromise = null;
async function ensureCache() {
  if (memCache.loadedAt > 0 && (Date.now() - memCache.loadedAt) < CACHE_TTL) return;
  if (refreshingPromise) return refreshingPromise;
  refreshingPromise = refreshCacheFromFirebase().finally(() => { refreshingPromise = null; });
  return refreshingPromise;
}

async function ensureTriviaCache() {
  if (memCache.triviaLoadedAt > 0 && (Date.now() - memCache.triviaLoadedAt) < TRIVIA_TTL) return;
  const snap = await db.collection('itya_trivia').limit(100).get();
  memCache.trivias = snap.docs.map(d => d.data().content).filter(Boolean);
  memCache.triviaLoadedAt = Date.now();
  saveCacheFile();
}

// ─────────────────────────────────────────────
//  Cache utilities
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
    const forms = [
      w.word_noun     ? `${w.word_noun}(名)` : '',
      w.word_verb     ? `${w.word_verb}(動)` : '',
      w.word_extender ? `${w.word_extender}(拡)` : ''
    ].filter(Boolean).join('/');
    if (!forms) return '';
    return `${w.concept_ja || w.meaning}: ${forms}`;
  }).filter(Boolean).join(', ');
}

function buildDictionaryEntries() {
  const words = memCache.words
    .filter(w => w.word_noun || w.word_verb || w.word_extender)
    .map(w => {
      const base = w.word_noun || w.word_verb || w.word_extender;
      // root = strip trailing vowel (keep as-is if single char)
      const root = base.length <= 1 ? base : base.slice(0, -1);
      return {
        id: w.id,
        type: 'word',
        word: base,
        root,            // e.g. "pat" → displayed as "pat-"
        meaning: w.concept_ja || 'Unknown',
        fullData: w
      };
    });
  const complex = memCache.complex
    .filter(c => c.combination)
    .map(c => ({
      id: c.id,
      type: 'complex',
      word: c.combination,
      root: null,        // no root for complex words
      meaning: c.concept_ja || 'Unknown',
      fullData: c
    }));
  return [...words, ...complex];
}

// ─────────────────────────────────────────────
//  Initialize cache on startup
// ─────────────────────────────────────────────
loadCacheFile();

// ─────────────────────────────────────────────
//  In-flight map (deduplication)
// ─────────────────────────────────────────────
const inflightGenerate = new Map();
const inflightTranslate = new Map();

// ─────────────────────────────────────────────
//  Firebase initialization
// ─────────────────────────────────────────────
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ─────────────────────────────────────────────
//  Middleware (registered once)
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
//  AI setup
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
11. 【絶対禁止】"complexed"および"semi_complexed"の"combination"フィールドに語幹（root）をそのまま出力することは絶対に禁止。combinationには必ず語尾母音（-a/-i/-u）を付けた完成形の単語を使うこと。例：語幹「num」「hak」→ 名詞「numu」「haka」として出力。

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
  "combination": "新語群と既存語を組み合わせた完成フレーズ(例: pata haliu mu)【重要】各単語は必ず語尾の母音（-a/-i/-u）を付けた完成形で出力すること。語幹（root）のまま出力することは絶対禁止。",
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
  "combination": "（既存単語と拡張詞を組み合わせた具体的表現。かならず一つの表現のみ書くこと。カンマで区切ったり、括弧付けでの日本語の解説は全く持って不要です。）【重要】各単語は必ず語尾の母音（-a/-i/-u）を付けた完成形で出力すること。語幹（root）のまま出力することは絶対禁止。例：「num hak」ではなく「numu haka」のように。",
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
  "status": "existing",
  "part_of_speech_word.2": "noun | verb | extender（ユーザーの入力に合わせて、いずれかを選び、その型をそのまま出力すること）",
  "root_word.2": "（既存の語幹）"
}

5. Unknown・文章・そのほかのルール違反で生成を拒否する場合:

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

【絶対禁止】"translation"フィールドおよび"itya"フィールドに語幹（root）をそのまま出力することは絶対に禁止。
必ず語尾母音（-a/-i/-u）を付けた完成形の単語のみを出力すること。いかなる単語も子音で終わってはならない。
例：語幹「was」→ 名詞「wasa」、動詞「wasi」、拡張詞「wasu」として出力。

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
      "reason_noun": "新語の場合のみ。以下フォーマットで2文以上記述せよ: 【意味】\n（名詞としての意味）\n\n【詞型の展開】\n（名詞の場合の使われ方）\n\n【語源・由来】\n（由来・音の選択理由）",
      "reason_verb": "新語の場合のみ。以下フォーマットで2文以上記述せよ: 【意味】\n（動詞としての意味）\n\n【詞型の展開】\n（動詞の場合の使われ方）",
      "reason_extender": "新語の場合のみ。以下フォーマットで2文以上記述せよ: 【意味】\n（拡張詞としての意味）\n\n【詞型の展開】\n（拡張詞の場合の使われ方）"
    }
  ]
}
`;

const reverseTranslateRules = `
あなたはi-tya言語の逆翻訳コンパイラだ。i-tya語の文章を日本語に翻訳し、JSONのみ出力せよ。

【最重要ルール】
1. 渡された辞書に存在しない単語は、絶対に意味を捏造するな。"unknown"としてそのままi-tya語を返せ。
2. 辞書に存在する単語のみ日本語に訳せ。
3. 語末の母音（-a=名詞、-i=動詞、-u=拡張詞）で品詞を判定し、自然な日本語に変換せよ。

【i-tya基本ルール（解読用）】
品詞: -a=名詞、-i=動詞、-u=拡張詞。
時制・助詞: nu=完了/過去、hu=否定、nyu=疑問、ku=～へ、mu=～から/の、su=～で/に、tu=手段
接続: pu=そして、pyu=または、syu=だから、yu=もし
人称: ma=私、pa=あなた、na=彼/彼女/それ
指示: sa=これ、la=あれ
場所: wa=空間/場所、ya=事実、swa=言葉/記号
時間: pwa=前/過去、mwa=後/未来
その他: myu=進行中、kyu=複数、lu=数字prefix

【語順】SV型。後置修飾。

【出力フォーマット】
{
  "translation": "日本語訳。辞書にない単語は「(tit)」のようにi-tya語をそのまま括弧で残せ。",
  "breakdown": [
    {
      "itya": "i-tya語の要素",
      "japanese": "対応する日本語。辞書にない場合は「(未登録)」",
      "role": "品詞・機能の説明",
      "status": "known | unknown | grammar"
    }
  ]
}
`;

const generateModel = genAI.getGenerativeModel({ model: AI_MODEL, systemInstruction: ityaRules });
const translateModel = genAI.getGenerativeModel({ model: AI_MODEL, systemInstruction: translateRules });
const reverseTranslateModel = genAI.getGenerativeModel({ model: AI_MODEL, systemInstruction: reverseTranslateRules });

async function callAIWithRetry(model, prompt, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] Attempt ${attempt}/${maxRetries}`);
      const result = await model.generateContent(prompt);
      const rawText = result.response.text().replace(/```json|```/g, '').trim();
      console.log(`[AI] Response received (${rawText.length} chars)`);
      const sanitized = rawText.replace(
        /"((?:[^"\\]|\\.)*)"/g,
        (m, inner) => '"' + inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"'
      );
      const parsed = JSON.parse(sanitized);
      if (parsed.root) parsed.root = parsed.root.toLowerCase();
      if (parsed.status === 'new') validateRoot(parsed.root);
      return parsed;
    } catch (err) {
      lastError = err;
      // 生のエラーを必ずログに出す
      console.error(`[AI] Attempt${attempt} failed - ${err.constructor.name}: ${err.message}`);
      if (err.status) console.error(`[AI] HTTP status: ${err.status}`);

      // JSONパース or 語幹バリデーションエラーのみリトライ
      const isRetryable = err instanceof SyntaxError || err.message.includes('語幹') || err.message.includes('音韻') || err.message.includes('レベル1') || err.message.includes('語幹が空');
      // APIエラー（429/5xx等）はリトライせず即投げ
      if (!isRetryable || attempt >= maxRetries) throw err;
      console.warn(`[AI] Validation error. Retrying...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────
function validateRoot(root) {
  if (!root) throw new Error('Root is empty.');
  const normalizedRoot = root.toLowerCase();
  if (/\s/.test(normalizedRoot)) throw new Error(`Root contains whitespace: [${root}]`);
  if (/[aiu]$/.test(normalizedRoot)) throw new Error(`Root ends with a vowel: [${root}]`);
  const testWord = normalizedRoot + 'a';
  const ityaRegex = /^(?:[hklmnpst]?[wy]?[aiu])+$/;
  if (!ityaRegex.test(testWord)) throw new Error(`Violates i-tya phonological rules: [${root}]`);
  const vowelCount = (testWord.match(/[aiu]/g) || []).length;
  if (vowelCount <= 1) throw new Error(`Generated a level-1 word: [${root}]`);
}

// ─────────────────────────────────────────────
//  i-tya custom sort
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
//  Route definitions
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
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });
  try {
    await db.collection('itya_trivia').add({ content, createdAt: new Date() });
    if (content) { memCache.trivias.push(content); saveCacheFile(); }
    res.json({ message: 'Trivia added.' });
  } catch (error) {
    console.error('[POST /api/trivias] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 単語生成
app.post('/api/generate', async (req, res) => {
  const { concept } = req.body;
  if (!concept) return res.status(400).json({ status: 'invalid', reason: 'Input is empty or invalid.' });

  try {
    console.log(`[/api/generate] '${concept}' - searching`);
    await ensureCache();

    // キャッシュヒット
    const cached = findInCacheByConceptJa(concept);
    if (cached) {
      if (cached.type === 'word') {
        const w = cached.data;
        console.log(`[/api/generate] Cache hit (word): ${w.word_noun} (ID: ${w.id})`);
        return res.json({
          status: 'existing', id: w.id,
          data: { noun: w.word_noun, verb: w.word_verb, extender: w.word_extender },
          meaning_noun: w.meaning_noun || '', meaning_verb: w.meaning_verb || '', meaning_extender: w.meaning_extender || '',
          reason: w.reason || 'This word already exists.',
          reason_noun: w.reason_noun || w.reason || 'No description available.',
          reason_verb: w.reason_verb || w.reason || 'No description available.',
          reason_extender: w.reason_extender || w.reason || 'No description available.'
        });
      }
      if (cached.type === 'complex') {
        const c = cached.data;
        console.log(`[/api/generate] Cache hit (complex): ${c.combination} (ID: ${c.id})`);
        return res.json({
          status: 'complexed', id: c.id,
          meaning: c.concept_ja, combination: c.combination,
          complexity_type: c.complexity_type || 'semantic',
          components: c.components || [],
          syntax_logic: c.syntax_logic,
          reason: c.reason || 'A previously generated complex concept.'
        });
      }
    }

    // インフライト（並走リクエスト）
    if (inflightGenerate.has(concept)) {
      console.log(`[/api/generate] '${concept}' - already generating, waiting...`);
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
            reason_noun: found.reason_noun || found.reason || 'No description available.',
            reason_verb: found.reason_verb || found.reason || 'No description available.',
            reason_extender: found.reason_extender || found.reason || 'No description available.'
          };
        }
      }

      // Write to Firebase
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
                reason: w.reason || 'Generated as a component of a complex word.',
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
    console.error('[/api/generate] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 翻訳
app.post('/api/translate', async (req, res) => {
  const { sentence } = req.body;
  if (!sentence) return res.status(400).json({ error: 'Sentence is empty.' });

  try {
    await ensureCache();

    if (inflightTranslate.has(sentence)) {
      console.log('[/api/translate] Duplicate request detected, waiting...');
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
              console.log(`[/api/translate] Skipping duplicate new word: ${item.root}`);
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
            console.warn(`[/api/translate] Root validation error: ${item.root} - ${e.message}`);
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
    console.error('[/api/translate] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 逆引き（i-tya語 → 日本語）
app.post('/api/reverse', async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'Word is empty.' });

  try {
    await ensureCache();

    const w = word.trim().toLowerCase();
    // 語末の母音で品詞判定
    const lastChar = w.slice(-1);
    const posMap = { 'a': 'noun', 'i': 'verb', 'u': 'extender' };
    const pos = posMap[lastChar] || null;

    // 完全一致検索（word_noun / word_verb / word_extender）
    let found = memCache.words.find(entry =>
      (entry.word_noun || '').toLowerCase() === w ||
      (entry.word_verb || '').toLowerCase() === w ||
      (entry.word_extender || '').toLowerCase() === w
    );

    // 複合語検索
    if (!found) {
      const complexFound = memCache.complex.find(c =>
        (c.combination || '').toLowerCase().split(/\s+/).includes(w)
      );
      if (complexFound) {
        return res.json({
          found: true,
          word: w,
          meaning: complexFound.concept_ja || complexFound.meaning || '(意味未登録)',
          pos: null,
          forms: null,
          reason: complexFound.reason || null,
          isComplex: true
        });
      }
    }

    if (found) {
      return res.json({
        found: true,
        word: w,
        meaning: found.concept_ja || found.meaning_noun || found.meaning || '(意味未登録)',
        pos,
        forms: {
          noun: found.word_noun || '-',
          verb: found.word_verb || '-',
          extender: found.word_extender || '-'
        },
        reason: (pos === 'noun' ? found.reason_noun : pos === 'verb' ? found.reason_verb : found.reason_extender) || found.reason || null
      });
    }

    // 語幹で部分一致（例: "was" → "wasa", "wasi", "wasu" を持つ語）
    const root = /[aiu]$/.test(w) ? w.slice(0, -1) : w;
    const rootFound = memCache.words.find(entry => {
      const base = entry.word_noun || entry.word_verb || entry.word_extender || '';
      return base.length > 1 && base.slice(0, -1).toLowerCase() === root;
    });
    if (rootFound) {
      return res.json({
        found: true,
        word: w,
        meaning: rootFound.concept_ja || rootFound.meaning_noun || '(意味未登録)',
        pos,
        forms: {
          noun: rootFound.word_noun || '-',
          verb: rootFound.word_verb || '-',
          extender: rootFound.word_extender || '-'
        },
        reason: rootFound.reason || null,
        note: '語幹一致'
      });
    }

    return res.json({ found: false, word: w });
  } catch (error) {
    console.error('[/api/reverse] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// i-tya文章 → 日本語逆翻訳
app.post('/api/reverse-translate', async (req, res) => {
  const { sentence } = req.body;
  if (!sentence) return res.status(400).json({ error: 'Sentence is empty.' });

  try {
    await ensureCache();
    // 辞書を「i-tya語 → 日本語」の対応表として整形
    const wordList = memCache.words
      .filter(w => w.word_noun || w.word_verb || w.word_extender)
      .map(w => {
        const forms = [
          w.word_noun ? `${w.word_noun}（名詞）` : '',
          w.word_verb ? `${w.word_verb}（動詞）` : '',
          w.word_extender ? `${w.word_extender}（拡張詞）` : ''
        ].filter(Boolean).join(' / ');
        return `${forms} → ${w.concept_ja || w.meaning_noun || w.meaning || ''}`;
      }).join('\n');

    const prompt = `以下はi-tya辞書だ。各行は「i-tya語（品詞） → 日本語の意味」の対応を示す。

【i-tya辞書】
${wordList}

【重要】この辞書に存在しない単語は意味を捏造せず、translation内では「(単語名)」の形でそのまま残し、breakdownのstatusは"unknown"とせよ。

上記の辞書を参照し、以下のi-tya文章を自然な日本語に翻訳せよ。
出力は必ずJSONのみ。翻訳文は "translation" フィールドに、語ごとの内訳は "breakdown" 配列に入れよ。

【翻訳するi-tya文章】
${sentence}`;

    const parsed = await callAIWithRetry(reverseTranslateModel, prompt);
    return res.json(parsed);
  } catch (error) {
    console.error('[/api/reverse-translate] Error:', error.message);
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

    const total = allEntries.length;
    const startIndex = (page - 1) * limit;
    const paginatedWords = allEntries.slice(startIndex, startIndex + limit);

    res.json({ words: paginatedWords, hasMore: startIndex + limit < allEntries.length, total });
  } catch (error) {
    console.error('[/api/dictionary] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 単語編集
app.put('/api/words/:wordId', async (req, res) => {
  const { wordId } = req.params;
  const { password, meaning, reason } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });

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
        return res.status(404).json({ error: 'Word not found.' });
      }
    }
    const target = memCache.words.find(w => w.id === wordId) || memCache.complex.find(c => c.id === wordId);
    if (target) { target.concept_ja = meaning; target.reason = reason; saveCacheFile(); }
    res.json({ message: 'Update successful.' });
  } catch (error) {
    console.error('[PUT /api/words] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 単語削除
app.delete('/api/words/:wordId', async (req, res) => {
  const { wordId } = req.params;
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized.' });

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
        return res.status(404).json({ error: 'Word not found.' });
      }
    }
    removeFromCache(wordId);
    res.json({ message: 'Deleted successfully.' });
  } catch (error) {
    console.error('[DELETE /api/words] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`i-tya dictionary running on port ${PORT}`);
});