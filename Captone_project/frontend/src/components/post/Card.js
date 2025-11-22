// src/components/post/Card.js
import React, { useState } from "react";
import { FaHeart, FaStar } from "react-icons/fa";
import "./Card.css";
import { DEFAULT_AVATAR } from "../../utils/placeholders";

function Card({
    imageUrl,
    title,
    description,
    rating = 0,
    liked,
    onLike,
    onViewProfile,
    authorName,
    authorUid,
}) {
    const isControlled = typeof liked === "boolean";
    const [likedLocal, setLikedLocal] = useState(false);
    const isLiked = isControlled ? liked : likedLocal;

    const toggleLike = () => {
        if (!isControlled) setLikedLocal((v) => !v);
        onLike?.(!isLiked);
    };

    return (
        <article className="card">
            <div className="card__row">
                <img
                    className="card__img"
                    src={imageUrl || DEFAULT_AVATAR}
                    alt={title || "perfil"}
                    onError={(e) =>
                        (e.currentTarget.src = DEFAULT_AVATAR)
                    }
                />

                <div className="card__body">
                    <header className="card__header">
                        <div className="card__rating">
                            <FaStar size={12} className="card__ratingIcon" />
                            <span className="card__ratingText">{Number(rating).toFixed(1)}</span>
                        </div>
                        <h3 className="card__title">{title || "SIN NOMBRE"}</h3>
                    </header>

                    <p className="card__desc">{description || "Sin descripción disponible"}</p>

                    <div className="card__actions">
                        <button
                            className="card__viewBtn"
                            onClick={onViewProfile}
                            style={{ fontWeight: 'bold' }}
                        >
                            {authorName || 'Ver perfil'}
                        </button>

                        <button
                            className={`card__likePill ${isLiked ? "is-liked" : ""}`}
                            onClick={toggleLike}
                            aria-label={isLiked ? "Quitar de favoritos" : "Agregar a favoritos"}
                        >
                            <FaHeart className="card__likeIcon" />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    );
}

export default Card;
