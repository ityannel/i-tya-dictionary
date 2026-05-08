const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function importWords() {
  const words = JSON.parse(fs.readFileSync('words_to_import.json', 'utf8'));
  const batch = db.batch();
  const collectionRef = db.collection('itya_words');

  console.log(`🚀 ${words.length}個の単語を新フォーマットでインポート/更新するわよ！`);

  for (const word of words) {
    const docData = {
      ...word,
      word_noun: word.root + 'a',
      word_verb: word.root + 'i',
      word_extender: word.root + 'u',
      level: word.tier,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // concept_ja で既存チェック
    const snapshot = await collectionRef.where('concept_ja', '==', word.concept_ja).get();

    if (!snapshot.empty) {
      console.log(`♻️ 更新中: ${word.concept_ja}`);
      batch.update(snapshot.docs[0].ref, docData);
    } else {
      console.log(`✨ 新規登録: ${word.concept_ja}`);
      const newDoc = collectionRef.doc();
      batch.set(newDoc, {
        ...docData,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  await batch.commit();
  console.log("✅ 聖域の更新、完了したわよ！あんた、これで文句ないでしょ？");
}

importWords().catch(err => {
  console.error("❌ エラーよ！何やってんのよ！:", err);
});