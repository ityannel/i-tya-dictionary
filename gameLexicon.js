// Meanings of the words that appear in the game's own story and wordbook (hapo, aisklitt, ...).
// Used ONLY to label wordbook cards. It does not decide what the AI may say: that is the
// dictionary (see "Game endpoints" in server.js). Only well-supported meanings are listed.
// Source: hate-i-tya-wordlist.csv (to be confirmed by the author).

const GAME_LEXICON = [
  { word: 'oi',       ja: 'はい／やあ' },
  { word: 'ieoi',     ja: 'いいえ' },
  { word: 'yu',       ja: 'あなた' },
  { word: 'mi',       ja: '私' },
  { word: 'ge',       ja: 'これ／この' },
  { word: 'hate',     ja: '何（疑問）' },
  { word: 'un',       ja: '〜は〜だ' },
  { word: 'und',      ja: '〜と／そして' },
  { word: 'ba',       ja: 'それから／〜のあと' },
  { word: 'ten',      ja: 'ある・いる' },
  { word: 'tend',     ja: '行く・進む' },
  { word: 'pon',      ja: '押す・クリックする' },
  { word: 'zin',      ja: '見る・見つける・分かる' },
  { word: 'shin',     ja: '知る' },
  { word: 'mokun',    ja: '食べる' },
  { word: 'petan',    ja: '話す' },
  { word: 'yanya',    ja: '正しい・よい・正解' },
  { word: 'hapo',     ja: '村' },
  { word: 'mokuno',   ja: '食べ物の店・食堂' },
  { word: 'aisklitt', ja: 'アイスクリーム' },
  { word: 'tiyao',    ja: 'お金' },
  { word: 'i-tya',    ja: 'この言語（i-tya語）' },
  { word: 'sunya-iesunya', ja: 'クイズ' },
];

module.exports = { GAME_LEXICON };
