const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');


// Proteger todas las rutas de este archivo
router.use(authMiddleware);

// GET /api/publications -> Obtener Todas las Publicaciones (Feed Principal)
router.get('/', async (req, res) => {
    try {
        const publicationsSnapshot = await db.collection('publications').where('activo', '==', true).orderBy('fechaCreacion', 'desc').get();
        const publications = await Promise.all(publicationsSnapshot.docs.map(async (doc) => {
            const publicationData = doc.data();

            let creatorName = 'Usuario Desconocido';
            if (publicationData.creatorId) {
                const userDoc = await db.collection('users').doc(publicationData.creatorId).get();
                if (userDoc.exists) {
                    creatorName = userDoc.data().nombre;
                }
            }
            return {
                id: doc.id,
                ...publicationData,
                creatorName: creatorName,
            };
        }));

        res.json(publications);
    } catch (error) {
        console.error("Error fetching publications:", error);
        res.status(500).json({ error: 'Failed to fetch publications' });
    }
});


// POST /api/publications -> Crear una Nueva Publicación
router.post('/', async (req, res) => {
    try {
        const { tipo, titulo, descripcion, nivel, modalidad, ciudad, region, tags } = req.body;
        const { userId } = req.user;

        if (!tipo || !titulo) {
            return res.status(400).json({ error: 'Tipo y título son obligatorios.' });
        }

        const newPublication = {
            creatorId: userId,
            tipo,
            titulo,
            descripcion: descripcion || null,
            nivel: nivel || null,
            modalidad: modalidad || null,
            ciudad: ciudad || null,
            region: region || null,
            tags: tags || [],
            activo: true,
            fechaCreacion: new Date(),
        };


        const docRef = await db.collection('publications').add(newPublication);
        res.status(201).json({ message: 'Publicación creada con éxito', id: docRef.id });
    } catch (error) {
        console.error("Error creating publication:", error);
        res.status(500).json({ error: 'Failed to create publication' });
    }
});

// --- MEDIA DE PUBLICACIÓN (de la tabla PUBLICACION_MEDIA) ---

// POST /api/publications/:publicationId/media -> Añadir media a una publicación

router.post('/:publicationId/media', async (req, res) => {
    try {
        const { publicationId } = req.params;
        const { url, altText, orden } = req.body;
        const { userId } = req.user;

        if (!url) {
            return res.status(400).json({ error: 'La URL es obligatoria.' });
        }

        // Verificación: Asegurarse de que el usuario es el dueño de la publicación
        const pubDoc = await db.collection('publications').doc(publicationId).get();
        if (!pubDoc.exists || pubDoc.data().creatorId !== userId) {
            return res.status(403).json({ error: 'No tienes permiso para modificar esta publicación.' });
        }

        const newMedia = {
            url,
            altText: altText || null,
            orden: orden || 0,
            fechaCreacion: new Date()
        };

        const mediaRef = db.collection('publications').doc(publicationId).collection('media');
        const docRef = await mediaRef.add(newMedia);

        res.status(201).json({ message: 'Media añadida con éxito.', id: docRef.id });
    } catch (error) {

        console.error("Error adding media:", error);
        res.status(500).json({ error: 'No se pudo añadir la media.' });
    }
});


module.exports = router; 