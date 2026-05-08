const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function updateTiers() {
  const wordsSnap = await db.collection('itya_words').get();
  const batch = db.batch();
  let count = 0;

  wordsSnap.forEach(doc => {
    const data = doc.data();
    // 活用形（名詞・動詞・拡張詞）のいずれかから音節数を計算
    const baseWord = data.word_noun || data.word_verb || data.word_extender || "";
    if (baseWord) {
      // i-tyaの音節は母音(a, i, u)の数で決まる
      const syllableCount = (baseWord.match(/[aiu]/g) || []).length;
      
      batch.update(doc.ref, { 
        // 古いlevelフィールドは紛らわしいから消すか、tierと同じにしとけ
        level: syllableCount 
      });
      count++;
    }
  });

  await batch.commit();
  console.log(`[SUCCESS] ${count}個の単語のtierを更新したわよ！`);
}

updateTiers().catch(console.error);