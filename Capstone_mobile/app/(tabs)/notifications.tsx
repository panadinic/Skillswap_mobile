import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
  respondMeetingRequest,
} from '@/src/services/notifications';

type UiNotification = NotificationItem & { actionTaken?: 'accepted' | 'rejected' };

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [items, setItems] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastNotifiedIds = useRef<Set<string>>(new Set());
  const permissionsRequested = useRef(false);

  const load = useCallback(async (opts?: { append?: boolean; cursor?: number; silent?: boolean }) => {
    const { append = false, cursor = null, silent = false } = opts || {};
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const data = await getMyNotifications();
      const list = data?.items || [];
      setItems((prev) => (append ? [...prev, ...list] : list));
      setNextCursor(data?.nextCursor ?? null);
      setError(null);

      // Notificar nuevas alertas que antes no estaban
      list.forEach((n: any) => {
        if (!n?.id) return;
        if (!lastNotifiedIds.current.has(n.id)) {
          lastNotifiedIds.current.add(n.id);
          const title = n.title || 'Nueva alerta';
          const body = n.body || n.message || 'Revisa tus notificaciones';
          Notifications.scheduleNotificationAsync({
            content: { title, body },
            trigger: null,
          }).catch(() => {});
        }
      });
    } catch (err: any) {
      setError(err?.message || 'No se pudieron obtener las notificaciones.');
    } finally {
      silent ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!permissionsRequested.current) {
        permissionsRequested.current = true;
        Notifications.requestPermissionsAsync().catch(() => {});
      }
      load(false);
    }, [load])
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const data = await getMyNotifications();
      const list = data?.items || [];
      setItems((prev) => [...prev, ...list]);
      setNextCursor(data?.nextCursor ?? null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron obtener más notificaciones.');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  useEffect(() => {
    // oculta header si llegaran a mostrar stack header
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const onMarkAll = useCallback(async () => {
    if (!items.length) return;
    try {
      setActioning((prev) => ({ ...prev, __all__: 'marking' }));
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })));
    } catch (err: any) {
      setError(err?.message || 'No se pudieron marcar todas como leídas.');
    } finally {
      setActioning((prev) => {
        const { __all__, ...rest } = prev;
        return rest;
      });
    }
  }, [items.length]);

  const markOne = useCallback(async (notificationId: string) => {
    if (!notificationId) return;
    try {
      setActioning((prev) => ({ ...prev, [notificationId]: 'read' }));
      await markNotificationRead(notificationId);
      setItems((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
        )
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo marcar la notificación.');
    } finally {
      setActioning((prev) => {
        const copy = { ...prev };
        delete copy[notificationId];
        return copy;
      });
    }
  }, []);

  const respondMeeting = useCallback(
    async (notification: UiNotification, status: 'accepted' | 'rejected') => {
      if (!notification?.conversationId || !notification?.proposalMessageId) return;
      try {
        setActioning((prev) => ({ ...prev, [notification.id]: status }));
        await respondMeetingRequest({
          conversationId: notification.conversationId,
          proposalMessageId: notification.proposalMessageId,
          status,
          notificationId: notification.id,
        });
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? {
                  ...n,
                  read: true,
                  readAt: new Date().toISOString(),
                  actionTaken: status,
                }
              : n
          )
        );
      } catch (err: any) {
        setError(err?.message || 'No se pudo responder la solicitud.');
      } finally {
        setActioning((prev) => {
          const copy = { ...prev };
          delete copy[notification.id];
          return copy;
        });
      }
    },
    []
  );

  const handleOpen = useCallback(
    (notification: UiNotification) => {
      if (!notification) return;
      if (notification.conversationId) {
        router.push(`/chat/${notification.conversationId}`);
      } else if (notification.matchId || notification.type === 'match') {
        const targetId = notification.matchId || notification.conversationId;
        if (targetId) {
          router.push(`/chat/${targetId}`);
        }
      }
      if (!notification.read) {
        markOne(notification.id);
      }
    },
    [markOne, router]
  );

  const renderActions = (notification: UiNotification) => {
    const busy = Boolean(actioning[notification.id]);
    if (notification.type === 'meeting_request') {
      const hasResponse = notification.actionTaken || notification.readAt;
      if (hasResponse) {
        const flag = notification.actionTaken || 'confirmada';
        return <Text style={styles.tagAccepted}>{flag === 'accepted' ? 'Aceptada' : 'Respondida'}</Text>;
      }
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionPrimary, busy && styles.actionDisabled]}
            onPress={() => respondMeeting(notification, 'accepted')}
            disabled={busy}
          >
            <Text style={styles.actionPrimaryText}>
              {busy && actioning[notification.id] === 'accepted' ? 'Enviando...' : 'Aceptar'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionGhost, busy && styles.actionDisabled]}
            onPress={() => respondMeeting(notification, 'rejected')}
            disabled={busy}
          >
            <Text style={styles.actionGhostText}>
              {busy && actioning[notification.id] === 'rejected' ? 'Enviando...' : 'Rechazar'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (notification.type === 'match' && (notification.matchId || notification.conversationId)) {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.actionPrimary, busy && styles.actionDisabled]}
          onPress={() => handleOpen(notification)}
          disabled={busy}
        >
          <Text style={styles.actionPrimaryText}>Abrir chat</Text>
        </TouchableOpacity>
      );
    }

    if (!notification.read) {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.actionGhost, busy && styles.actionDisabled]}
          onPress={() => markOne(notification.id)}
          disabled={busy}
        >
          <Text style={styles.actionGhostText}>Marcar como leída</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderItem = ({ item }: { item: UiNotification }) => {
    const time = formatDate(item.createdAt);
    const isUnread = !item.read;
    const otherUid = item.otherUser?.uid || null;
    return (
      <TouchableOpacity
        onPress={() => handleOpen(item)}
        activeOpacity={0.85}
        style={[styles.card, isUnread && styles.cardUnread]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title || 'Notificación'}</Text>
            {time ? <Text style={styles.cardDate}>{time}</Text> : null}
          </View>
          <Text style={[styles.pill, isUnread ? styles.pillActive : styles.pillMuted]}>
            {item.type === 'meeting_request'
              ? 'Reunión'
              : item.type === 'match'
              ? 'Match'
              : item.type || 'General'}
          </Text>
        </View>
        {item.message ? <Text style={styles.cardMessage}>{item.message}</Text> : null}
        {otherUid ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: otherUid } })}
            style={styles.otherLink}
          >
            <Text style={styles.otherLinkText}>{item.otherUser?.nombre || 'Ver perfil'}</Text>
          </TouchableOpacity>
        ) : null}
        {renderActions(item)}
      </TouchableOpacity>
    );
  };

  const showEmpty = useMemo(() => !loading && !error && items.length === 0, [error, items.length, loading]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.eyebrow}>Mantente al día</Text>
          <Text style={styles.screenTitle}>Notificaciones</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.markAllButton,
            (!items.length || actioning.__all__) && styles.actionDisabled,
          ]}
          disabled={!items.length || Boolean(actioning.__all__)}
          onPress={onMarkAll}
        >
          <Text style={styles.markAllText}>
            {actioning.__all__ ? 'Marcando...' : 'Marcar todas'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color="#59f5c9" />
          <Text style={styles.stateText}>Cargando notificaciones...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={[styles.stateText, { color: '#ff9a9a' }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load(false)}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : showEmpty ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>No tienes notificaciones pendientes.</Text>
        </View>
      ) : (
        <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
              tintColor="#fff"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030215',
    paddingTop: 12,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  eyebrow: {
    color: '#9ae6ff',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  screenTitle: {
    color: '#f8fbff',
    fontSize: 24,
    fontWeight: '700',
  },
  markAllButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#11213d',
  },
  markAllText: {
    color: '#d7e4ff',
    fontWeight: '700',
  },
  stateBox: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: '#0b122a',
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  stateText: {
    color: '#cdd6f6',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#14f195',
    marginTop: 8,
  },
  retryText: {
    color: '#042014',
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    backgroundColor: '#0b122a',
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#162246',
    gap: 10,
  },
  cardUnread: {
    borderColor: '#13f5a3',
    shadowColor: '#13f5a3',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    color: '#f7fbff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardDate: {
    color: '#8ea0c7',
    marginTop: 4,
    fontSize: 12,
  },
  cardMessage: {
    color: '#cdd6f6',
    lineHeight: 20,
  },
  otherLink: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#132241',
  },
  otherLinkText: {
    color: '#a8c7ff',
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
  },
  pillActive: {
    backgroundColor: '#14f195',
    color: '#032417',
  },
  pillMuted: {
    backgroundColor: '#132241',
    color: '#a9b9dc',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: '#14f195',
  },
  actionPrimaryText: {
    color: '#042014',
    fontWeight: '700',
  },
  actionGhost: {
    borderWidth: 1,
    borderColor: '#22345a',
    backgroundColor: '#0f1a34',
  },
  actionGhostText: {
    color: '#d1dcff',
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.6,
  },
  tagAccepted: {
    marginTop: 4,
    color: '#10f5a7',
    fontWeight: '700',
  },
});
