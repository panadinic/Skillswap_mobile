const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// POST /api/interests -> Marcar Interés en una Publicación ("Like")
router.post('/', async (req, res) => {
    const { publicationId } = req.body;
    const { userId } = req.user; // Usuario A, el que da "like"

    if (!publicationId) {
        return res.status(400).json({ error: 'publicationId es obligatorio.' });
    }

    const publicationRef = db.collection('publications').doc(publicationId);
    try {
        let matchCreated = false;

        // Usamos una transacción para asegurar que todas las operaciones se completen o ninguna lo haga
        await db.runTransaction(async (transaction) => {
            const publicationDoc = await transaction.get(publicationRef);
            if (!publicationDoc.exists) {
                throw new Error('La publicación no existe.');
            }

        
            const publicationData = publicationDoc.data();
            const ownerId = publicationData.creatorId; // Usuario B, dueño de la publicación

            if (ownerId === userId) {
                throw new Error('No puedes mostrar interés en tu propia publicación.');
            }

            // 1. Crea el documento de interés (INTERES)
            const interestRef = db.collection('interests').doc(`${userId}_${publicationId}`);
            transaction.set(interestRef, {
                userId: userId,
                publicationId: publicationId,
                ownerId: ownerId,
                fechaCreacion: new Date(),
            });

            // 2. Crea el evento para el modelo de ML (EVENTO_INTERACCION)
            const eventRef = db.collection('interactionEvents').doc();
            transaction.set(eventRef, {
                userId: userId,
                publicationId: publicationId,
                tipo: 'LIKE',
                fechaCreacion: new Date(),
            });

            // 3. Simula el TRIGGER: busca el interés recíproco

            // Busca si el dueño de la publicación (Usuario B) ha mostrado interés en CUALQUIER publicación del Usuario A
            const reciprocalInterestQuery = await db.collection('interests')
                .where('userId', '==', ownerId)
                .where('ownerId', '==', userId)
                .limit(1)
                .get();

            // Esta consulta necesita un índice compuesto. Firestore te dará el link para crearlo en la consola de error la primera vez que se ejecute.
            if (!reciprocalInterestQuery.empty) {

                // ¡HAY MATCH!
                matchCreated = true;
                const reciprocalInterestDoc = reciprocalInterestQuery.docs[0];
                const userAPublicationId = reciprocalInterestDoc.data().publicationId;
                const matchRef = db.collection('matches').doc();

                transaction.set(matchRef, {
                    userAId: userId,
                    userBId: ownerId,
                    publicationAId: userAPublicationId,
                    publicationBId: publicationId,
                    estado: 'ACTIVO',
                    fechaCreacion: new Date()
                });


                // 4. Crea la notificación para el otro usuario (NOTIFICACION)
                const userADoc = await db.collection('users').doc(userId).get(); // Necesitamos el nombre del usuario A
                const userAName = userADoc.exists ? userADoc.data().nombre : 'Alguien';
                const notificationRef = db.collection('users').doc(ownerId).collection('notifications').doc();

                transaction.set(notificationRef, {
                    tipo: 'MATCH',
                    titulo: '¡Nuevo Match!',
                    cuerpo: `Has hecho match con ${userAName}. ¡Inicia una conversación!`,
                    leida: false,
                    fechaCreacion: new Date()
                });

            }

        });

        res.status(200).json({ message: 'Interés registrado con éxito.', matchCreated: matchCreated });

    } catch (error) {
        console.error("Error processing interest:", error);

        // Devuelve el mensaje de error personalizado si lo lanzamos nosotros
        res.status(500).json({ error: error.message || 'Failed to process interest' });
    }
    
});

module.exports = router; 