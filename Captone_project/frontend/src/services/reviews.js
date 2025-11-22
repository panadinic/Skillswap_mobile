// src/services/reviews.js
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

export function getReviewsByPost(postId) {
  return authFetch(`/api/reviews/post/${postId}`);
}

export function createReview({ postId, rating, comment }) {
  return authFetch("/api/reviews", {
    method: "POST",
    body: JSON.stringify({ postId, rating, comment }),
  });
}

