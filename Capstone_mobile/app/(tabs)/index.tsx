import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { PublicationCard } from '@/components/publication-card';
import { Publication, publicationsApi } from '@/src/services/api';
import { getMyLikes, sendLike } from '@/src/services/interactions';
import { logout } from '@/src/services/auth';
import { auth } from '@/src/services/firebase';
import { MatchModal } from '@/components/MatchModal';
import { env } from '@/src/config/env';
import { getAuthToken } from '@/src/services/auth';
import { getMatches } from '@/src/services/interactions';

type PublicationState = Publication & { liked?: boolean };

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rawPosts, setRawPosts] = useState<Publication[]>([]);
  const [posts, setPosts] = useState<PublicationState[]>([]);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [viewerUid, setViewerUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [preferredTags, setPreferredTags] = useState<string[]>([]);
  const [matchModal, setMatchModal] = useState<{
    visible: boolean;
    matchId: string | null;
    otherUserName: string;
    otherUserPhoto: string | null;
  }>({ visible: false, matchId: null, otherUserName: '', otherUserPhoto: null });
  const [unreadChats, setUnreadChats] = useState(0);

  // Usa icon.png por defecto; cambia a logo-s-glow.png cuando el archivo exista
  const brandLogo = useMemo(() => require('../../assets/images/icon.png'), []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadLikes = useCallback(async () => {
    try {
      const likedIds = await getMyLikes();
      const map: Record<string, boolean> = {};
      (likedIds || []).forEach((id) => {
        if (id) map[id] = true;
      });
      setLikedMap(map);
    } catch (err) {
      console.warn('[mobile] No se pudieron cargar likes', err);
    }
  }, []);

  const loadPosts = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const data = debouncedQuery
          ? await publicationsApi.search(debouncedQuery)
          : await publicationsApi.list();
        setRawPosts(data || []);
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'No se pudo obtener el feed.');
      } finally {
        silent ? setRefreshing(false) : setLoading(false);
      }
    },
    [debouncedQuery]
  );

  const loadPreferredTags = useCallback(async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const token = await getAuthToken();
      if (!token) return;
      // Intentar /me primero para mantener consistencia con backend
      const res = await fetch(`${env.apiUrl}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const fallback = !res.ok
        ? await fetch(`${env.apiUrl}/api/users/${uid}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null)
        : null;
      const payload = res.ok ? await res.json() : await fallback?.json().catch(() => null);

      const extractTags = (data: any) => {
        if (!data) return [];
        const candidates = [
          data.interestTags,
          data.intereses,
          data.preferencias,
          data.interests,
          data.tagsPreferidos,
        ];
        for (const c of candidates) {
          if (Array.isArray(c)) return c;
          if (typeof c === 'string') return c.split(',').map((s) => s.trim());
        }
        return [];
      };

      const tags = extractTags(payload);
      if (Array.isArray(tags)) {
        setPreferredTags(tags.filter(Boolean));
      }
    } catch (err) {
      console.warn('[home] no se pudieron cargar preferencias', err);
    }
  }, []);

  useEffect(() => {
    const normalize = (values?: string[]) =>
      (values || []).map((t) => t?.toUpperCase?.().trim()).filter(Boolean);

    const filterByPreferences = (items: Publication[]) => {
      const prefs = normalize(preferredTags || []);
      const myUid = viewerUid || auth.currentUser?.uid || null;
      if (!prefs.length && !myUid) return items;
      return items.filter((post) => {
        const tags = normalize(post.tags).concat(normalize(post.interestTags));
        if (!tags.length) return false;
        if (myUid) {
          const owner =
            (post as any).creatorId || (post as any).authorUid || (post as any).authorId || null;
          if (owner && owner === myUid) return false;
        }
        if (!prefs.length) return true;
        return tags.some((t) => prefs.includes(t));
      });
    };

    const filtered = filterByPreferences(rawPosts);
    const visible = filtered.filter((post) => !likedMap[post.id]);
    setPosts(visible.map((post) => ({ ...post, liked: !!likedMap[post.id] })));
  }, [rawPosts, likedMap, preferredTags, viewerUid]);

  const handleRefresh = useCallback(() => {
    loadLikes();
    loadPosts(true);
    loadPreferredTags();
  }, [loadLikes, loadPosts, loadPreferredTags]);

  useFocusEffect(
    useCallback(() => {
      loadLikes();
      loadPosts(false);
      loadPreferredTags();
      (async () => {
        try {
          const matches = await getMatches();
          const uid = auth.currentUser?.uid;
          if (!uid) {
            setUnreadChats(0);
            return;
          }
          const unreadCount = (matches || []).filter((m) => {
            const lastMessageAt = m.lastMessageAt ? Date.parse(m.lastMessageAt) : 0;
            const lastSeen = m.lastSeenBy?.[uid] ? Date.parse(m.lastSeenBy[uid] as string) : 0;
            return lastMessageAt && lastMessageAt > lastSeen;
          }).length;
          setUnreadChats(unreadCount);
        } catch (err) {
          // ignore
        }
      })();
    }, [loadLikes, loadPosts, loadPreferredTags])
  );

  // Si se cierra sesión (Firebase) redirige al login
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user?.uid) setViewerUid(user.uid);
      setAuthReady(true);
      if (!user) {
        router.replace('/');
      } else {
        loadPreferredTags();
      }
    });
    return () => unsub();
  }, [router, loadPreferredTags]);

  const handleLike = useCallback(
    async (publication: PublicationState) => {
      if (likedMap[publication.id]) return;
      try {
        const res = await sendLike(publication.id);
        setLikedMap((prev) => ({ ...prev, [publication.id]: true }));
        if (res?.matched && res?.matchId) {
          const otherName = publication.creatorInfo?.nombre || publication.authorName || 'Usuario';
          const otherPhoto = publication.creatorInfo?.fotoUrl || publication.authorPhotoURL || null;
          setMatchModal({
            visible: true,
            matchId: res.matchId,
            otherUserName: otherName,
            otherUserPhoto: otherPhoto,
          });
        } else {
          Alert.alert('Like enviado', 'Avisamos a la otra persona para que revise tu perfil.');
        }
      } catch (err: any) {
        Alert.alert('No se pudo enviar el like', err?.message || 'Intenta nuevamente.');
      }
    },
    [likedMap]
  );

  const handleLogout = async () => {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      await logout();
      router.replace('/');
      // Fallback para web si el estado de navegación queda pegado
      if (Platform.OS === 'web') {
        setTimeout(() => {
          router.replace('/');
          // Forzar reload para limpiar navegación en SPA
          window.location.href = '/';
        }, 20);
      }
    } catch (err: any) {
      Alert.alert('No se pudo cerrar sesion', err?.message || 'Intenta nuevamente.');
    } finally {
      setLoggingOut(false);
    }
  };

  const showEmpty = useMemo(() => !loading && !error && posts.length === 0, [loading, error, posts]);

  return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 100 }]}>
        <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
            }
            ListHeaderComponent={
            <View style={styles.hero}>
              <View style={styles.heroHeader}>
                <View style={styles.heroText}>
                  <Text style={styles.brandTitle}>Skillswap</Text>
                </View>
                <View style={styles.heroActions}>
                  <TouchableOpacity
                    onPress={() => router.push('/explore')}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel="Abrir chat"
                  >
                    <Ionicons name="chatbubbles" size={18} color="#14f195" />
                    {unreadChats > 0 && (
                      <View style={styles.chatBadge}>
                        <Text style={styles.chatBadgeText}>{unreadChats > 9 ? '9+' : unreadChats}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="¿Qué te interesa?"
                placeholderTextColor="#a4adc4"
                value={query}
                onChangeText={setQuery}
              />
            </View>
          }
          ListEmptyComponent={
            showEmpty ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Todavía no hay publicaciones.</Text>
                <Text style={styles.emptySubtitle}>Cuando aparezcan nuevas propuestas las verás aquí.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isOwner = viewerUid === ((item as any).authorUid || (item as any).creatorId);
            return (
              <PublicationCard
                publication={item}
                liked={item.liked}
                isOwner={isOwner}
                onToggleLike={() => handleLike(item)}
                onDelete={() => {
                  Alert.alert(
                    'Eliminar publicación',
                    '¿Estás seguro?',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const token = await getAuthToken();
                            if (!token) throw new Error('No autenticado');
                            const res = await fetch(`${env.apiUrl}/api/publications/${item.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!res.ok) throw new Error('No se pudo eliminar');
                            setRawPosts(rawPosts.filter(p => p.id !== item.id));
                            Alert.alert('Éxito', 'Publicación eliminada');
                          } catch (err: any) {
                            Alert.alert('Error', err?.message || 'No se pudo eliminar');
                          }
                        },
                      },
                    ]
                  );
                }}
                onPressProfile={() => {
                  const targetUid = (item as any).authorUid || (item as any).creatorId;
                  if (targetUid) {
                    router.push({
                      pathname: '/profile/[userId]',
                      params: { userId: targetUid },
                    });
                  }
                }}
              />
            );
          }}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>
              {debouncedQuery ? 'Buscando coincidencias...' : 'Cargando publicaciones...'}
            </Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadPosts(false)}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        <MatchModal
          visible={matchModal.visible}
          onClose={() => setMatchModal({ visible: false, matchId: null, otherUserName: '', otherUserPhoto: null })}
          onOpenChat={() => {
            setMatchModal({ visible: false, matchId: null, otherUserName: '', otherUserPhoto: null });
            if (matchModal.matchId) {
              router.push(`/chat/${matchModal.matchId}`);
            }
          }}
          otherUserName={matchModal.otherUserName}
          otherUserPhoto={matchModal.otherUserPhoto}
          myPhoto={auth.currentUser?.photoURL || null}
        />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
    paddingBottom: 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#040315',
    paddingBottom: 100,
  },
  listContent: {
    paddingBottom: 20,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  brandCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  brandTitle: {
    color: '#14f195',
    fontSize: 18,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#9da6be',
    fontSize: 13,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#14f195',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  chatBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff6b7a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#0b1220',
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  logoutButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ff7441',
    shadowColor: '#ff7441',
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  searchInput: {
    borderRadius: 14,
    backgroundColor: '#101b3c',
    borderWidth: 1,
    borderColor: '#1f2f59',
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#f8fafc',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#020617d9',
    gap: 8,
  },
  loadingText: {
    color: '#f1f5f9',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#b91c1c',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f97316',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
    gap: 6,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#94a3b8',
    textAlign: 'center',
  },
});
