import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
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

const ITEM_HEIGHT = 40;
const MINUTE_STEP = 1;
const HOUR_OFFSETS = Array.from({ length: 24 }, (_, i) => i * ITEM_HEIGHT);
const MINUTE_OFFSETS = Array.from({ length: 60 }, (_, i) => i * ITEM_HEIGHT);

export default function ChatScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const convoId = Array.isArray(conversationId) ? conversationId[0] : conversationId;
  const me = auth.currentUser;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = Math.max(12, Math.min(18, width * 0.04));
  const bottomInset = Math.max(12, insets.bottom);
  const isCompact = width < 360;
  const useIconSend = width < 380;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [otherUser, setOtherUser] = useState<MatchSummary['other'] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const lastNotifiedId = useRef<string | null>(null);
  const permissionsRequested = useRef(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | null>(null);
  const [pickerTime, setPickerTime] = useState('');
  const [pickerHour, setPickerHour] = useState(0);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const hoursRef = useRef<ScrollView>(null);
  const minutesRef = useRef<ScrollView>(null);
  const [scheduleError, setScheduleError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState({
    temasVistos: '',
    duracionMinutos: '',
    logroClave: '',
    tareaProxima: '',
    dificultad: 0,
    rating: 0,
    comentario: ''
  });
  const [summaryError, setSummaryError] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  const listRef = useRef<FlatList<ConversationMessage>>(null);

  const TypingIndicator = () => {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
      dot1.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), -1);
      dot2.value = withRepeat(withSequence(withTiming(0, { duration: 200 }), withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), -1);
      dot3.value = withRepeat(withSequence(withTiming(0, { duration: 400 }), withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), -1);
    }, []);

    const animatedDot1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
    const animatedDot2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
    const animatedDot3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

    return (
      <View style={[styles.bubbleRow, styles.rowLeft]}>
        <Image source={{ uri: otherUser?.fotoUrl || DEFAULT_AVATAR }} style={styles.bubbleAvatar} />
        <View style={[styles.bubble, styles.bubbleOther, styles.typingBubble]}>
          <View style={styles.typingDots}>
            <Animated.View style={[styles.dot, animatedDot1]} />
            <Animated.View style={[styles.dot, animatedDot2]} />
            <Animated.View style={[styles.dot, animatedDot3]} />
          </View>
        </View>
      </View>
    );
  };

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
    if (!permissionsRequested.current) {
      permissionsRequested.current = true;
      Notifications.requestPermissionsAsync().catch(() => {});
    }
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

        // Notificar mensaje nuevo del otro usuario
        const last = items[items.length - 1];
        if (last && last.fromUid && last.fromUid !== me?.uid && last.id !== lastNotifiedId.current) {
          lastNotifiedId.current = last.id;
          const body =
            last.type === 'schedule'
              ? 'Te enviaron una propuesta de reunión.'
              : last.text || 'Nuevo mensaje';
          Notifications.scheduleNotificationAsync({
            content: {
              title: otherUser?.nombre || 'Nuevo mensaje',
              body,
            },
            trigger: null,
          }).catch(() => {});
        }
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

  useFocusEffect(
    useCallback(() => {
      const parent: any = navigation.getParent?.();
      if (parent?.setOptions) {
        parent.setOptions({ tabBarStyle: { display: 'none' } });
      }
      return () => {
        if (parent?.setOptions) parent.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

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
    const iso = defaultScheduleValue();
    const base = new Date(iso);
    if (!Number.isNaN(base.getTime())) {
      setPickerDate(base);
      setCurrentMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const safeMinutes = Math.min(59, base.getMinutes());
      const adjusted = new Date(base);
      adjusted.setMinutes(safeMinutes);
      setPickerTime(`${pad(adjusted.getHours())}:${pad(safeMinutes)}`);
      setPickerHour(adjusted.getHours());
      setPickerMinute(safeMinutes);
      setTimeout(() => {
        hoursRef.current?.scrollTo({ y: adjusted.getHours() * ITEM_HEIGHT, animated: false });
        minutesRef.current?.scrollTo({
          y: safeMinutes * ITEM_HEIGHT,
          animated: false,
        });
      }, 0);
    }
    setShowScheduler(true);
  };

  useEffect(() => {
    if (!showScheduler || !pickerTime) return;
    const [hStr, mStr] = pickerTime.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isNaN(h)) setPickerHour(h);
    if (!Number.isNaN(m)) setPickerMinute(m);
    const minuteIdx = Math.round(m / MINUTE_STEP);
    requestAnimationFrame(() => {
      hoursRef.current?.scrollTo({ y: Math.max(0, h) * ITEM_HEIGHT, animated: true });
      minutesRef.current?.scrollTo({ y: Math.max(0, minuteIdx) * ITEM_HEIGHT, animated: true });
    });
  }, [showScheduler, pickerTime]);

  const getDecisionFor = useCallback((proposalId?: string | null) =>
    messages.find((msg) => msg.type === 'schedule_response' && msg.refId === proposalId),
    [messages]
  );

  const applyPickerTime = useCallback(
    (hour: number, minute: number) => {
      const h = Math.min(Math.max(hour, 0), 23);
      const m = Math.min(Math.max(minute, 0), 59);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const label = `${pad(h)}:${pad(m)}`;
      setPickerHour(h);
      setPickerMinute(m);
      setPickerTime(label);
      if (pickerDate) {
        const d = new Date(pickerDate);
        d.setHours(h);
        d.setMinutes(m);
        setPickerDate(d);
      }
    },
    [pickerDate]
  );

    const meetingStatus = useMemo(() => {
    const scheduleMsgs = messages.filter((msg) => msg.type === 'schedule');
    if (!scheduleMsgs.length) return { meeting: null, summaries: [] };

    // Tomar la última reunión aceptada; si ninguna aceptada, no hay reunión vigente
    let lastAccepted: ConversationMessage | null = null;
    for (let i = scheduleMsgs.length - 1; i >= 0; i -= 1) {
      const sched = scheduleMsgs[i];
      const responses = messages.filter(
        (m) => m.type === 'schedule_response' && m.refId === sched.id
      );
      const lastResponse = responses.length ? responses[responses.length - 1] : null;
      const resolvedStatus = lastResponse?.status || sched.status;
      if (resolvedStatus === 'accepted') {
        lastAccepted = sched;
        break;
      }
      if (resolvedStatus === 'rejected') {
        // si la última fue rechazada, no seguimos hacia atrás
        break;
      }
    }

    if (!lastAccepted) return { meeting: null, summaries: [] };

    const summaries = messages.filter(
      (m) => m.type === 'session_summary' && m.refId === lastAccepted.id
    );

    return { meeting: lastAccepted, summaries };
  }, [messages]);  
  const confirmedMeeting = meetingStatus.meeting;
  const bothCompleted = meetingStatus.summaries.length >= 2;
  const iCompleted = meetingStatus.summaries.some(s => s.fromUid === me?.uid);
  const canFinalize = useMemo(() => {
    if (!confirmedMeeting?.eventAt) return false;
    const when = confirmedMeeting.eventAt;
    return when.getTime() <= Date.now();
  }, [confirmedMeeting]);
  const [meetingStarted, setMeetingStarted] = useState(false);

  useEffect(() => {
    if (!confirmedMeeting?.eventAt) {
      setMeetingStarted(false);
      return;
    }
    const now = Date.now();
    const target = confirmedMeeting.eventAt.getTime();
    if (target <= now) {
      setMeetingStarted(true);
      Alert.alert('Tu reunión ha iniciado');
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Tu reunión ha iniciado',
          body: 'Abre el chat para coordinar.',
        },
        trigger: null,
      }).catch(() => {});
      return;
    }
    const timeout = setTimeout(() => {
      setMeetingStarted(true);
      Alert.alert('Tu reunión ha iniciado');
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Tu reunión ha iniciado',
          body: 'Abre el chat para coordinar.',
        },
        trigger: null,
      }).catch(() => {});
    }, target - now);
    return () => clearTimeout(timeout);
  }, [confirmedMeeting]);

  const openSummaryModal = () => {
    setSummaryError('');
    setSummaryData({
      temasVistos: '',
      duracionMinutos: '',
      logroClave: '',
      tareaProxima: '',
      dificultad: 0,
      rating: 0,
      comentario: ''
    });
    setShowSummaryModal(true);
  };

  const saveSummary = async () => {
    if (!me || !convoId) return;
    
    if (!summaryData.temasVistos.trim() || summaryData.temasVistos.trim().length < 3) {
      setSummaryError('Los temas vistos son obligatorios (mínimo 3 caracteres)');
      return;
    }
    
    const duracion = parseInt(summaryData.duracionMinutos);
    if (!duracion || duracion < 1 || duracion > 300) {
      setSummaryError('La duración debe ser entre 1 y 300 minutos');
      return;
    }
    
    if (summaryData.rating < 1 || summaryData.rating > 5) {
      setSummaryError('Debes seleccionar una calificación (1-5 estrellas)');
      return;
    }

    try {
      setSavingSummary(true);
      const meeting = confirmedMeeting;
      
      console.log('[SUMMARY] Guardando resumen...', {
        convoId,
        meetingId: meeting?.id,
        userUid: me.uid
      });
      
      const summaryPayload = {
        conversationId: convoId,
        meetingMessageId: meeting?.id || null,
        meetingDate: meeting?.eventAt ? Timestamp.fromDate(meeting.eventAt) : serverTimestamp(),
        teacher: otherUser?.uid || null,
        student: me.uid,
        temasVistos: summaryData.temasVistos.trim(),
        duracionMinutos: duracion,
        logroClave: summaryData.logroClave.trim(),
        tareaProxima: summaryData.tareaProxima.trim(),
        dificultad: summaryData.dificultad,
        rating: summaryData.rating,
        comentario: summaryData.comentario.trim(),
        createdBy: me.uid,
        createdAt: serverTimestamp()
      };

      console.log('[SUMMARY] Payload:', summaryPayload);

      // Guardar en Firestore
      await addDoc(collection(db, 'sessionSummaries'), summaryPayload);
      console.log('[SUMMARY] Guardado en Firestore exitosamente');
      
      // Enviar mensaje al chat
      const summaryText = `📋 Sesión completada\n⭐ ${summaryData.rating}/5\n🎯 ${summaryData.temasVistos}`;
      await addDoc(collection(db, 'conversations', convoId, 'messages'), {
        fromUid: me.uid,
        text: summaryText,
        type: 'session_summary',
        refId: meeting?.id || null,
        sentAt: serverTimestamp()
      });
      
      await setDoc(
        doc(db, 'conversations', convoId),
        { lastMessageText: 'Sesión completada', lastMessageAt: serverTimestamp() },
        { merge: true }
      );

      setShowSummaryModal(false);
    } catch (err: any) {
      console.error('[SUMMARY] Error completo:', err);
      console.error('[SUMMARY] Error message:', err?.message);
      console.error('[SUMMARY] Error code:', err?.code);
      setSummaryError(`Error: ${err?.message || 'No se pudo guardar el resumen. Intenta nuevamente.'}`);
    } finally {
      setSavingSummary(false);
    }
  };

  const confirmSchedule = async () => {
    if (!me || !convoId) return;
    // Reconstruir fecha/hora desde los pickers
    let when: Date | null = null;
    if (pickerDate && pickerTime) {
      const [hStr, mStr] = pickerTime.split(':');
      const h = Number(hStr);
      const m = Number(mStr);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        const composed = new Date(pickerDate);
        composed.setHours(h);
        composed.setMinutes(m);
        composed.setSeconds(0, 0);
        when = composed;
      }
    }
    if (!when || Number.isNaN(when.getTime())) {
      setScheduleError('Selecciona fecha y hora válidas.');
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
      setPickerDate(null);
      setPickerTime('');
      setPickerHour(0);
      setPickerMinute(0);
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
      <View style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding, width: '100%' }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#14f195" />
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
            <Text style={styles.headerSubtitle}>
              {isTyping ? 'Escribiendo...' : 'Coordinemos la sesion'}
            </Text>
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
          style={[styles.list, { paddingBottom: bottomInset }]}
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: horizontalPadding,
              width: '100%',
              flexGrow: 1,
            },
          ]}
          ListEmptyComponent={
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>Aun no hay mensajes. Escribe el primero!</Text>
            </View>
          }
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
        />
      )}

      <View
        style={[
          styles.composer,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: bottomInset,
            width: '100%',
          },
        ]}
      >
        {confirmedMeeting && !bothCompleted ? (
          iCompleted ? (
            <View style={styles.esperandoButton}>
              <Text style={styles.esperandoText}>Esperando a {otherUser?.nombre || 'usuario'}</Text>
            </View>
          ) : canFinalize || meetingStarted ? (
            <TouchableOpacity style={styles.finalizarButton} onPress={openSummaryModal}>
              <Text style={styles.finalizarText}>Finalizar</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.agendaButton, { opacity: 0.5 }]}>
              <Text style={[styles.agendaText, { color: '#4a6278' }]}>Agenda</Text>
            </View>
          )
        ) : (
          <TouchableOpacity style={styles.agendaButton} onPress={openScheduler}>
            <Text style={styles.agendaText}>Agenda</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje"
          placeholderTextColor="#7c87a8"
          value={text}
          onChangeText={(value) => {
            setText(value);
          }}
          editable={!sending}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            useIconSend && styles.sendButtonCompact,
            !canSend && { opacity: 0.5 },
          ]}
          onPress={sendMessage}
          disabled={!canSend}
        >
          {useIconSend ? (
            <Ionicons name="send" size={18} color="#052016" />
          ) : (
            <Text style={styles.sendText}>Enviar</Text>
          )}
        </TouchableOpacity>
      </View>
      </View>
      <Modal visible={showScheduler} animationType="fade" transparent onRequestClose={() => setShowScheduler(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Agendar reunion</Text>
            <Text style={styles.modalLabel}>Fecha</Text>
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity
                  onPress={() =>
                    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                  style={styles.calendarNav}
                >
                  <Ionicons name="chevron-back" size={18} color="#cdd6f6" />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                  {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                  style={styles.calendarNav}
                >
                  <Ionicons name="chevron-forward" size={18} color="#cdd6f6" />
                </TouchableOpacity>
              </View>
              <View style={styles.weekdayRow}>
                {['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map((w) => (
                  <Text key={w} style={styles.weekdayLabel}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {(() => {
                  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                  const startIdx = (firstDay.getDay() + 6) % 7; // Monday=0
                  const daysInMonth = new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    0
                  ).getDate();
                  const cells = [];
                  for (let i = 0; i < startIdx; i++) cells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

                  return cells.map((day, idx) => {
                    if (!day) return <View key={`empty-${idx}`} style={styles.dayCell} />;
                    const thisDate = new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth(),
                      day
                    );
                    const isSelected =
                      pickerDate &&
                      thisDate.toDateString() === pickerDate.toDateString();
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayCell, isSelected && styles.daySelected]}
                        onPress={() => {
                          const base = pickerDate || new Date();
                          const next = new Date(thisDate);
                          next.setHours(base.getHours(), base.getMinutes(), 0, 0);
                          setPickerDate(next);
                          setScheduleError('');
                        }}
                      >
                        <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
            </View>

            <Text style={styles.modalLabel}>Hora</Text>
            <View style={styles.timeStepperWrapper}>
              <View style={styles.timeStepperRow}>
                <View style={styles.timeStepper}>
                  <TouchableOpacity onPress={() => applyPickerTime((pickerHour + 23) % 24, pickerMinute)}>
                    <Text style={styles.stepperControl}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{pickerHour.toString().padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => applyPickerTime((pickerHour + 1) % 24, pickerMinute)}>
                    <Text style={styles.stepperControl}>▼</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.stepperSeparator}>:</Text>
                <View style={styles.timeStepper}>
                  <TouchableOpacity onPress={() => applyPickerTime(pickerHour, (pickerMinute + 59) % 60)}>
                    <Text style={styles.stepperControl}>▲</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{pickerMinute.toString().padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => applyPickerTime(pickerHour, (pickerMinute + 1) % 60)}>
                    <Text style={styles.stepperControl}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

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

      <Modal visible={showSummaryModal} animationType="fade" transparent onRequestClose={() => setShowSummaryModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.summaryScrollContent}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>📋 Resumen de la Sesión</Text>
              <Text style={styles.summarySubtitle}>con {otherUser?.nombre || 'Usuario'}</Text>
              
              <Text style={styles.summaryLabel}>Temas vistos *</Text>
              <TextInput
                style={styles.modalInput}
                value={summaryData.temasVistos}
                onChangeText={(v) => setSummaryData({...summaryData, temasVistos: v})}
                placeholder="Ej: Variables, loops, funciones"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.summaryLabel}>Duración (minutos) *</Text>
              <TextInput
                style={styles.modalInput}
                value={summaryData.duracionMinutos}
                onChangeText={(v) => setSummaryData({...summaryData, duracionMinutos: v})}
                placeholder="90"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
              />

              <Text style={styles.summaryLabel}>Logro clave</Text>
              <TextInput
                style={styles.modalInput}
                value={summaryData.logroClave}
                onChangeText={(v) => setSummaryData({...summaryData, logroClave: v})}
                placeholder="Ej: Creé mi primer programa"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.summaryLabel}>Tarea próxima</Text>
              <TextInput
                style={styles.modalInput}
                value={summaryData.tareaProxima}
                onChangeText={(v) => setSummaryData({...summaryData, tareaProxima: v})}
                placeholder="Ej: Practicar ejercicios de loops"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.summaryLabel}>Dificultad de la sesión</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setSummaryData({...summaryData, dificultad: star})}>
                    <Text style={styles.star}>{summaryData.dificultad >= star ? '⭐' : '⚪'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.summaryLabel}>Tu experiencia *</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setSummaryData({...summaryData, rating: star})}>
                    <Text style={styles.star}>{summaryData.rating >= star ? '⭐' : '⚪'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.summaryLabel}>Comentario (opcional)</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                value={summaryData.comentario}
                onChangeText={(v) => setSummaryData({...summaryData, comentario: v})}
                placeholder="Escribe tu opinión..."
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={3}
              />

              {summaryError ? <Text style={styles.modalError}>{summaryError}</Text> : null}
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSummaryModal(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalConfirm, savingSummary && {opacity: 0.5}]} 
                  onPress={saveSummary}
                  disabled={savingSummary}
                >
                  <Text style={styles.modalConfirmText}>{savingSummary ? 'Guardando...' : '💾 Guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  list: {
    flex: 1,
    width: '100%',
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
    flexWrap: 'nowrap',
    borderTopWidth: 1,
    borderTopColor: '#0a132a',
    backgroundColor: '#030a1c',
  },
  agendaButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#152648',
    flexShrink: 0,
  },
  agendaText: {
    color: '#7ef2c8',
    fontWeight: '700',
  },
  finalizarButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#14f195',
  },
  finalizarText: {
    color: '#032417',
    fontWeight: '700',
  },
  esperandoButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffa726',
  },
  esperandoText: {
    color: '#3e2723',
    fontWeight: '700',
    fontSize: 12,
  },
  input: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#0d1530',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
  },
  sendButton: {
    borderRadius: 999,
    backgroundColor: '#14f195',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 68,
    maxWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonCompact: {
    minWidth: 44,
    maxWidth: 44,
    paddingHorizontal: 10,
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
    marginTop: 6,
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
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingVertical: 4,
  },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a3a63',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f1a35',
  },
  chipSmall: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3a63',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0f1a35',
  },
  chipSelected: {
    borderColor: '#14f195',
    backgroundColor: '#0b2d25',
  },
  chipText: {
    color: '#cdd6f6',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#14f195',
  },
  timeStepperWrapper: {
    marginTop: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#0c1329',
    borderWidth: 1,
    borderColor: '#1f2b54',
    alignItems: 'center',
  },
  timeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  timeStepper: {
    alignItems: 'center',
    gap: 6,
  },
  stepperControl: {
    color: '#7ef2c8',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  stepperValue: {
    color: '#cdd6f6',
    fontSize: 24,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  stepperSeparator: {
    color: '#cdd6f6',
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  calendarCard: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0f1a35',
    borderWidth: 1,
    borderColor: '#1f2b54',
    width: '100%',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthText: {
    color: '#cdd6f6',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  calendarNav: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#0c1329',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: '#7c87a8',
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  daySelected: {
    backgroundColor: '#0b2d25',
    borderWidth: 1,
    borderColor: '#14f195',
  },
  dayText: {
    color: '#cdd6f6',
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#14f195',
    fontWeight: '800',
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
  typingBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7ef2c8',
  },
  summaryScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: '#0c1530',
    padding: 20,
    gap: 12,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  summaryTitle: {
    color: '#f8fbff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  summarySubtitle: {
    color: '#9da7c9',
    textAlign: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#9da7c9',
    marginTop: 8,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  star: {
    fontSize: 28,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
});

