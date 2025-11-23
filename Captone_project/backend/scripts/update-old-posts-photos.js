const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateOldPostsPhotos() {
  console.log('🚀 Iniciando actualización de fotos en posts antiguos...\n');

  try {
    // 1. Obtener todas las publicaciones
    const publicationsSnapshot = await db.collection('publications').get();
    console.log(`📊 Total de publicaciones encontradas: ${publicationsSnapshot.size}\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // 2. Por cada publicación, obtener la foto actual del usuario
    for (const pubDoc of publicationsSnapshot.docs) {
      const pubData = pubDoc.data();
      const creatorId = pubData.creatorId || pubData.authorUid;

      if (!creatorId) {
        console.log(`⚠️  Publicación ${pubDoc.id} sin creatorId, saltando...`);
        skipped++;
        continue;
      }

      try {
        // 3. Obtener datos actuales del usuario
        const userDoc = await db.collection('users').doc(creatorId).get();
        
        if (!userDoc.exists) {
          console.log(`⚠️  Usuario ${creatorId} no existe, saltando publicación ${pubDoc.id}...`);
          skipped++;
          continue;
        }

        const userData = userDoc.data();
        const currentFotoUrl = userData.fotoUrl || null;
        const currentNombre = userData.nombre || 'Anónimo';

        // 4. Actualizar la publicación con los datos actuales del usuario
        await pubDoc.ref.update({
          'creatorInfo.fotoUrl': currentFotoUrl,
          'creatorInfo.nombre': currentNombre,
          'authorPhotoURL': currentFotoUrl,
          'authorName': currentNombre,
        });

        console.log(`✅ Actualizada publicación ${pubDoc.id} con foto de ${currentNombre}`);
        updated++;

      } catch (error) {
        console.error(`❌ Error actualizando publicación ${pubDoc.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 RESUMEN:');
    console.log(`   ✅ Actualizadas: ${updated}`);
    console.log(`   ⚠️  Saltadas: ${skipped}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log('\n🎉 Proceso completado!\n');

  } catch (error) {
    console.error('❌ Error general:', error);
  }

  process.exit(0);
}

// Ejecutar el script
updateOldPostsPhotos();
