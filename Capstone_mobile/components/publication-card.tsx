import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Publication } from '@/src/services/api';

type Props = {
  publication: Publication;
  liked?: boolean;
  onToggleLike?: () => void;
  onPressProfile?: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
};

const fallbackAvatar =
  'https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=SkillSwap';

const parseDate = (value: Publication['fechaCreacion']): Date | null => {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const seconds = value._seconds ?? (value as any).seconds;
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000);
  }
  return null;
};

const timeAgo = (date: Date | null) => {
  if (!date) return 'Sin fecha';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Recien publicado';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} m`;
  const years = Math.floor(months / 12);
  return `${years} a`;
};

const cleanTag = (value: string) =>
  value?.replace(/^(teach:|learn:)/i, '').trim() || value;

const renderTags = (title: string, tags?: string[]) => {
  if (!tags || tags.length === 0) return null;
  return (
    <View style={styles.tagRow}>
      <Text style={styles.tagLabel}>{title}</Text>
      <View style={styles.chips}>
        {tags.slice(0, 4).map((tag) => (
          <View key={`${title}-${tag}`} style={styles.chip}>
            <Text style={styles.chipText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export function PublicationCard({ publication, liked, onToggleLike, onPressProfile, onDelete, isOwner }: Props) {
  const authorName =
    publication.authorName ||
    publication.creatorInfo?.nombre ||
    'Perfil sin nombre';
  const avatar =
    publication.authorPhotoURL ||
    publication.creatorInfo?.fotoUrl ||
    fallbackAvatar;
  const authorUid = publication.authorUid || (publication as any).creatorId || null;

  const description =
    publication.content ||
    publication.descripcion ||
    'Sin descripcion disponible.';

  const title =
    publication.title ||
    publication.titulo ||
    'Publicacion sin titulo';

  const teachTags = (publication.tags || [])
    .filter((t) => !/^learn:/i.test(t))
    .map(cleanTag);
  const learnTags: string[] = [];
  const ratingValue =
    typeof publication.ratingAvg === 'number' && !Number.isNaN(publication.ratingAvg)
      ? publication.ratingAvg
      : 0;
  const ratingLabel = ratingValue.toFixed(1);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => onPressProfile?.()}
          disabled={!onPressProfile || !authorUid}
        >
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.headerText}>
            <Text style={styles.author}>{authorName}</Text>
            <Text style={styles.dateText}>{timeAgo(parseDate(publication.fechaCreacion))}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <View style={styles.rating}>
            <Text style={styles.ratingText}>★ {ratingLabel}</Text>
          </View>
          {isOwner && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={onDelete}
            >
              <Ionicons name="trash" size={18} color="#ff6b7a" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.likeButton, liked && styles.likeButtonActive]}
            onPress={onToggleLike}
            disabled={liked}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={18}
              color={liked ? '#fff' : '#f472b6'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cover}>
        {publication.imageUrl ? (
          <Image source={{ uri: publication.imageUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={24} color="#9ca3af" />
            <Text style={styles.coverPlaceholderText}>Sin imagen</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description} numberOfLines={3}>
        {description}
      </Text>

      {renderTags('Enseno:', teachTags)}
      {renderTags('Busco:', learnTags)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#111827',
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1f2937',
  },
  headerText: {
    flexShrink: 1,
  },
  author: {
    color: '#f3f4f6',
    fontWeight: '600',
    fontSize: 16,
  },
  dateText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  rating: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  ratingText: {
    color: '#fcd34d',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f472b6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  likeButtonActive: {
    backgroundColor: '#f472b6',
    borderColor: '#f472b6',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ff6b7a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0b1220',
    marginTop: 6,
    marginBottom: 6,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0b1220',
  },
  coverPlaceholderText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  title: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: '#d1d5db',
    fontSize: 15,
    lineHeight: 20,
  },
  tagRow: {
    marginTop: 4,
  },
  tagLabel: {
    color: '#cbd5f5',
    fontSize: 13,
    marginBottom: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    color: '#e5e7eb',
    fontSize: 12,
  },
});
