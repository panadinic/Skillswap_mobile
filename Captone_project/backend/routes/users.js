const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/authMiddleware');

// Proteger todas las rutas de este archivo con el middleware
router.use(authMiddleware);

// --- PERFIL DE USUARIO (de la tabla USUARIO) ---

// GET /api/users/me -> Obtener mi Propio Perfil
router.get('/me', async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        const { passwordHash, ...userData } = userDoc.data(); // Excluir el hash de la respuesta
        res.json({ id: userDoc.id, ...userData });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: 'No se pudo obtener el perfil del usuario.' });
    }
});

// PUT /api/users/me -> Actualizar mi Perfil
router.put('/me', async (req, res) => {
    try {
        const { nombre, ciudad, region, bio, fotoUrl, estado, modalidadPref } = req.body;
        const userRef = db.collection('users').doc(req.user.userId);

        const updateData = {};
        if (nombre) updateData.nombre = nombre;
        if (ciudad) updateData.ciudad = ciudad;
        if (region) updateData.region = region;
        if (bio) updateData.bio = bio;
        if (fotoUrl) updateData.fotoUrl = fotoUrl;
        if (estado) updateData.estado = estado; // 'DISPONIBLE' o 'OCUPADO'
        if (modalidadPref) updateData.modalidadPref = modalidadPref;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron datos para actualizar.' });
        }
        
        updateData.fechaActualizacion = new Date(); // Simula el trigger TRG_USUARIO_UPDATE_TS

        await userRef.update(updateData);
        res.json({ message: 'Perfil actualizado con éxito.' });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
    }
});

// --- PREFERENCIAS (de la tabla PREFERENCIA_USUARIO) ---

// PUT /api/users/me/preferences -> Actualizar mis Preferencias
router.put('/me/preferences', async (req, res) => {
    try {
        const { emailVisible, perfilPublico, notifPush, notifEmail } = req.body;
        const userRef = db.collection('users').doc(req.user.userId);

        const updateData = {};
        if (emailVisible !== undefined) updateData.emailVisible = emailVisible;
        if (perfilPublico !== undefined) updateData.perfilPublico = perfilPublico;
        if (notifPush !== undefined) updateData.notifPush = notifPush;
        if (notifEmail !== undefined) updateData.notifEmail = notifEmail;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron preferencias para actualizar.' });
        }

        await userRef.update(updateData);
        res.json({ message: 'Preferencias actualizadas con éxito.' });

    } catch (error) {
        console.error("Error updating preferences:", error);
        res.status(500).json({ error: 'No se pudieron actualizar las preferencias.' });
    }
});


// --- DISPONIBILIDAD (de la tabla DISPONIBILIDAD) ---

// POST /api/users/me/availability -> Añadir un bloque de disponibilidad
router.post('/me/availability', async (req, res) => {
    try {
        const { diaSemana, horaInicioMin, horaFinMin, modalidad } = req.body;
        if (diaSemana === undefined || horaInicioMin === undefined || horaFinMin === undefined) {
            return res.status(400).json({ error: 'diaSemana, horaInicioMin y horaFinMin son obligatorios.' });
        }

        const availabilityRef = db.collection('users').doc(req.user.userId).collection('availability');
        const newAvailability = { diaSemana, horaInicioMin, horaFinMin, modalidad: modalidad || null };
        const docRef = await availabilityRef.add(newAvailability);

        res.status(201).json({ message: 'Disponibilidad añadida con éxito.', id: docRef.id });
    } catch (error) {
        console.error("Error adding availability:", error);
        res.status(500).json({ error: 'No se pudo añadir la disponibilidad.' });
    }
});

// --- NOTIFICACIONES (de la tabla NOTIFICACION) ---

// GET /api/users/me/notifications -> Obtener mis notificaciones
router.get('/me/notifications', async (req, res) => {
    try {
        const notificationsSnapshot = await db.collection('users').doc(req.user.userId).collection('notifications')
            .orderBy('fechaCreacion', 'desc')
            .limit(20)
            .get();
        
        const notifications = notificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: 'No se pudieron obtener las notificaciones.' });
    }
});


// --- BLOQUEOS (de la tabla BLOQUEO_USUARIO) ---

// POST /api/users/block -> Bloquear a otro usuario
router.post('/block', async (req, res) => {
    try {
        const { blockedUserId } = req.body;
        if (!blockedUserId) {
            return res.status(400).json({ error: 'blockedUserId es obligatorio.' });
        }

        if (blockedUserId === req.user.userId) {
            return res.status(400).json({ error: 'No te puedes bloquear a ti mismo.' });
        }
        
        const blockData = {
            blockerId: req.user.userId,
            blockedId: blockedUserId,
            fechaCreacion: new Date(),
        };

        const docRef = await db.collection('userBlocks').add(blockData);
        res.status(201).json({ message: 'Usuario bloqueado con éxito.', id: docRef.id });
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).json({ error: 'No se pudo bloquear al usuario.' });
    }
});

module.exports = router;

