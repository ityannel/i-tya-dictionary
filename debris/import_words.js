const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function importWords() {
  const words = JSON.parse(fs.readFileSync('debris/words_to_import.json', 'utf8'));
  const collectionRef = db.collection('itya_words');

  console.log(`🚀 ${words.length}個の単語を語幹（root）ベースで洗浄・インポートするわよ！`);

  // 1. まず、今回のリストに含まれる語幹（root）を持つ既存のLv1データを全消去する
  // (ma, muのようにrootが同じでも、この一括消去で過去の統合データを確実に葬れるぜ)
  const uniqueRoots = [...new Set(words.map(w => w.root))];
  
  for (const r of uniqueRoots) {
    const oldDocs = await collectionRef.where('root', '==', r).where('level', '==', 1).get();
    if (!oldDocs.empty) {
      const deleteBatch = db.batch();
      oldDocs.forEach(doc => {
        console.log(`🗑️ 古い語幹データを削除: ${r} (ID: ${doc.id})`);
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();
    }
  }

  // 2. 新しい独立したデータを一気に流し込む
  const importBatch = db.batch();
  words.forEach(word => {
    const newDoc = collectionRef.doc();
    console.log(`✨ 新規登録: ${word.concept_ja} (root: ${word.root})`);
    importBatch.set(newDoc, {
      ...word,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await importBatch.commit();
  console.log("✅ 聖域（レベル1）の語幹ベース・クリーンインポートが完了したわ！");
}

importWords().catch(err => {
  console.error("❌ エラーよ！何やってんの！:", err);
});