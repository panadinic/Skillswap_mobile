import API_BASE from "../api";
import { getAuth } from "firebase/auth";

export async function getMyCalendar() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  const idToken = await user.getIdToken();
  const res = await fetch(`${API_BASE}/api/calendar/events`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudieron obtener los eventos');
  return data;
}

export async function createCalendarEventFromSchedule({ conversationId, proposalMessageId }) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  const idToken = await user.getIdToken();
  const res = await fetch(`${API_BASE}/api/calendar/events/from-schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ conversationId, proposalMessageId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo crear el evento');
  return data; // { created, id, ... }
}

export async function cancelCalendarEvent(eventId) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  const idToken = await user.getIdToken();
  const res = await fetch(`${API_BASE}/api/calendar/events/${eventId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'No se pudo cancelar el evento');
  return data; // { cancelled: true }
}
