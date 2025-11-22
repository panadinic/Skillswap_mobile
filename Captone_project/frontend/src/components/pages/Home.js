// src/components/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PostList from "../post/PostList";
import "./Home.css";
import LogoutButton from "../common/LogoutButton";
import SyncButton from "../common/SyncButton";
import { fetchPublications, searchPublications } from "../../services/publications";
import { likePublication, getMyLikes } from "../../services/interactions";
import { toast } from "../../utils/toast";

export default function Home() {
  const navigate = useNavigate();
  const [rawPosts, setRawPosts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [likedMap, setLikedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const likedIds = await getMyLikes();
        if (!active) return;
        const map = {};
        (likedIds || []).forEach((id) => {
          if (id) map[id] = true;
        });
        setLikedMap(map);
      } catch (err) {
        console.error("[HOME] No se pudieron cargar likes:", err);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = debouncedQuery
          ? await searchPublications(debouncedQuery)
          : await fetchPublications();
        if (!active) return;
        setRawPosts(data || []);
      } catch (err) {
        console.error("[HOME] Error fetching posts:", err);
        if (active) setError(err.message || "No se pudo obtener el feed");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    setPosts((rawPosts || []).map((post) => ({ ...post, liked: !!likedMap[post.id] })));
  }, [rawPosts, likedMap]);

  const handleLike = async (post, nextLiked) => {
    if (!nextLiked || likedMap[post.id]) return;
    try {
      const res = await likePublication(post.id);
      setLikedMap((prev) => ({ ...prev, [post.id]: true }));
      if (res?.matched) {
        toast.success("Tienen un match!");
      } else {
        toast.info("Like enviado");
      }
    } catch (err) {
      toast.error(err.message || "No se pudo enviar el like");
    }
  };

  const showEmptyState = !loading && !error && posts.length === 0;

  return (
    <div className="home">
      <header className="home__header">
        <div className="home__brand">SS</div>
        <input
          className="home__search"
          placeholder="Que te interesa?"
          aria-label="Buscar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <main className="home__content">
        <div style={{ padding: "12px 16px", display: "flex", gap: "8px", alignItems: "center" }}>
          <LogoutButton />
          {process.env.REACT_APP_SHOW_SYNC_BUTTON === "true" && <SyncButton />}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
            {debouncedQuery ? "Buscando coincidencias..." : "Cargando publicaciones..."}
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "20px", color: "#d33" }}>
            Error: {error}
          </div>
        )}

        {showEmptyState && (
          <div style={{ textAlign: "center", padding: "20px", color: "#a4b0ff" }}>
            {debouncedQuery
              ? `No encontramos resultados para "${debouncedQuery}".`
              : "Todavia no hay publicaciones."}
          </div>
        )}

        {posts.length > 0 && (
          <PostList
            posts={posts}
            onLike={handleLike}
            onViewProfile={(post) => {
              const authorUid = post.authorUid || post.creatorId;
              if (authorUid) {
                navigate(`/profile/${authorUid}`);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
