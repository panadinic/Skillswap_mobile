import API_BASE from "../api";
import { getAuth } from "firebase/auth";

async function authFetch(path, options = {}) {
  const user = getAuth().currentUser;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

export async function likePublication(publicationId) {
  return authFetch("/api/interactions/like", {
    method: "POST",
    body: JSON.stringify({ publicationId }),
  });
}

export async function getMatches() {
  return authFetch("/api/interactions/matches");
}

export async function getMyLikes() {
  return authFetch("/api/interactions/likes");
}
