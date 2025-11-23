const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function clearSessionSummaries() {
  try {
    console.log('🧹 Iniciando limpieza de sessionSummaries...');
    
    const summariesRef = db.collection('sessionSummaries');
    const snapshot = await summariesRef.get();
    
    if (snapshot.empty) {
      console.log('✅ No hay resúmenes para eliminar');
      process.exit(0);
    }
    
    console.log(`📊 Encontrados ${snapshot.size} resúmenes`);
    
    const batch = db.batch();
    let count = 0;
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });
    
    await batch.commit();
    
    console.log(`✅ Eliminados ${count} resúmenes exitosamente`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al limpiar resúmenes:', error);
    process.exit(1);
  }
}

clearSessionSummaries();
