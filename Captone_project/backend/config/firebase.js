// Importa el SDK de Firebase Admin
const admin = require('firebase-admin');

// Inicializa Firebase con credenciales desde variables de entorno
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  })
});

// Obtiene la instancia de la base de datos de Firestore
const db = admin.firestore();

// Obtiene la instancia del servicio de autenticación
const auth = admin.auth();

// Exporta las instancias para usarlas en otras partes de la aplicación
module.exports = { db, auth };
