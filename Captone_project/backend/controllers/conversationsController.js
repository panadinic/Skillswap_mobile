const { db } = require('../config/firebase');
const admin = require('firebase-admin');

const markConversationSeen = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { conversationId } = req.params;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });
    if (!conversationId) return res.status(400).json({ error: 'conversationId es obligatorio' });

    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    await convRef.set({
      lastSeenBy: {
        [uid]: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    return res.status(200).json({ updated: true });
  } catch (error) {
    console.error('Error al marcar conversación como vista:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la conversación' });
  }
};

module.exports = { markConversationSeen };

