const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const normalizeText = (text = '') => {
  const safe = text ?? '';
  return safe
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
};

const tokenize = (text = '') => {
  const normalized = normalizeText(text ?? '');
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 2 && token.length < 40);
};

const buildSearchTokens = (title, content, tags = [], authorName = '') => {
  const set = new Set();
  tokenize(title).forEach((t) => set.add(t));
  tokenize(content).forEach((t) => set.add(t));
  tokenize(authorName).forEach((t) => set.add(t));
  (Array.isArray(tags) ? tags : [])
    .flatMap((tag) => tokenize(tag))
    .forEach((t) => set.add(t));
  return Array.from(set);
};

async function updateSearchTokens() {
  console.log('🔍 Actualizando searchTokens...\n');

  try {
    const snapshot = await db.collection('publications').get();
    console.log(`📊 Total: ${snapshot.size} publicaciones\n`);

    let updated = 0;
    let skipped = 0;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const title = data.title || data.titulo || '';
      const content = data.content || data.descripcion || '';
      const tags = data.tags || [];
      const authorName = data.creatorInfo?.nombre || data.authorName || '';

      if (!authorName) {
        skipped++;
        continue;
      }

      const newSearchTokens = buildSearchTokens(title, content, tags, authorName);
      batch.update(doc.ref, { searchTokens: newSearchTokens });
      batchCount++;
      updated++;

      console.log(`✅ ${authorName} - "${title.substring(0, 40)}"`);

      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`\n✨ Completado: ${updated} actualizadas, ${skipped} omitidas`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

updateSearchTokens();
