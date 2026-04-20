const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function importWords() {
  const words = JSON.parse(fs.readFileSync('words_to_import.json', 'utf8'));
  const batch = db.batch();
  const collectionRef = db.collection('itya_words');

  console.log(`🚀 ${words.length}個の単語をインポートするぜ...`);

  words.forEach((word) => {
    const docRef = collectionRef.doc(); // 自動でドキュメントIDを生成
    batch.set(docRef, {
      ...word,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  console.log("✅ インポート完了だ！これで聖域（レベル1）が保護されたぜ。");
}

importWords().catch(err => {
  console.error("❌ エラー発生だ、このきちがい！:", err);
});