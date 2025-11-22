import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { FaHome, FaHeart, FaBell, FaUser } from "react-icons/fa";
import PostButton from "./PostButton";
import "./BottomBar.css";
import { getNotifications } from "../services/notifications";
import { getMatches } from "../services/interactions";

export default function BottomBar() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  const refreshNotifications = async () => {
    try {
      const data = await getNotifications();
      const items = Array.isArray(data) ? data : [];
      setUnreadCount(items.filter((n) => !n.read).length);
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    }
  };

  const refreshChats = async () => {
    try {
      const data = await getMatches();
      const user = getAuth().currentUser;
      const uid = user?.uid;
      if (!uid) return;
      const count = (Array.isArray(data) ? data : []).reduce((acc, match) => {
        const lastMessageAt = match.lastMessageAt ? Date.parse(match.lastMessageAt) : 0;
        const lastSeenRaw = match.lastSeenBy?.[uid];
        const lastSeen = lastSeenRaw ? Date.parse(lastSeenRaw) : 0;
        if (lastMessageAt && lastMessageAt > lastSeen) return acc + 1;
        return acc;
      }, 0);
      setUnreadChats(count);
    } catch (error) {
      console.error("Error cargando chats:", error);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      await refreshNotifications();
    };
    load();
    const interval = setInterval(load, 60000);
    const handler = () => load();
    window.addEventListener("notifications-updated", handler);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("notifications-updated", handler);
    };
  }, []);

  useEffect(() => {
    refreshChats();
    const interval = setInterval(refreshChats, 60000);
    const handler = () => refreshChats();
    window.addEventListener("chats-updated", handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("chats-updated", handler);
    };
  }, []);

  const goToMyProfile = () => {
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      navigate(`/profile/${uid}`);
    } else {
      navigate(`/profile`);
    }
  };

  return (
    <div className="bottombar">
      <NavLink
        to="/"
        className={({ isActive }) => `bb-link ${isActive ? "active" : ""}`}
      >
        <FaHome size={22} />
      </NavLink>

      <NavLink
        to="/likes"
        className={({ isActive }) => `bb-link ${isActive ? "active" : ""}`}
      >
        <FaHeart size={22} />
        {unreadChats > 0 && <span className="bb-badge small">{unreadChats > 9 ? "9+" : unreadChats}</span>}
      </NavLink>

      <NavLink
        to="/notifications"
        className={({ isActive }) => `bb-link notifications-btn ${isActive ? "active" : ""}`}
      >
        <FaBell size={22} />
        {unreadCount > 0 && <span className="bb-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </NavLink>

      <button
        type="button"
        onClick={goToMyProfile}
        className="bb-link"
        aria-label="Mi perfil"
        title="Mi perfil"
      >
        <FaUser size={22} />
      </button>

      {/* FAB centrado */}
      <PostButton onClick={() => navigate("/registro/ConOfre")} />
    </div>
  );
}
