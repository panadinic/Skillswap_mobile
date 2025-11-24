import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { PublicationCard } from '@/components/publication-card';
import { Publication, publicationsApi } from '@/src/services/api';
import { getMyLikes } from '@/src/services/interactions';

type PublicationState = Publication & { liked?: boolean };

export default function LikesScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<PublicationState[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLikes = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const likedIds = await getMyLikes();
      const all = await publicationsApi.list();
      const likedSet = new Set(likedIds || []);
      const filtered = (all || []).filter((p) => likedSet.has(p.id));
      setPosts(filtered.map((p) => ({ ...p, liked: true })));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar tus likes.');
    } finally {
      silent ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLikes(false);
    }, [loadLikes])
  );

  const showEmpty = useMemo(() => !loading && !error && posts.length === 0, [loading, error, posts]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Tus likes</Text>
        <Text style={styles.subtitle}>Publicaciones que marcaste con corazón.</Text>
        {error ? (
          <View style={styles.stateBox}>
            <Text style={[styles.stateText, { color: '#ffb4b4' }]}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadLikes(false)}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#59f5c9" />
            <Text style={styles.stateText}>Cargando...</Text>
          </View>
        ) : showEmpty ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Aún no tienes publicaciones con like.</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadLikes(true)} tintColor="#fff" />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <PublicationCard
                publication={item}
                liked={true}
                onPressProfile={() => {
                  const uid = (item.authorUid as string) || (item as any).creatorId || null;
                  if (uid) {
                    router.push(`/profile/${uid}`);
                  }
                }}
              />
            )}
          />
        )}
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    color: '#f8fbff',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9aa3c1',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 160,
  },
  stateBox: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#0d162f',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  stateText: {
    color: '#cdd6f6',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#14f195',
  },
  retryText: {
    color: '#032015',
    fontWeight: '700',
  },
});
