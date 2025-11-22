const express = require('express');
const router = express.Router();

// Importamos el controlador que contiene la lógica de registro
const authController = require('../controllers/authController');

// Define la ruta POST para el registro de nuevos usuarios.
// Cuando llegue una petición a /api/auth/register, se ejecutará authController.register
router.post('/register', authController.register);


module.exports = router;
