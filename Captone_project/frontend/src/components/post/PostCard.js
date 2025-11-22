// src/components/post/PostCard.js
import React from "react";
import Card from "../post/Card";
import { useAuthorName } from "../../hooks/useAuthorName";
import { DEFAULT_AVATAR } from "../../utils/placeholders";

export default function PostCard({ post, onLike, onViewProfile }) {
    const { authorName } = useAuthorName(post);

    if (!post) return null;

    return (
        <Card
            imageUrl={post.imageUrl || post.creatorInfo?.fotoUrl || DEFAULT_AVATAR}
            title={post.title || post.titulo}
            description={post.content || post.descripcion}
            rating={post.ratingAvg ?? post.rating ?? 0}
            liked={post.liked}
            onLike={onLike}
            onViewProfile={() => onViewProfile?.(post)}
            authorName={authorName}
            authorUid={post.authorUid || post.creatorId}
        />
    );
}
