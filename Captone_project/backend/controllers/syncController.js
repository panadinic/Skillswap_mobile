const { db } = require('../config/firebase');

/**
 * Sincroniza los datos del usuario en todas sus publicaciones
 * Se llama cuando el usuario actualiza su perfil
 */
const syncUserDataInPublications = async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Obtener datos actualizados del usuario
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const userData = userDoc.data();
    const updatedCreatorInfo = {
      nombre: userData.nombre || 'Anónimo',
      fotoUrl: userData.fotoUrl || null
    };
    
    // Obtener todas las publicaciones del usuario
    const publicationsSnapshot = await db.collection('publications')
      .where('creatorId', '==', uid)
      .get();
    
    if (publicationsSnapshot.empty) {
      return res.status(200).json({ 
        message: 'No hay publicaciones para sincronizar',
        updated: 0 
      });
    }
    
    // Actualizar cada publicación en batch
    const batch = db.batch();
    publicationsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        creatorInfo: updatedCreatorInfo,
        authorName: userData.nombre || 'Anónimo',
        authorPhotoURL: userData.fotoUrl || null
      });
    });
    
    await batch.commit();
    
    return res.status(200).json({ 
      message: 'Datos sincronizados correctamente',
      updated: publicationsSnapshot.size 
    });
    
  } catch (error) {
    console.error('Error sincronizando datos:', error);
    return res.status(500).json({ error: 'No se pudieron sincronizar los datos' });
  }
};

module.exports = {
  syncUserDataInPublications
};
