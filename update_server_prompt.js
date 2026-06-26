const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(targetPath, 'utf8');

const oldPrompt = `【出力フォーマット】
{
  "status": "new",
  "root": "生成した語幹(末尾母音を含まない)",
  "meaning_noun": "名詞としての意味",
  "meaning_verb": "動詞としての意味",
  "meaning_extender": "拡張詞としての意味",
  "reason": "語幹全体の由来や概念の解説を詳しく記述（なぜこの音韻構成にしたのかなど）",
  "reason_noun": "名詞としての用法の詳細解説",
  "reason_verb": "動詞としての用法の詳細解説",
  "reason_extender": "拡張詞としての用法の詳細解説",
  "part_of_speech": "noun",
  "trivia": "この概念に関する興味深いトリビアや文化的な背景"
}`;

const newPrompt = `【出力フォーマット】
{
  "status": "new",
  "meaning_noun": "名詞としての意味",
  "reason_noun": "名詞としての用法の詳細解説",
  "reason": "語幹全体の由来や概念の解説を詳しく記述（なぜこの音韻構成にしたのかなど）",
  "root": "生成した語幹(末尾母音を含まない)",
  "meaning_verb": "動詞としての意味",
  "meaning_extender": "拡張詞としての意味",
  "reason_verb": "動詞としての用法の詳細解説",
  "reason_extender": "拡張詞としての用法の詳細解説",
  "part_of_speech": "noun",
  "trivia": "この概念に関する興味深いトリビアや文化的な背景"
}`;

content = content.replace(oldPrompt, newPrompt);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('server.js prompt updated.');
