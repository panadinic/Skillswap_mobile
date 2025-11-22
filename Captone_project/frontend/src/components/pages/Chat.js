import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, doc, setDoc, where, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebaseClient";
import { getAuth } from "firebase/auth";
import { getMatches } from "../../services/interactions";
import { createCalendarEventFromSchedule } from "../../services/calendar";
import { markConversationSeen } from "../../services/conversations";
import { createMeetingRequestNotification, respondMeetingRequest } from "../../services/notifications";
import { DEFAULT_AVATAR } from "../../utils/placeholders";
import "./Chat.css";

function Chat() {
  const { id } = useParams(); // conversationId = matchId
  const navigate = useNavigate();
  const auth = getAuth();
  const me = auth.currentUser;

  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [conversations, setConversations] = useState([]); // listado con lastMessage
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [other, setOther] = useState(null); // para header de conversación
  const bottomRef = useRef(null);

  // UI para agendar reunión
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(""); // ISO para input datetime-local

  // Cargar lista de matches si no hay conversación seleccionada
  useEffect(() => {
    if (id) return;
    (async () => {
      try {
        setLoadingMatches(true);
        const ms = await getMatches();
        setMatches(ms || []);
      } finally {
        setLoadingMatches(false);
      }
    })();
  }, [id]);

  // Suscripción a conversaciones del usuario (para mostrar último mensaje en lista)
  useEffect(() => {
    if (id) return; // solo en lista
    if (!me) return;
    const q = query(collection(db, "conversations"), where("participants", "array-contains", me.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.lastMessageAt?.toMillis?.() || 0;
        const tb = b.lastMessageAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setConversations(list);
    });
    return () => unsub();
  }, [id, me]);

  // Suscribirse a mensajes si hay conversación
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "conversations", id, "messages"),
      orderBy("sentAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [id]);

  // Obtener info del otro usuario para el header cuando hay conversación
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // buscar en matches el que coincide con id
        const ms = matches.length ? matches : await getMatches();
        const m = (ms || []).find((x) => x.id === id);
        if (m && m.other) setOther(m.other);
      } catch {}
    })();
  }, [id, matches]);

  // Auto-scroll al final cuando cambian mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!id || !me) return;
    const mark = async () => {
      try {
        await markConversationSeen(id);
        window.dispatchEvent(new Event("chats-updated"));
      } catch (error) {
        console.error("No se pudo marcar conversación como vista:", error);
      }
    };
    mark();
  }, [id, me]);

  useEffect(() => {
    document.body.classList.add("chat-body");
    return () => {
      document.body.classList.remove("chat-body");
    };
  }, []);

  const canSend = useMemo(() => !!(me && id && text.trim()), [me, id, text]);

  const send = async () => {
    if (!canSend) return;
    const payload = {
      fromUid: me.uid,
      text: text.trim(),
      sentAt: serverTimestamp(),
      type: "text",
    };
    await addDoc(collection(db, "conversations", id, "messages"), payload);
    // Denormalizar último mensaje en conversation
    await setDoc(
      doc(db, "conversations", id),
      { lastMessageText: payload.text, lastMessageAt: serverTimestamp() },
      { merge: true }
    );
    setText("");
  };

  // Helpers para formatear fecha/hora
  const formatDateTime = (d) => {
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const openScheduler = () => {
    // Pre-cargar con ahora + 1h
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60);
    const tzAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16); // yyyy-MM-ddTHH:mm
    setScheduleValue(tzAdjusted);
    setShowScheduler(true);
  };

  const confirmSchedule = async () => {
    if (!me || !id || !scheduleValue) return;
    const [datePart, timePart] = scheduleValue.split("T");
    const [y, m, d] = datePart.split("-").map((x) => parseInt(x, 10));
    const [hh, mm] = timePart.split(":").map((x) => parseInt(x, 10));
    const when = new Date(y, m - 1, d, hh, mm, 0);

    const textMsg = `Reunión propuesta: ${formatDateTime(when)}`;
    const payload = {
      fromUid: me.uid,
      text: textMsg,
      type: "schedule",
      eventAt: Timestamp.fromDate(when),
      sentAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "conversations", id, "messages"), payload);
    await setDoc(
      doc(db, "conversations", id),
      { lastMessageText: textMsg, lastMessageAt: serverTimestamp() },
      { merge: true }
    );
    try {
      await createMeetingRequestNotification({ conversationId: id, proposalMessageId: docRef.id });
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (err) {
      console.error("No se pudo crear la notificacion de reunion:", err);
    }
    setShowScheduler(false);
  };

  const syncMeetingNotification = async (status, proposalMessageId) => {
    if (!["accepted", "rejected"].includes(status)) return;
    if (!id || !proposalMessageId) return;
    try {
      await respondMeetingRequest({
        conversationId: id,
        proposalMessageId,
        status,
      });
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (err) {
      console.warn("No se pudo sincronizar la notificacion de reunion:", err);
    }
  };

  // Buscar si ya existe respuesta para una propuesta
  const getDecisionFor = (proposalId) =>
    messages.find((x) => x.type === "schedule_response" && x.refId === proposalId);

  // Acciones sobre una propuesta (aceptar / rechazar / cancelar)
  const updateScheduleStatus = async (msg, status) => {
    if (!id || !msg?.id) return;
    try {
      // Intentar actualizar el mensaje original (si las reglas lo permiten)
      const msgRef = doc(db, "conversations", id, "messages", msg.id);
      await setDoc(
        msgRef,
        { status, decidedBy: me?.uid || null, decidedAt: serverTimestamp() },
        { merge: true }
      );

      let lastText = msg.text;
      if (status === "accepted") lastText = `${msg.text} (aceptada)`;
      if (status === "rejected") lastText = `${msg.text} (rechazada)`;
      await setDoc(
        doc(db, "conversations", id),
        { lastMessageText: lastText, lastMessageAt: serverTimestamp() },
        { merge: true }
      );

      // Crear evento en calendario para ambos usuarios cuando se acepta
      if (status === "accepted") {
        try {
          await createCalendarEventFromSchedule({ conversationId: id, proposalMessageId: msg.id });
        } catch (e2) {
          console.error('No se pudo crear el evento de calendario:', e2);
        }
      }
    } catch (e) {
      // Fallback: crear un mensaje de respuesta (no modifica el original)
      const responseText =
        status === "accepted"
          ? "Reunión aceptada"
          : "Reunión cancelada";
      const payload = {
        fromUid: me?.uid,
        type: "schedule_response",
        refId: msg.id,
        status,
        eventAt: msg.eventAt || null,
        text: responseText,
        sentAt: serverTimestamp(),
      };
      await addDoc(collection(db, "conversations", id, "messages"), payload);
      await setDoc(
        doc(db, "conversations", id),
        { lastMessageText: responseText, lastMessageAt: serverTimestamp() },
        { merge: true }
      );

      if (status === "accepted") {
        try {
          await createCalendarEventFromSchedule({ conversationId: id, proposalMessageId: msg.id });
        } catch (e3) {
          console.error('No se pudo crear el evento de calendario:', e3);
        }
      }
    }
    await syncMeetingNotification(status, msg.id);
  };

  if (!id) {
    return <Navigate to="/likes" replace />;
    const convById = new Map(conversations.map((c) => [c.id, c]));
    const matchById = new Map((matches || []).map((m) => [m.id, m]));
    const allIds = Array.from(new Set([
      ...Array.from(convById.keys()),
      ...Array.from(matchById.keys()),
    ]));
    const items = allIds
      .map((cid) => {
        const c = convById.get(cid);
        const m = matchById.get(cid);
        const lastAt = c?.lastMessageAt?.toMillis?.() || 0;
        const createdAt = m?.createdAt?.toMillis?.() || 0;
        return {
          id: cid,
          other: m?.other,
          lastMessageText: c?.lastMessageText || 'Sin mensajes aun',
          sortTs: lastAt || createdAt || 0,
        };
      })
      .sort((a, b) => b.sortTs - a.sortTs);
    return (
      <div className="chat-list">
        <header className="chat-header">
          <div className="brand">S</div>
          <div className="title">CHATS</div>
        </header>
        {loadingMatches && <div className="info">Cargando...</div>}
        {!loadingMatches && items.length === 0 && (
          <div className="info">Aún no tienes conversaciones.</div>
        )}
        <div className="chat-items">
          {items.map((it) => {
            const otherUser = it.other;
            return (
              <div key={it.id} className="chat-item" onClick={() => navigate(`/chat/${it.id}`)}>
                <img className="avatar" src={otherUser?.fotoUrl || DEFAULT_AVATAR} alt={otherUser?.nombre || 'usuario'} />
                <div className="chat-item-body">
                  <div className="name">{otherUser?.nombre || 'Usuario'}</div>
                  <div className="preview">{it.lastMessageText || 'Sin mensajes aún'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <header className="chat-topbar">
        <button className="back" onClick={() => navigate("/chat")}>&lt;</button>
        <img className="avatar" src={other?.fotoUrl || DEFAULT_AVATAR} alt={other?.nombre || 'usuario'} />
        <div className="name">{other?.nombre || 'Chat'}</div>
      </header>

      <div className="chat-messages">
        {messages.map((m) => {
          const mine = m.fromUid === me?.uid;
          const isSchedule = m.type === "schedule";
          const decision = isSchedule ? getDecisionFor(m.id) : null;
          return (
            <div key={m.id} className={`bubble ${mine ? 'right' : 'left'}`}>
              {!mine && (
                <img
                  className="bubble-avatar"
                  src={other?.fotoUrl || DEFAULT_AVATAR}
                  alt="avatar"
                />
              )}
              <div className="text">
                {m.text}
                {isSchedule && (
                  <div className="schedule-meta">
                    {(m.status === "accepted" || decision?.status === "accepted") && (
                      <span className="ok">Confirmada</span>
                    )}
                    {(m.status === "rejected" || decision?.status === "rejected") && (
                      <span className="no">Rechazada</span>
                    )}
                    {!m.status && !decision && (
                      <div className="schedule-actions">
                        {mine ? (
                          <button className="btn-reject" onClick={() => updateScheduleStatus(m, "rejected")}>Cancelar</button>
                        ) : (
                          <>
                            <button className="btn-accept" onClick={() => updateScheduleStatus(m, "accepted")}>Aceptar</button>
                            <button className="btn-reject" onClick={() => updateScheduleStatus(m, "rejected")}>Rechazar</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <button className="plus" title="Más">+</button>
        <button className="schedule" title="Agendar reunión" onClick={openScheduler}>Agenda</button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje"
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="send" disabled={!canSend} onClick={send}>→</button>
      </div>

      {showScheduler && (
        <div className="modal-overlay" onClick={() => setShowScheduler(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Agendar reunión</div>
            <label className="modal-label">Fecha y hora</label>
            <input
              className="modal-datetime"
              type="datetime-local"
              value={scheduleValue}
              onChange={(e) => setScheduleValue(e.target.value)}
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowScheduler(false)}>Cancelar</button>
              <button className="btn-confirm" onClick={confirmSchedule}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Chat;


