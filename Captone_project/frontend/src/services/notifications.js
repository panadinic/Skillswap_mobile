// src/services/notifications.js
import API_BASE from "../api";
import { getAuth } from "firebase/auth";

async function authFetch(path, options = {}) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario autenticado");
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Error ${res.status}`);
  }
  return res.json();
}

export function getNotifications() {
  return authFetch("/api/notifications");
}

export function markNotificationRead(id) {
  return authFetch(`/api/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return authFetch("/api/notifications/mark-all/read", { method: "POST" });
}

export function createMeetingRequestNotification(payload) {
  return authFetch("/api/notifications/meeting-request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function respondMeetingRequest(payload) {
  return authFetch("/api/notifications/meeting-request/respond", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
