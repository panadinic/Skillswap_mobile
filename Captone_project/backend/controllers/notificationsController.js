const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const { createCalendarEventFromProposal } = require('./calendarController');

async function getUserPublicData(uid) {
  if (!uid) return { uid: null, nombre: 'Usuario', fotoUrl: null };
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return { uid, nombre: 'Usuario', fotoUrl: null };
  const d = snap.data() || {};
  return {
    uid,
    nombre: d.nombre || d.displayName || (d.email ? d.email.split('@')[0] : 'Usuario'),
    fotoUrl: d.fotoUrl || d.photoURL || null,
  };
}

const formatDateTime = (date) => {
  if (!date) return '';
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const toJSDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const serializeNotification = (doc) => {
  const data = doc.data() || {};
  const createdAt = data.createdAt;
  const readAt = data.readAt;
  return {
    id: doc.id,
    ...data,
    createdAt: createdAt?.toDate ? createdAt.toDate().toISOString() : createdAt || null,
    readAt: readAt?.toDate ? readAt.toDate().toISOString() : readAt || null,
  };
};

const createMeetingRequestNotification = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { conversationId, proposalMessageId } = req.body || {};
    if (!uid) return res.status(401).json({ error: 'No autorizado' });
    if (!conversationId || !proposalMessageId) {
      return res.status(400).json({ error: 'conversationId y proposalMessageId son obligatorios' });
    }

    const convoRef = db.collection('conversations').doc(conversationId);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists) return res.status(404).json({ error: 'Conversacion no encontrada' });
    const participants = convoSnap.get('participants') || [];
    if (!participants.includes(uid)) return res.status(403).json({ error: 'No participas de esta conversacion' });
    const targetUid = participants.find((p) => p !== uid);
    if (!targetUid) return res.status(400).json({ error: 'No se encontro destinatario para la notificacion' });

    const msgRef = convoRef.collection('messages').doc(proposalMessageId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) return res.status(404).json({ error: 'Propuesta no encontrada' });
    const msg = msgSnap.data();
    if (msg.type !== 'schedule') return res.status(400).json({ error: 'El mensaje no es una propuesta de reunion' });

    const when = toJSDate(msg.eventAt || null);
    const sender = await getUserPublicData(uid);
    const whenText = when ? formatDateTime(when) : 'una fecha pendiente';

    await db.collection('notifications').add({
      userId: targetUid,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: 'meeting_request',
      title: 'Solicitud de reunion',
      message: `${sender.nombre || 'Un usuario'} te envio una solicitud para el ${whenText}.`,
      conversationId,
      proposalMessageId,
      eventAt: when ? when.toISOString() : null,
      otherUser: sender,
    });

    return res.status(201).json({ created: true });
  } catch (error) {
    console.error('Error al crear notificacion de reunion:', error);
    return res.status(500).json({ error: 'No se pudo crear la notificacion.' });
  }
};

const respondMeetingRequest = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { conversationId, proposalMessageId, status, notificationId } = req.body || {};
    if (!uid) return res.status(401).json({ error: 'No autorizado' });
    if (!conversationId || !proposalMessageId || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Datos insuficientes para responder la solicitud' });
    }

    const convoRef = db.collection('conversations').doc(conversationId);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists) return res.status(404).json({ error: 'Conversacion no encontrada' });
    const participants = convoSnap.get('participants') || [];
    if (!participants.includes(uid)) return res.status(403).json({ error: 'No participas de esta conversacion' });

    const msgRef = convoRef.collection('messages').doc(proposalMessageId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) return res.status(404).json({ error: 'Propuesta no encontrada' });
    const msg = msgSnap.data();
    if (msg.type !== 'schedule') return res.status(400).json({ error: 'El mensaje no es una propuesta de reunion' });

    await msgRef.set(
      {
        status,
        decidedBy: uid,
        decidedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    let lastText = msg.text || 'Reunion propuesta';
    lastText = `${lastText} (${status === 'accepted' ? 'aceptada' : 'rechazada'})`;
    await convoRef.set(
      { lastMessageText: lastText, lastMessageAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    if (status === 'accepted') {
      try {
        await createCalendarEventFromProposal({ conversationId, proposalMessageId, uid });
      } catch (err) {
        console.warn('No se pudo crear evento tras aceptar desde notificaciones:', err);
      }
    }

    if (notificationId) {
      try {
        const notifRef = db.collection('notifications').doc(notificationId);
        const notifSnap = await notifRef.get();
        if (notifSnap.exists && notifSnap.data()?.userId === uid) {
          await notifRef.set(
            {
              read: true,
              actionTaken: status,
              respondedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn('No se pudo actualizar la notificacion de reunion:', err);
      }
    }

    return res.status(200).json({ updated: true, status });
  } catch (error) {
    console.error('Error al responder solicitud de reunion:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la solicitud.' });
  }
};

const getMyNotifications = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });

    const { limit } = req.query || {};
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

    // Sin orderBy para evitar requerir índices; ordenamos en memoria por createdAt
    const snapshot = await db
      .collection('notifications')
      .where('userId', '==', uid)
      .limit(parsedLimit)
      .get();

    const items = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const createdAt = data.createdAt;
        const ts = createdAt?.toDate
          ? createdAt.toDate().getTime()
          : createdAt?._seconds
          ? createdAt._seconds * 1000
          : 0;
        return { doc, ts };
      })
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(({ doc }) => serializeNotification(doc));

    return res.status(200).json({ items, nextCursor: null });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    return res.status(500).json({ error: 'No se pudieron obtener las notificaciones.' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { notificationId } = req.params;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });
    if (!notificationId) return res.status(400).json({ error: 'notificationId es obligatorio' });

    const docRef = db.collection('notifications').doc(notificationId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Notificación no encontrada.' });
    }
    if (doc.data().userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await docRef.update({
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ updated: true });
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la notificación.' });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });

    const snapshot = await db
      .collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', false)
      .get();

    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        read: true,
        readAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (snapshot.size > 0) {
      await batch.commit();
    }

    return res.status(200).json({ updated: snapshot.size });
  } catch (error) {
    console.error('Error al marcar notificaciones:', error);
    return res.status(500).json({ error: 'No se pudieron actualizar las notificaciones.' });
  }
};

// Limpia notificaciones leidas y antiguas (por defecto >90 dias)
const cleanupOldNotifications = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });
    const days = Number(req.body?.days || 90);
    const cutoffMs = Date.now() - Math.max(days, 1) * 24 * 60 * 60 * 1000;
    const cutoff = admin.firestore.Timestamp.fromMillis(cutoffMs);

    const snap = await db
      .collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', true)
      .where('createdAt', '<', cutoff)
      .limit(200)
      .get();

    if (snap.empty) return res.status(200).json({ deleted: 0 });

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return res.status(200).json({ deleted: snap.size });
  } catch (error) {
    console.error('Error en cleanupOldNotifications:', error);
    return res.status(500).json({ error: 'No se pudieron limpiar notificaciones.' });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createMeetingRequestNotification,
  respondMeetingRequest,
  cleanupOldNotifications,
};
