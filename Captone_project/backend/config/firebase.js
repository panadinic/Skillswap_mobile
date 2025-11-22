// Importa el SDK de Firebase Admin
const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey.json');

// Inicializa Firebase con las credenciales de administrador
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Obtiene la instancia de la base de datos de Firestore
const db = admin.firestore();

// Obtiene la instancia del servicio de autenticación
const auth = admin.auth();

// Exporta las instancias para usarlas en otras partes de la aplicación
module.exports = { db, auth };
