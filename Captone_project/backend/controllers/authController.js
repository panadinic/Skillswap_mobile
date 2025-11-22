const { auth, db } = require('../config/firebase');

/**
 * Controlador para registrar un nuevo usuario.
 */
const register = async (req, res) => {
  try {
    const { email, password, nombre } = req.body;

    // Validación de entrada básica
    if (!email || !password || !nombre) {
      return res.status(400).json({ error: "Email, contraseña y nombre son obligatorios." });
    }

    // 1. Crear el usuario en Firebase Authentication
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: nombre,
    });

    // 2. Crear un documento de perfil de usuario en la colección 'users' de Firestore.
    // Usamos el UID de Authentication como el ID del documento para mantenerlos vinculados.
    const userProfile = {
      nombre: nombre,
      email: email,
      fechaCreacion: new Date(),
      rol: 'USER', // Rol por defecto
      fotoUrl: null,
      bio: null,
    };

    // Escribimos el documento en Firestore
    await db.collection('users').doc(userRecord.uid).set(userProfile);

    // 3. Respuesta
    return res.status(201).json({
      message: "Usuario registrado con éxito.",
      uid: userRecord.uid
    });

  } catch (error) {
    console.error("Error en el registro:", error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: "El correo electrónico ya está en uso." });
    }
    return res.status(500).json({ error: "Fallo al registrar el usuario." });
  }
};

module.exports = { register };

