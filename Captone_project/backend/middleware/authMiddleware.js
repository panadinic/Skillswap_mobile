const { auth } = require('../config/firebase');

/**
 * Middleware para verificar el token de Firebase ID enviado por el frontend.
 */
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 1. Verificar que el header 'Authorization' exista y tenga el formato 'Bearer <token>'
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado: token no proporcionado o formato incorrecto.' });
    }

    // 2. Extraer el token del encabezado.
    const idToken = authHeader.split('Bearer ')[1];

    try {
        // 3. Verificar la validez del token
        const decodedToken = await auth.verifyIdToken(idToken);

        // 4. Adjuntar la información del usuario al objeto 'req'.
        req.user = decodedToken;
        
        // 5. Continuar
        next();
    } catch (error) {
        console.error('Error al verificar el token:', error);
        return res.status(401).json({ error: 'No autorizado: token inválido.' });
    }
};

module.exports = authMiddleware;

