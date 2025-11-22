const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const authMiddleware = require('../middleware/authMiddleware');

// --- Rutas Protegidas ---
// Estas rutas requieren un token válido porque operan sobre el perfil del usuario logueado.
// Se aplica el middleware ANTES de pasar al controlador.
router.get('/me', authMiddleware, usersController.getMyProfile);
router.put('/me', authMiddleware, usersController.updateMyProfile);

// --- Ruta Pública ---
// Esta ruta es pública. Cualquiera puede ver el perfil básico de un usuario si tiene su ID.
// No lleva el authMiddleware.
router.get('/:userId', usersController.getUserProfileById);


module.exports = router;
