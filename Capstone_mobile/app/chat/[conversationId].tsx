import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { DEFAULT_AVATAR } from '@/constants/images';
import { auth, db } from '@/src/services/firebase';
import { getMatches, MatchSummary } from '@/src/services/interactions';
import { markConversationSeen } from '@/src/services/conversations';
import { createMeetingRequestNotification, respondMeetingRequest } from '@/src/services/notifications';
import { createCalendarEventFromSchedule } from '@/src/services/calendar';

type ConversationMessage = {
  id: string;
  fromUid?: string | null;
  text?: string | null;
  type?: 'text' | 'schedule' | 'schedule_response';
  eventAt?: Date | null;
  sentAt?: Date | null;
  status?: 'accepted' | 'rejected';
  refId?: string | null;
};

export default function ChatScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const convoId = Array.isArray(conversationId) ? conversationId[0] : conversationId;
  const me = auth.currentUser;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [otherUser, setOtherUser] = useState<MatchSummary['other'] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleValue, setScheduleValue] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const listRef = useRef<FlatList<ConversationMessage>>(null);

  const normalizeDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  useEffect(() => {
    if (!convoId) return;
    setLoadingMessages(true);
    setError('');
    const q = query(collection(db, 'conversations', convoId, 'messages'), orderBy('sentAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            ...data,
            sentAt: normalizeDate(data.sentAt),
            eventAt: normalizeDate(data.eventAt),
          } as ConversationMessage;
        });
        setMessages(items);
        setLoadingMessages(false);
      },
      (err) => {
        console.error('[chat] snapshot error', err);
        setError('No se pudieron cargar los mensajes.');
        setLoadingMessages(false);
      }
    );
    return () => unsub();
  }, [convoId]);

  useEffect(() => {
    if (!convoId) return;
    let active = true;
    (async () => {
      try {
        const data = await getMatches();
        if (!active) return;
        const match = data.find((m) => m.id === convoId);
        if (match?.other) setOtherUser(match.other);
      } catch (err) {
        console.warn('[chat] no se pudo obtener info del match', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [convoId]);

  useEffect(() => {
    if (!convoId) return;
    markConversationSeen(convoId).catch((err) => {
      console.warn('[chat] no se pudo marcar como visto', err);
    });
  }, [convoId]);

  useEffect(() => {
    if (!messages.length) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const canSend = useMemo(
    () => Boolean(me && convoId && text.trim().length > 0 && !sending),
    [me, convoId, text, sending]
  );

  const formatDateTime = (date: Date) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const sendMessage = async () => {
    if (!canSend || !me || !convoId) return;
    try {
      setSending(true);
      const trimmed = text.trim();
      const payload = {
        fromUid: me.uid,
        text: trimmed,
        type: 'text',
        sentAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'conversations', convoId, 'messages'), payload);
      await setDoc(
        doc(db, 'conversations', convoId),
        { lastMessageText: trimmed, lastMessageAt: serverTimestamp() },
        { merge: true }
      );
      setText('');
    } catch (err) {
      console.error('[chat] no se pudo enviar', err);
    } finally {
      setSending(false);
    }
  };

  const defaultScheduleValue = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60);
    const tz = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return tz.toISOString().slice(0, 16);
  };

  const openScheduler = () => {
    setScheduleError('');
    setScheduleValue((prev) => prev || defaultScheduleValue());
    setShowScheduler(true);
  };

  const confirmSchedule = async () => {
    if (!me || !convoId || !scheduleValue) return;
    const iso = scheduleValue.includes('T') ? scheduleValue : scheduleValue.replace(' ', 'T');
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) {
      setScheduleError('Ingresa una fecha valida con formato AAAA-MM-DD HH:mm');
      return;
    }
    if (when.getTime() < Date.now()) {
      setScheduleError('La fecha debe ser futura.');
      return;
    }
    try {
      const textPayload = `Reunion propuesta: ${formatDateTime(when)}`;
      const payload = {
        fromUid: me.uid,
        text: textPayload,
        type: 'schedule' as const,
        eventAt: Timestamp.fromDate(when),
        sentAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'conversations', convoId, 'messages'), payload);
      await setDoc(
        doc(db, 'conversations', convoId),
        { lastMessageText: textPayload, lastMessageAt: serverTimestamp() },
        { merge: true }
      );
      await createMeetingRequestNotification({
        conversationId: convoId,
        proposalMessageId: docRef.id,
      });
      setShowScheduler(false);
      setScheduleValue('');
    } catch (err) {
      console.error('[chat] no se pudo agendar', err);
      setScheduleError(err?.message || 'No se pudo agendar.');
    }
  };

  const syncMeetingNotification = async (
    status: 'accepted' | 'rejected',
    proposalMessageId: string
  ) => {
    try {
      await respondMeetingRequest({ conversationId: convoId!, proposalMessageId, status });
    } catch (err) {
      console.warn('[chat] notificacion no sincronizada', err);
    }
  };

  const getDecisionFor = (proposalId?: string | null) =>
    messages.find((msg) => msg.type === 'schedule_response' && msg.refId === proposalId);

  const updateScheduleStatus = async (
    message: ConversationMessage,
    status: 'accepted' | 'rejected'
  ) => {
    if (!me || !convoId || !message?.id) return;
    try {
      const messageRef = doc(db, 'conversations', convoId, 'messages', message.id);
      await setDoc(
        messageRef,
        { status, decidedBy: me.uid, decidedAt: serverTimestamp() },
        { merge: true }
      );
      let lastText = message.text || '';
      if (status === 'accepted') lastText = `${lastText} (aceptada)`;
      if (status === 'rejected') lastText = `${lastText} (rechazada)`;
      await setDoc(
        doc(db, 'conversations', convoId),
        { lastMessageText: lastText, lastMessageAt: serverTimestamp() },
        { merge: true }
      );
      if (status === 'accepted' && message.eventAt) {
        await createCalendarEventFromSchedule({
          conversationId: convoId,
          proposalMessageId: message.id,
        });
      }
    } catch (err) {
      const responseText =
        status === 'accepted' ? 'Reunion aceptada' : 'Reunion cancelada';
      const payload = {
        fromUid: me.uid,
        type: 'schedule_response' as const,
        refId: message.id,
        status,
        eventAt: message.eventAt ? Timestamp.fromDate(message.eventAt) : null,
        text: responseText,
        sentAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'conversations', convoId, 'messages'), payload);
      await setDoc(
        doc(db, 'conversations', convoId),
        { lastMessageText: responseText, lastMessageAt: serverTimestamp() },
        { merge: true }
      );
      if (status === 'accepted' && message.eventAt) {
        await createCalendarEventFromSchedule({
          conversationId: convoId,
          proposalMessageId: message.id,
        });
      }
    }
    await syncMeetingNotification(status, message.id);
  };

  const renderScheduleMeta = (message: ConversationMessage) => {
    const decision = getDecisionFor(message.id);
    const resolvedStatus = message.status || decision?.status;
    if (resolvedStatus === 'accepted') {
      return <Text style={styles.statusAccepted}>Confirmada</Text>;
    }
    if (resolvedStatus === 'rejected') {
      return <Text style={styles.statusRejected}>Rechazada</Text>;
    }
    const mine = message.fromUid === me?.uid;
    return (
      <View style={styles.scheduleButtons}>
        {mine ? (
          <TouchableOpacity
            style={[styles.scheduleButton, styles.scheduleReject]}
            onPress={() => updateScheduleStatus(message, 'rejected')}
          >
            <Text style={styles.scheduleButtonText}>Cancelar</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.scheduleButton, styles.scheduleAccept]}
              onPress={() => updateScheduleStatus(message, 'accepted')}
            >
              <Text style={styles.scheduleButtonText}>Aceptar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scheduleButton, styles.scheduleReject]}
              onPress={() => updateScheduleStatus(message, 'rejected')}
            >
              <Text style={styles.scheduleButtonText}>Rechazar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ConversationMessage }) => {
    const mine = item.fromUid === me?.uid;
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
        {!mine && (
          <Image source={{ uri: otherUser?.fotoUrl || DEFAULT_AVATAR }} style={styles.bubbleAvatar} />
        )}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={styles.bubbleText}>{item.text}</Text>
          {item.type === 'schedule' && renderScheduleMeta(item)}
        </View>
      </View>
    );
  };

  if (!convoId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.stateText}>Selecciona un match para abrir el chat.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>{'< Volver'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerProfile}
          activeOpacity={0.8}
          onPress={() => {
            if (otherUser?.uid) {
              router.push({ pathname: '/profile/[userId]', params: { userId: otherUser.uid } });
            }
          }}
        >
          <Image source={{ uri: otherUser?.fotoUrl || DEFAULT_AVATAR }} style={styles.headerAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{otherUser?.nombre || 'Chat'}</Text>
            <Text style={styles.headerSubtitle}>Coordinemos la sesion</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loadingMessages ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#59f5c9" size="large" />
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={[styles.stateText, { color: '#ff9d9d' }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>Aun no hay mensajes. Escribe el primero!</Text>
            </View>
          }
        />
      )}

      <View style={styles.composer}>
        <TouchableOpacity style={styles.agendaButton} onPress={openScheduler}>
          <Text style={styles.agendaText}>Agenda</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje"
          placeholderTextColor="#7c87a8"
          value={text}
          onChangeText={setText}
          editable={!sending}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && { opacity: 0.5 }]}
          onPress={sendMessage}
          disabled={!canSend}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showScheduler} animationType="fade" transparent onRequestClose={() => setShowScheduler(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Agendar reunion</Text>
            <Text style={styles.modalLabel}>Fecha y hora (AAAA-MM-DD HH:mm)</Text>
            <TextInput
              style={styles.modalInput}
              value={scheduleValue}
              onChangeText={(v) => {
                setScheduleValue(v);
                setScheduleError('');
              }}
              placeholder="2025-11-15 18:00"
              placeholderTextColor="#6b7280"
            />
            {scheduleError ? <Text style={styles.modalError}>{scheduleError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowScheduler(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmSchedule}>
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0b152f',
    gap: 12,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backText: {
    color: '#7ff6c8',
    fontWeight: '600',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#14f195',
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerName: {
    color: '#f6fbff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#7b8bb0',
    fontSize: 12,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleMine: {
    backgroundColor: '#14f195',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#0f1c3a',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: '#f8fbff',
  },
  scheduleButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  scheduleButton: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  scheduleAccept: {
    backgroundColor: '#10f5a7',
  },
  scheduleReject: {
    backgroundColor: '#ff92a6',
  },
  scheduleButtonText: {
    color: '#041116',
    fontWeight: '700',
  },
  statusAccepted: {
    color: '#10f5a7',
    marginTop: 8,
    fontWeight: '700',
  },
  statusRejected: {
    color: '#ff92a6',
    marginTop: 8,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#0a132a',
    backgroundColor: '#030a1c',
  },
  agendaButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#152648',
  },
  agendaText: {
    color: '#7ef2c8',
    fontWeight: '700',
  },
  input: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#0d1530',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButton: {
    borderRadius: 999,
    backgroundColor: '#14f195',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendText: {
    color: '#052016',
    fontWeight: '700',
  },
  stateBox: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: '#0c162f',
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  stateText: {
    color: '#cdd6f6',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#14f195',
    marginTop: 8,
  },
  retryButtonText: {
    color: '#062415',
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#0c1530',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    color: '#f8fbff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalLabel: {
    color: '#9da7c9',
  },
  modalInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2b54',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
  },
  modalError: {
    color: '#ff9d9d',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    color: '#9da7c9',
  },
  modalConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#14f195',
  },
  modalConfirmText: {
    color: '#032417',
    fontWeight: '700',
  },
});
