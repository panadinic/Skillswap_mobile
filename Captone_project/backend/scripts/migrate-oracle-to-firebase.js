// Importa las librerías necesarias
const oracledb = require('oracledb');
const path = require('path');
const { db } = require('../config/firebase'); // Conexión a Firebase

// Construye una ruta absoluta al archivo .env en la raíz de /backend
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

// --- CONFIGURACIÓN CRÍTICA DE ORACLE ---
// Asegura que las filas se devuelvan como objetos JS, no arrays.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Aumenta el límite de listeners para evitar warnings con muchas operaciones asíncronas
require('events').EventEmitter.defaultMaxListeners = 30;

// Configuración de la conexión a Oracle
const oracleConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT,
};

// --- FUNCIÓN PRINCIPAL DE MIGRACIÓN ---
async function migrate() {
  let connection;
  console.log('Iniciando migración OPTIMIZADA de Oracle a Firebase...');

  try {
    // Verificación de las variables de entorno
    if (!oracleConfig.user || !oracleConfig.password || !oracleConfig.connectString) {
        console.error('Error: Faltan variables de entorno para la conexión a Oracle. Revisa tu archivo .env.');
        process.exit(1);
    }

    connection = await oracledb.getConnection(oracleConfig);
    console.log('Conectado a Oracle DB.');

    // --- ORDEN DE MIGRACIÓN CRÍTICO ---
    // 1. Entidades base (sin dependencias)
    await migrateTiposHabilidad(connection);
    await migrateUsuarios(connection); // Incluye ROL y PREFERENCIAS

    // 2. Entidades que dependen de las base
    await migratePublicaciones(connection);
    await migrateIntereses(connection);
    await migrateMatches(connection);
    await migrateBloqueos(connection);
    await migrateEventosInteraccion(connection);
    await migrateReportes(connection);

    // 3. Sub-colecciones y datos anidados
    await migrateMensajesToSubcollection(connection);
    await migratePublicacionMediaToSubcollection(connection);
    await migrateEventosCalendarioToSubcollection(connection);
    await migrateDisponibilidadToSubcollection(connection);
    await migrateNotificacionesToSubcollection(connection);

    // 4. Actualizaciones (post-procesamiento para relaciones N:N)
    await updatePublicacionesWithTags(connection);
    
    console.log('Migración de la lógica de negocio completada con éxito.');

  } catch (err)
 {
    console.error('Error durante la migración:', err);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('Conexión a Oracle cerrada.');
      } catch (err) {
        console.error('Error cerrando la conexión a Oracle:', err);
      }
    }
    process.exit();
  }
}

// --- UTILIDAD PARA MANEJAR BATCHES GRANDES ---
async function commitBatchInChunks(collectionName, items, isSubcollection = false) {
    if (items.length === 0) return;
    const MAX_BATCH_SIZE = 499; // Límite de Firestore es 500
    let batch = db.batch();
    let count = 0;

    for (const item of items) {
        const docRef = isSubcollection 
            ? item.ref // Para subcolecciones, la referencia ya está construida
            : db.collection(collectionName).doc(item.id);
        batch.set(docRef, item.data);
        count++;
        if (count >= MAX_BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0) {
        await batch.commit();
    }
}


// --- FUNCIONES DE MIGRACIÓN INDIVIDUALES ---

async function migrateTiposHabilidad(connection) {
  console.log('Migrando TIPO_HABILIDAD...');
  const result = await connection.execute(`SELECT ID, NOMBRE, DESCRIPCION FROM TIPO_HABILIDAD`);
  const items = result.rows.map(row => ({
    id: `oracle_${row.ID}`,
    data: { 
        oracleId: row.ID, 
        nombre: row.NOMBRE ?? '', 
        descripcion: row.DESCRIPCION ?? null 
    }
  }));
  await commitBatchInChunks('tipos_habilidad', items);
  console.log(`Migrados ${items.length} tipos de habilidad.`);
}

async function migrateUsuarios(connection) {
    console.log('Migrando USUARIO (con ROL y PREFERENCIAS)...');
    const result = await connection.execute(`
        SELECT u.ID, u.NOMBRE, u.EMAIL, u.PASSWORD_HASH, r.NOMBRE AS ROL_NOMBRE, p.EMAIL_VISIBLE, p.PERFIL_PUBLICO
        FROM USUARIO u
        LEFT JOIN ROL r ON u.ROL_ID = r.ID
        LEFT JOIN PREFERENCIA_USUARIO p ON u.ID = p.USUARIO_ID
    `);
    const items = result.rows.map(row => ({
        id: `oracle_${row.ID}`,
        data: {
            oracleId: row.ID,
            nombre: row.NOMBRE ?? '',
            email: row.EMAIL ?? '',
            passwordHash: row.PASSWORD_HASH ?? null,
            rol: row.ROL_NOMBRE || 'USER',
            emailVisible: (row.EMAIL_VISIBLE === 1),
            perfilPublico: (row.PERFIL_PUBLICO === 1),
        }
    }));
    await commitBatchInChunks('users', items);
    console.log(`Migrados ${items.length} usuarios.`);
}

async function migratePublicaciones(connection) {
    console.log('Migrando PUBLICACION...');
    const result = await connection.execute(`SELECT ID, USUARIO_ID, TIPO, TITULO, DESCRIPCION, NIVEL, MODALIDAD, CIUDAD, REGION, ACTIVO, FECHA_CREACION FROM PUBLICACION`);
    const items = result.rows.map(row => ({
        id: `oracle_${row.ID}`,
        data: {
            oracleId: row.ID,
            creatorId: `oracle_${row.USUARIO_ID}`,
            tipo: row.TIPO ?? 'BUSCO',
            titulo: row.TITULO ?? '',
            descripcion: row.DESCRIPCION ?? null,
            nivel: row.NIVEL ?? null,
            modalidad: row.MODALIDAD ?? null,
            ciudad: row.CIUDAD ?? null,
            region: row.REGION ?? null,
            activo: (row.ACTIVO === 1),
            fechaCreacion: row.FECHA_CREACION ?? new Date(),
            tags: [] // Se llenará en el paso de post-procesamiento
        }
    }));
    await commitBatchInChunks('publications', items);
    console.log(`Migradas ${items.length} publicaciones.`);
}

async function updatePublicacionesWithTags(connection) {
    console.log('Actualizando publicaciones con TAGS (relación N:N)...');
    const result = await connection.execute(`SELECT PUBLICACION_ID, TIPO_HABILIDAD_ID FROM PUBLICACION_TIPO_HABILIDAD`);
    
    const tagsByPubId = result.rows.reduce((acc, row) => {
        const pubId = `oracle_${row.PUBLICACION_ID}`;
        const tagId = `oracle_${row.TIPO_HABILIDAD_ID}`;
        if (!acc[pubId]) acc[pubId] = [];
        acc[pubId].push(tagId);
        return acc;
    }, {});

    const batch = db.batch();
    let count = 0;
    for (const pubId in tagsByPubId) {
        const docRef = db.collection('publications').doc(pubId);
        batch.update(docRef, { tags: tagsByPubId[pubId] });
        count++;
        if (count >= 499) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if(count > 0) await batch.commit();
    console.log(`Actualizadas ${Object.keys(tagsByPubId).length} publicaciones con sus tags.`);
}

async function migrateIntereses(connection) {
    console.log('Migrando INTERES...');
    const result = await connection.execute(`SELECT USUARIO_ID, PUBLICACION_ID, ESTADO, FECHA_CREACION FROM INTERES`);
    const items = result.rows.map(row => ({
        id: `oracle_u${row.USUARIO_ID}_p${row.PUBLICACION_ID}`,
        data: {
            userId: `oracle_${row.USUARIO_ID}`,
            publicationId: `oracle_${row.PUBLICACION_ID}`,
            estado: row.ESTADO ?? 'INTERESA',
            fechaCreacion: row.FECHA_CREACION ?? new Date()
        }
    }));
    await commitBatchInChunks('interests', items);
    console.log(`Migrados ${items.length} intereses.`);
}

async function migrateMatches(connection) {
    console.log('Migrando MATCHE...');
    const result = await connection.execute(`SELECT ID, USUARIO_A_ID, USUARIO_B_ID, PUBLICACION_A_ID, PUBLICACION_B_ID, ESTADO FROM MATCHE`);
    const items = result.rows.map(row => ({
        id: `oracle_${row.ID}`,
        data: {
            oracleId: row.ID,
            userAId: `oracle_${row.USUARIO_A_ID}`,
            userBId: `oracle_${row.USUARIO_B_ID}`,
            publicationAId: `oracle_${row.PUBLICACION_A_ID}`,
            publicationBId: `oracle_${row.PUBLICACION_B_ID}`,
            estado: row.ESTADO ?? 'ACTIVO'
        }
    }));
    await commitBatchInChunks('matches', items);
    console.log(`Migrados ${items.length} matches.`);
}

async function migrateMensajesToSubcollection(connection) {
    console.log('Migrando MENSAJE a subcolecciones de matches...');
    const result = await connection.execute(`SELECT ID, MATCH_ID, EMISOR_ID, CONTENIDO, LEIDO, FECHA_CREACION FROM MENSAJE`);
    const items = result.rows.map(row => ({
        ref: db.collection('matches').doc(`oracle_${row.MATCH_ID}`).collection('messages').doc(`oracle_${row.ID}`),
        data: {
            oracleId: row.ID,
            emisorId: `oracle_${row.EMISOR_ID}`,
            contenido: row.CONTENIDO ?? '',
            leido: (row.LEIDO === 1),
            fechaCreacion: row.FECHA_CREACION ?? new Date()
        }
    }));
    await commitBatchInChunks(null, items, true);
    console.log(`Migrados ${items.length} mensajes.`);
}

async function migratePublicacionMediaToSubcollection(connection) {
    console.log('Migrando PUBLICACION_MEDIA a subcolecciones de publications...');
    const result = await connection.execute(`SELECT ID, PUBLICACION_ID, URL, ALT_TEXT, ORDEN FROM PUBLICACION_MEDIA`);
    const items = result.rows.map(row => ({
        ref: db.collection('publications').doc(`oracle_${row.PUBLICACION_ID}`).collection('media').doc(`oracle_${row.ID}`),
        data: { 
            oracleId: row.ID, 
            url: row.URL ?? '', 
            altText: row.ALT_TEXT ?? null, 
            orden: row.ORDEN ?? 0 
        }
    }));
    await commitBatchInChunks(null, items, true);
    console.log(`Migrados ${items.length} archivos media.`);
}

async function migrateBloqueos(connection) {
    console.log('Migrando BLOQUEO_USUARIO...');
    const result = await connection.execute(`SELECT ID, BLOQUEADOR_ID, BLOQUEADO_ID FROM BLOQUEO_USUARIO`);
    const items = result.rows.map(row => ({
        id: `oracle_${row.ID}`,
        data: { 
            oracleId: row.ID, 
            blockerId: `oracle_${row.BLOQUEADOR_ID}`, 
            blockedId: `oracle_${row.BLOQUEADO_ID}` 
        }
    }));
    await commitBatchInChunks('userBlocks', items);
    console.log(`Migrados ${items.length} bloqueos.`);
}

async function migrateDisponibilidadToSubcollection(connection) {
    console.log('Migrando DISPONIBILIDAD a subcolecciones de users...');
    const result = await connection.execute(`SELECT ID, USUARIO_ID, DIA_SEMANA, HORA_INICIO_MIN, HORA_FIN_MIN, MODALIDAD FROM DISPONIBILIDAD`);
    const items = result.rows.map(row => ({
        ref: db.collection('users').doc(`oracle_${row.USUARIO_ID}`).collection('availability').doc(`oracle_${row.ID}`),
        data: {
            oracleId: row.ID,
            diaSemana: row.DIA_SEMANA ?? 0,
            horaInicioMin: row.HORA_INICIO_MIN ?? 0,
            horaFinMin: row.HORA_FIN_MIN ?? 0,
            modalidad: row.MODALIDAD ?? null
        }
    }));
    await commitBatchInChunks(null, items, true);
    console.log(`Migradas ${items.length} disponibilidades.`);
}

async function migrateEventosCalendarioToSubcollection(connection) {
    console.log('Migrando EVENTO_CALENDARIO a subcolecciones de matches...');
    const result = await connection.execute(`SELECT ID, MATCH_ID, INICIO_AT, FIN_AT, MODALIDAD, LUGAR, ESTADO FROM EVENTO_CALENDARIO`);
    const items = result.rows.map(row => ({
        ref: db.collection('matches').doc(`oracle_${row.MATCH_ID}`).collection('calendarEvents').doc(`oracle_${row.ID}`),
        data: {
            oracleId: row.ID,
            inicioAt: row.INICIO_AT ?? new Date(),
            finAt: row.FIN_AT ?? new Date(),
            modalidad: row.MODALIDAD ?? null,
            lugar: row.LUGAR ?? null,
            estado: row.ESTADO ?? 'PROPUESTO',
        }
    }));
    await commitBatchInChunks(null, items, true);
    console.log(`Migrados ${items.length} eventos de calendario.`);
}

async function migrateEventosInteraccion(connection) {
    console.log('Migrando EVENTO_INTERACCION...');
    const result = await connection.execute(`SELECT ID, USUARIO_ID, PUBLICACION_ID, TIPO FROM EVENTO_INTERACCION`);
    const items = result.rows.map(row => ({
        id: `oracle_${row.ID}`,
        data: {
            oracleId: row.ID,
            userId: `oracle_${row.USUARIO_ID}`,
            publicationId: row.PUBLICACION_ID ? `oracle_${row.PUBLICACION_ID}` : null,
            tipo: row.TIPO ?? ''
        }
    }));
    await commitBatchInChunks('interactionEvents', items);
    console.log(`Migrados ${items.length} eventos de interacción.`);
}

async function migrateNotificacionesToSubcollection(connection) {
    console.log('Migrando NOTIFICACION a subcolecciones de users...');
    const result = await connection.execute(`SELECT ID, USUARIO_ID, TIPO, TITULO, CUERPO, LEIDA FROM NOTIFICACION`);
    const items = result.rows.map(row => ({
        ref: db.collection('users').doc(`oracle_${row.USUARIO_ID}`).collection('notifications').doc(`oracle_${row.ID}`),
        data: { 
            oracleId: row.ID, 
            tipo: row.TIPO ?? 'SISTEMA', 
            titulo: row.TITULO ?? null, 
            cuerpo: row.CUERPO ?? null, 
            leida: (row.LEIDA === 1) 
        }
    }));
    await commitBatchInChunks(null, items, true);
    console.log(`Migradas ${items.length} notificaciones.`);
}

async function migrateReportes(connection) {
    console.log('Migrando REPORTE...');
    const result = await connection.execute(`SELECT ID, REPORTANTE_ID, TIPO_OBJETO, OBJETO_ID, TIPO_REPORTE, DETALLE, ESTADO FROM REPORTE`);
    const items = result.rows.map(row => ({
        id: `oracle_${row.ID}`,
        data: {
            oracleId: row.ID,
            reportanteId: `oracle_${row.REPORTANTE_ID}`,
            tipoObjeto: row.TIPO_OBJETO ?? null,
            objetoId: `oracle_${row.OBJETO_ID}`,
            tipoReporte: row.TIPO_REPORTE ?? null,
            detalle: row.DETALLE ?? null,
            estado: row.ESTADO ?? 'ABIERTO'
        }
    }));
    await commitBatchInChunks('reports', items);
    console.log(`Migrados ${items.length} reportes.`);
}


// --- EJECUTAR EL SCRIPT ---
migrate();

