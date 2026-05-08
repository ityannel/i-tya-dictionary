const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Firebase初期化
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// --delete フラグがなければドライラン
const DRY_RUN = !process.argv.includes('--delete');

// ─── 音韻バリデーション ───
const ityaRegex = /^(?:[hklmnpst]?[wy]?[aiu])+$/;

function validateWord(word) {
  if (!word) return 'empty';
  const w = word.toLowerCase().trim();
  if (!/[aiu]$/.test(w)) return `語尾が母音でない: [${word}]`;
  if (!ityaRegex.test(w)) return `音韻規則違反: [${word}]`;
  if ((w.match(/[aiu]/g) || []).length <= 1) return `Lv1単語（音節数不足）: [${word}]`;
  return null;
}

function classifyWord(doc) {
  const d = doc.data();
  const issues = [];

  // 音韻違反チェック
  ['word_noun', 'word_verb', 'word_extender'].forEach(field => {
    if (d[field]) {
      const err = validateWord(d[field]);
      if (err) issues.push({ type: 'phonology', field, error: err });
    }
  });

  // 詞型欠落チェック
  if (!d.word_noun) issues.push({ type: 'missing_form', field: 'word_noun' });
  if (!d.word_verb) issues.push({ type: 'missing_form', field: 'word_verb' });
  if (!d.word_extender) issues.push({ type: 'missing_form', field: 'word_extender' });

  // 説明欠落チェック
  if (!d.reason_noun?.trim()) issues.push({ type: 'missing_reason', field: 'reason_noun' });
  if (!d.reason_verb?.trim()) issues.push({ type: 'missing_reason', field: 'reason_verb' });
  if (!d.reason_extender?.trim()) issues.push({ type: 'missing_reason', field: 'reason_extender' });

  return issues;
}

// ─── メイン ───
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('i-tya 単語削除スクリプト');
  console.log(DRY_RUN ? '【ドライラン】削除は行いません' : '【削除モード】Firestoreからデータを消去します');
  console.log('='.repeat(60) + '\n');

  const snap = await db.collection('itya_words').get();
  console.log(`itya_words: ${snap.size}件をスキャン中...\n`);

  const targets = [];
  snap.docs.forEach(doc => {
    const issues = classifyWord(doc);
    if (issues.length > 0) targets.push({ doc, issues });
  });

  if (targets.length === 0) {
    console.log('✅ 削除対象の単語は見つかりませんでした。');
    process.exit(0);
  }

  console.log(`削除対象: ${targets.length} 件\n`);
  targets.forEach(({ doc, issues }) => {
    const d = doc.data();
    console.log(`  [${doc.id}] 「${d.concept_ja || '(不明)'}」`);
    console.log(`    noun:${d.word_noun || '-'}  verb:${d.word_verb || '-'}  ext:${d.word_extender || '-'}`);
    issues.forEach(i => console.log(`    ⚠️  ${i.type}: ${i.field}${i.error ? ' → ' + i.error : ''}`));
    console.log();
  });

  if (DRY_RUN) {
    console.log(`合計 ${targets.length} 件が削除対象だ。`);
    console.log('実際に削除するには: node delete_words.js --delete\n');
    process.exit(0);
  }

  // ─── 削除実行 ───
  console.log('💥 削除を開始するぜ...\n');
  let success = 0, failed = 0;

  for (const { doc } of targets) {
    const d = doc.data();
    const concept = d.concept_ja || '(不明)';
    process.stdout.write(`  削除中: 「${concept}」... `);

    try {
      // 修復じゃなく、ドキュメントそのものを削除
      await db.collection('itya_words').doc(doc.id).delete();
      console.log(`✅ 削除完了`);
      success++;
    } catch (err) {
      console.log(`❌ 失敗: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`完了: 削除成功 ${success} 件 / 失敗 ${failed} 件`);
  process.exit(0);
}

main().catch(err => {
  console.error('致命的エラー:', err);
  process.exit(1);
});