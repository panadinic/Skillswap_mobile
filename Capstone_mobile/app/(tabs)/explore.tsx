import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { DEFAULT_AVATAR } from '@/constants/images';
import { getMatches, MatchSummary } from '@/src/services/interactions';
import { auth } from '@/src/services/firebase';
// Removed duplicate import

export default function MatchesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getMatches();
      setMatches(data || []);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron obtener los matches.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const parent: any = navigation.getParent?.();
      if (parent?.setOptions) {
        parent.setOptions({ tabBarStyle: { display: 'none' } });
      }
      loadMatches();
      return () => {
        if (parent?.setOptions) parent.setOptions({ tabBarStyle: undefined });
      };
    }, [loadMatches, navigation])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  }, [loadMatches]);

  const currentUid = auth.currentUser?.uid ?? null;

  const parseTs = (value?: string | null) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const renderState = () => {
    if (loading) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator color="#59f5c9" />
          <Text style={styles.stateText}>Cargando matches...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.stateBox}>
          <Text style={[styles.stateText, { color: '#ffb4b4' }]}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMatches}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!matches.length) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Aun no tienes matches.</Text>
        </View>
      );
    }
    return null;
  };

  const renderMatch = (match: MatchSummary) => {
    const other =
      match.other ||
      (match.userA && match.userA.uid !== currentUid ? match.userA : match.userB) ||
      match.userA ||
      match.userB ||
      null;

    const lastMessageAt = parseTs(match.lastMessageAt || null);
    const lastSeenRaw = currentUid ? match.lastSeenBy?.[currentUid] : null;
    const lastSeen = parseTs(lastSeenRaw || null);
    const hasUnread = Boolean(currentUid && lastMessageAt && lastMessageAt > lastSeen);

    const avatarSource = other?.fotoUrl ? { uri: other.fotoUrl } : { uri: DEFAULT_AVATAR };
    const displayName = other?.nombre || 'Usuario';
    const otherUid = other?.uid || match.users?.find((u) => u !== currentUid) || null;

    return (
      <View key={match.id} style={[styles.matchCard, hasUnread && styles.matchCardUnread]}>
        <TouchableOpacity
          style={styles.matchInfo}
          activeOpacity={0.8}
          onPress={() => {
            if (otherUid) {
              router.push({ pathname: '/profile/[userId]', params: { userId: otherUid } });
            }
          }}
        >
          <Image source={avatarSource} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.matchName}>{displayName}</Text>
            {match.lastMessageText ? (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {match.lastMessageText}
              </Text>
            ) : (
              <Text style={styles.matchId}> </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.matchActions}>
          {hasUnread ? <Text style={styles.unreadBadge}>Nuevo mensaje</Text> : null}
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => router.push(`/chat/${match.id}`)}
          >
            <Text style={styles.chatButtonText}>Chatear</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
              <Ionicons name="chevron-back" size={22} color="#14f195" />
            </TouchableOpacity>
            <Text style={styles.title}>Chats</Text>
          </View>
          <Text style={styles.eyebrow}>Conexiones desbloqueadas</Text>
        </View>

        {renderState()}

        {matches.map(renderMatch)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#03021a',
  },
  container: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 20,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    color: '#9ae6ff',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: '#f8fbff',
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9aa3c5',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  backButtonText: {
    color: '#14f195',
    fontWeight: '700',
  },
  stateBox: {
    borderRadius: 20,
    backgroundColor: '#08122c',
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  stateText: {
    color: '#cdd4f7',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#14f195',
  },
  retryButtonText: {
    color: '#022314',
    fontWeight: '700',
  },
  matchCard: {
    borderRadius: 24,
    backgroundColor: '#08122c',
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#13234a',
    gap: 12,
  },
  matchCardUnread: {
    borderColor: '#2ff5b5',
    shadowColor: '#2ff5b5',
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#13f195',
  },
  matchName: {
    color: '#f6fbff',
    fontSize: 18,
    fontWeight: '700',
  },
  matchId: {
    color: '#7c8cb8',
    marginTop: 4,
  },
  matchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadBadge: {
    color: '#10f5a7',
    fontWeight: '700',
  },
  chatButton: {
    backgroundColor: '#14f195',
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  chatButtonText: {
    color: '#032617',
    fontWeight: '700',
  },
});
