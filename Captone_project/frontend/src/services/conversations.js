import API_BASE from "../api";
import { getAuth } from "firebase/auth";

export async function markConversationSeen(conversationId) {
    const user = getAuth().currentUser;
    if (!user) throw new Error('No hay usuario autenticado');
    const idToken = await user.getIdToken();

    const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/seen`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${idToken}`,
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'No se pudo marcar la conversación');
    return data;
}

