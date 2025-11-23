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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { PublicationCard } from '@/components/publication-card';
import { Publication, publicationsApi } from '@/src/services/api';
import { getMyLikes, sendLike } from '@/src/services/interactions';
import { logout } from '@/src/services/auth';
import { auth } from '@/src/services/firebase';
import { MatchModal } from '@/components/MatchModal';

type PublicationState = Publication & { liked?: boolean };

export default function HomeScreen() {
  const router = useRouter();
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
  const [matchModal, setMatchModal] = useState<{
    visible: boolean;
    matchId: string | null;
    otherUserName: string;
    otherUserPhoto: string | null;
  }>({ visible: false, matchId: null, otherUserName: '', otherUserPhoto: null });

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

  useEffect(() => {
    setPosts(rawPosts.map((post) => ({ ...post, liked: !!likedMap[post.id] })));
  }, [rawPosts, likedMap]);

  const handleRefresh = useCallback(() => {
    loadLikes();
    loadPosts(true);
  }, [loadLikes, loadPosts]);

  useFocusEffect(
    useCallback(() => {
      loadLikes();
      loadPosts(false);
    }, [loadLikes, loadPosts])
  );

  // Si se cierra sesión (Firebase) redirige al login
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setAuthReady(true);
      if (!user) {
        router.replace('/');
      }
    });
    return () => unsub();
  }, [router]);

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
      <View style={styles.container}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
          }
          ListHeaderComponent={
            <View style={styles.hero}>
              <View style={styles.heroHeader}>
                <View style={styles.brandCircle}>
                  <Text style={styles.brandInitials}>SS</Text>
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.brandTitle}>Tu feed SkillSwap</Text>
                  <Text style={styles.brandSubtitle}>
                    Revisa las últimas publicaciones y encuentra matches.
                  </Text>
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
          renderItem={({ item }) => (
            <PublicationCard
              publication={item}
              liked={item.liked}
              onToggleLike={() => handleLike(item)}
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
          )}
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
  },
  container: {
    flex: 1,
    backgroundColor: '#040315',
  },
  listContent: {
    paddingBottom: 40,
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
  },
  brandCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#00dc8d',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00dc8d',
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  brandInitials: {
    color: '#041a18',
    fontWeight: '800',
    fontSize: 18,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  brandTitle: {
    color: '#f7fbff',
    fontSize: 22,
    fontWeight: '700',
  },
  brandSubtitle: {
    color: '#9da6be',
    fontSize: 13,
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
