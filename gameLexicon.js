// Vocabulary and grammar of the in-game language of "Hate i-tya?".
// This is NOT the dictionary site's i-tya (different letters, grammar and words).
// Only entries whose meaning is well supported (confidence high/medium) are listed;
// anything uncertain is deliberately left out so the game never teaches a guess.
// Source of truth for meanings: hate-i-tya-wordlist.csv (to be confirmed by the author).

const GAME_LEXICON = [
  { word: 'oi',       ja: 'はい／やあ',           role: '返事・あいさつ' },
  { word: 'ieoi',     ja: 'いいえ',               role: '返事' },
  { word: 'yu',       ja: 'あなた',               role: '代名詞' },
  { word: 'mi',       ja: '私',                   role: '代名詞' },
  { word: 'ge',       ja: 'これ／この',           role: '指示語' },
  { word: 'hate',     ja: '何（疑問）',           role: '疑問詞' },
  { word: 'un',       ja: '〜は〜だ',             role: 'コピュラ' },
  { word: 'und',      ja: '〜と／そして',         role: '接続' },
  { word: 'ba',       ja: 'それから／〜のあと',   role: '接続' },
  { word: 'ten',      ja: 'ある・いる',           role: '存在の動詞' },
  { word: 'tend',     ja: '行く・進む',           role: '動詞' },
  { word: 'pon',      ja: '押す・クリックする',   role: '動詞' },
  { word: 'zin',      ja: '見る・見つける・分かる', role: '動詞' },
  { word: 'shin',     ja: '知る',                 role: '動詞' },
  { word: 'mokun',    ja: '食べる',               role: '動詞' },
  { word: 'petan',    ja: '話す',                 role: '動詞' },
  { word: 'yanya',    ja: '正しい・よい・正解',   role: '形容詞' },
  { word: 'hapo',     ja: '村',                   role: '名詞' },
  { word: 'mokuno',   ja: '食べ物の店・食堂',     role: '名詞' },
  { word: 'aisklitt', ja: 'アイスクリーム',       role: '名詞' },
  { word: 'tiyao',    ja: 'お金',                 role: '名詞' },
  { word: 'i-tya',    ja: 'この言語（i-tya語）',  role: '名詞' },
  { word: 'sunya-iesunya', ja: 'クイズ',          role: '名詞' },
];

// verbs that can take the negative prefix ie- (observed: ieshin, iezin, ietend, iepon, iepetan, ieten)
const NEGATABLE = ['shin', 'zin', 'tend', 'pon', 'petan', 'ten', 'mokun'];

// sentences taken from (or patterned on) the game's own text, with the scene they come from
const GAME_EXAMPLES = [
  { itya: 'Ge un hapo!',           ja: 'これは村だ！',                     src: 'scene 12' },
  { itya: 'Yu shin "hapo".',       ja: 'あなたは「hapo」を知っている。',   src: 'scene 15' },
  { itya: 'Mi mokun aisklitt!',    ja: '私はアイスクリームを食べる！',     src: 'scene 40' },
  { itya: 'Ten aisklitt!',         ja: 'アイスクリームがある！',           src: 'scene 27' },
  { itya: 'Ten mokuno?',           ja: '食堂はある？',                     src: 'scene 64' },
  { itya: 'Ba, mokun.',            ja: 'それから、食べよう。',             src: 'scene 22' },
  { itya: 'Oi!',                   ja: 'はい！／やあ！',                   src: 'scene 14' },
  { itya: 'Yanya!',                ja: 'いいね！／正解！',                 src: 'scene 66' },
  { itya: 'Mi ieshin.',            ja: '私は知らない。',                   src: '型（scene 16 の Mi ieshin …）' },
  { itya: 'Hate yu mokun?',        ja: 'あなたは何を食べる？',             src: '型（scene 38 の Hate yu mokun …）' },
];

const GRAMMAR_JA = [
  '語順は 主語 + 動詞 + 目的語（例: Mi mokun aisklitt!）。',
  '「AはBだ」は A un B（例: Ge un hapo!）。',
  '否定は動詞の前に ie を付ける（例: ieshin = 知らない）。ieshin, iezin, ietend, iepon, iepetan, ieten, iemokun。',
  '疑問は文頭に hate（例: Hate yu mokun?）、または文末に ? を付けるだけ（例: Ten mokuno?）。',
  '「〜がある」は ten + 名詞（例: Ten aisklitt!）。',
  '「と／そして」は und、「それから」は ba。',
  '返事は oi（はい）と ieoi（いいえ）。',
];

const WORDS = new Set(GAME_LEXICON.map(e => e.word));
const NEG = new Set(NEGATABLE.map(v => 'ie' + v));

function tokenize(itya) {
  return String(itya || '')
    .toLowerCase()
    .replace(/[.,!?…"'「」『』（）()。、！？~〜\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function isKnownToken(t) {
  return WORDS.has(t) || NEG.has(t);
}

// ok only if every token is in the game's vocabulary (or ie- + a negatable verb)
function validateGameSentence(itya, { maxTokens = 8 } = {}) {
  const tokens = tokenize(itya);
  if (tokens.length === 0) return { ok: false, tokens, unknown: [], reason: 'empty' };
  if (tokens.length > maxTokens) return { ok: false, tokens, unknown: [], reason: 'too_long' };
  const unknown = tokens.filter(t => !isKnownToken(t));
  return { ok: unknown.length === 0, tokens, unknown, reason: unknown.length ? 'unknown_word' : null };
}

function lexiconPromptBlock() {
  const table = GAME_LEXICON.map(e => `- ${e.word} = ${e.ja}（${e.role}）`).join('\n');
  const neg = NEGATABLE.map(v => `ie${v}`).join(', ');
  const ex = GAME_EXAMPLES.map(e => `- ${e.itya}  = ${e.ja}`).join('\n');
  return `【単語表】（この単語だけが使える。否定形: ${neg}）\n${table}\n\n【文法】\n${GRAMMAR_JA.map(g => '- ' + g).join('\n')}\n\n【ゲーム本編の実際の文の例】\n${ex}`;
}

module.exports = { GAME_LEXICON, NEGATABLE, GAME_EXAMPLES, tokenize, validateGameSentence, lexiconPromptBlock };
