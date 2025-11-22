import PostCard from "./PostCard";

export default function PostList({ posts = [], onLike, onViewProfile }) {
    if (!posts.length) {
        return (
            <div style={{ textAlign: "center", color: "#666" }}>
                Aun no hay publicaciones.
            </div>
        );
    }
    return posts.map((p) => (
        <PostCard
            key={p.id}
            post={p}
            onLike={(nextLiked) => onLike?.(p, nextLiked)}
            onViewProfile={() => onViewProfile?.(p)}
        />
    ));
}

