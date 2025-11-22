const express = require('express');
const router = express.Router();
const publicationsController = require('../controllers/publicationsController');
const authMiddleware = require('../middleware/authMiddleware');

// --- Rutas Públicas ---
// Cualquiera puede ver el listado de publicaciones o una publicación específica.
router.get('/', publicationsController.getAllPublications);
router.get('/search', publicationsController.searchPublications);
router.get('/:publicationId', publicationsController.getPublicationById);

// --- Rutas Protegidas ---
// Solo un usuario autenticado puede crear una nueva publicación o eliminar la propia.
router.post('/', authMiddleware, publicationsController.createPublication);
router.delete('/:publicationId', authMiddleware, publicationsController.deletePublication);

module.exports = router;
