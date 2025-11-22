import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Notifications.css";
import { getNotifications, markAllNotificationsRead, respondMeetingRequest } from "../../services/notifications";
import { DEFAULT_AVATAR } from "../../utils/placeholders";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getNotifications();
        if (!active) return;
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);
        if (arr.some((n) => !n.read)) {
          try {
            await markAllNotificationsRead();
            window.dispatchEvent(new Event("notifications-updated"));
            setItems((prev) => prev.map((n) => ({ ...n, read: true })));
          } catch (err) {
            console.error("No se pudieron marcar las notificaciones:", err);
          }
        }
      } catch (err) {
        if (active) setError(err.message || "No se pudieron obtener las notificaciones.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const formatEventDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  };

  const handleMeetingResponse = async (notif, status) => {
    if (!notif?.conversationId || !notif?.proposalMessageId) return;
    setActioningId(notif.id);
    try {
      await respondMeetingRequest({
        notificationId: notif.id,
        conversationId: notif.conversationId,
        proposalMessageId: notif.proposalMessageId,
        status,
      });
      setItems((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, actionTaken: status } : n))
      );
      window.dispatchEvent(new Event("notifications-updated"));
      if (status === "accepted") {
        window.dispatchEvent(new Event("calendar-updated"));
      }
    } catch (err) {
      console.error("No se pudo responder la solicitud:", err);
      window.alert(err.message || "No se pudo actualizar la solicitud.");
    } finally {
      setActioningId("");
    }
  };

  return (
    <div className="notifications-page">
      <div className="notifications-card">
        <header className="notifications-page__header">
          <h1>Notificaciones</h1>
          <p>Resumen de tus reuniones, resenas y recordatorios.</p>
        </header>
        <main className="notifications-page__content">
          {loading && <p className="notifications-page__state">Cargando...</p>}
          {error && <p className="notifications-page__state error">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="notifications-page__state">No tienes notificaciones.</p>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="notifications-feed">
              {items.map((notif) => {
                const avatar = notif.otherUser?.fotoUrl || DEFAULT_AVATAR;
                const otherName = notif.otherUser?.nombre || "";
                const otherUid = notif.otherUser?.uid;
                const handleAvatarClick = () => {
                  if (!otherUid) return;
                  navigate(`/profile/${otherUid}`);
                };
                return (
                  <li key={notif.id} className="notifications-feed__item">
                    <div className="notif-info">
                      <div className="notif-title">{notif.title || notif.type || "Notificacion"}</div>
                      {notif.message && <div className="notif-message">{notif.message}</div>}
                      {notif.type === "meeting_request" && notif.eventAt && (
                        <div className="notif-date">
                          Fecha propuesta: {formatEventDate(notif.eventAt)}
                        </div>
                      )}
                      {notif.type === "meeting_request" && (
                        <div className="notif-actions">
                          {notif.actionTaken ? (
                            <span
                              className={`notif-pill ${
                                notif.actionTaken === "accepted" ? "is-accepted" : "is-rejected"
                              }`}
                            >
                              {notif.actionTaken === "accepted" ? "Solicitud aceptada" : "Solicitud rechazada"}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="notif-btn"
                                disabled={actioningId === notif.id}
                                onClick={() => handleMeetingResponse(notif, "accepted")}
                              >
                                Aceptar
                              </button>
                              <button
                                type="button"
                                className="notif-btn notif-btn--ghost"
                                disabled={actioningId === notif.id}
                                onClick={() => handleMeetingResponse(notif, "rejected")}
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {notif.createdAt && (
                        <div className="notif-date">
                          {new Date(notif.createdAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="notif-avatarBtn"
                      onClick={handleAvatarClick}
                      disabled={!otherUid}
                      title={otherUid ? `Ver perfil de ${otherName || "usuario"}` : undefined}
                    >
                      <img
                        className="notif-avatar"
                        src={avatar}
                        alt={otherName || "usuario"}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
