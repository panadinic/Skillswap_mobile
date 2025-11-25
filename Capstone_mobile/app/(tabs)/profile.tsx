import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { DEFAULT_AVATAR } from '@/constants/images';
import { useProfile } from '@/src/hooks/useProfile';
import { useSessionStats } from '@/src/hooks/useSessionStats';
import { Publication } from '@/src/services/api';
import { cancelCalendarEvent } from '@/src/services/calendar';
import { createReview, Review } from '@/src/services/reviews';
import { getMatches, MatchSummary } from '@/src/services/interactions';
import { updateMyProfile } from '@/src/services/users';
import { listUserPhotos, uploadUserPhoto, deleteUserPhoto, UserPhoto } from '@/src/services/photos';
import { auth, storage } from '@/src/services/firebase';
import { logout } from '@/src/services/auth';

const tabs = [
  { key: 'publicaciones', label: 'Publicaciones' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'estadisticas', label: 'Estadísticas' },
  { key: 'calendario', label: 'Calendario' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const paramUserId = Array.isArray(userId) ? userId[0] : userId;
  const {
    profile,
    loadingProfile,
    posts,
    loadingPosts,
    initializing,
    calendarEvents,
    loadingCalendar,
    calendarError,
    isOwnProfile,
    reload,
    reviewsByPost,
    loadReviewsForPost,
    loadingReviews,
    viewerUid,
  } = useProfile(paramUserId);
  // user id que se está viendo (prop o propio)
  const profileUserId = paramUserId || viewerUid;
  const [activeTab, setActiveTab] = useState('publicaciones');
  const [cancellingEvent, setCancellingEvent] = useState<string | null>(null);
  const [showReviewFormFor, setShowReviewFormFor] = useState<Publication | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [matchedUids, setMatchedUids] = useState<Set<string>>(new Set());
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const [photoModal, setPhotoModal] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoDeleting, setPhotoDeleting] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    bio: '',
    fotoUrl: '',
    ciudad: '',
    region: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const canDeletePhotos = isOwnProfile && (!viewerUid || viewerUid === profileUserId);

  // Obtener el userId correcto
  console.log('[PROFILE] profileUserId:', profileUserId);
  console.log('[PROFILE] profile?.uid:', profile?.uid);
  
  // Forzar recarga cuando cambia el userId
  const statsKey = `stats-${profileUserId}`;
  const { stats: sessionStats, loading: loadingStats } = useSessionStats(profileUserId);
  const { width } = useWindowDimensions();
  const horizontalPadding = Math.max(16, Math.min(24, width * 0.04));
  const contentMaxWidth = Math.min(900, width - horizontalPadding * 2);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingMatches(true);
        const matches = await getMatches();
        if (!active) return;
        const set = new Set<string>();
        (matches || []).forEach((m: MatchSummary) => {
          const other = m.other || m.userA || m.userB;
          if (other?.uid) set.add(other.uid);
          (m.users || []).forEach((u) => set.add(u));
        });
        setMatchedUids(set);
      } catch (err) {
        console.warn('[profile] no se pudieron cargar matches para reseñas', err);
      } finally {
        if (active) setLoadingMatches(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (profile && isOwnProfile) {
      setEditForm({
        nombre: profile.nombre || '',
        bio: profile.bio || '',
        fotoUrl: profile.fotoUrl || '',
        ciudad: profile.ciudad || '',
        region: profile.region || '',
      });
      setPhotoUrlInput(profile.fotoUrl || '');
    }
  }, [profile, isOwnProfile]);

  const loadPhotos = useCallback(
    async (uid: string) => {
      try {
        setLoadingPhotos(true);
        const items = await listUserPhotos(uid);
        setPhotos(items);
      } catch (err) {
        console.warn('[profile] no se pudieron cargar fotos', err);
      } finally {
        setLoadingPhotos(false);
      }
    },
    []
  );

  useEffect(() => {
    if (profileUserId) {
      loadPhotos(profileUserId);
    }
  }, [profileUserId, loadPhotos]);

  const canReviewPost = useCallback(
    (post: Publication) => {
      const ownerUid = (post as any).creatorId || (post as any).authorUid || null;
      if (!ownerUid) return false;
      if (viewerUid && ownerUid === viewerUid) return false;
      return matchedUids.has(ownerUid);
    },
    [matchedUids, viewerUid]
  );

  const renderPostCard = ({ item }: { item: Publication }) => {
    const ratingAvg =
      typeof item.ratingAvg === 'number'
        ? item.ratingAvg.toFixed(1)
        : item.ratingAvg || '0.0';
    const ratingCount = item.ratingCount ?? 0;
    const description = (item as any).content || (item as any).descripcion || '';
    const reviews = reviewsByPost[item.id] || [];
    const isOwnPost =
      viewerUid && (item.creatorId === viewerUid || item.authorUid === viewerUid);
    const canReview = canReviewPost(item);
    const isLoadingReviews = loadingReviews === item.id;
    const isExpanded = expandedReviews[item.id];

    const toggleReviews = async () => {
      if (isExpanded) {
        setExpandedReviews((prev) => ({ ...prev, [item.id]: false }));
        return;
      }
      if (isLoadingReviews) return;
      try {
        await loadReviewsForPost(item.id);
        setExpandedReviews((prev) => ({ ...prev, [item.id]: true }));
      } catch (err: any) {
        Alert.alert('No se pudieron cargar las reseñas', err?.message || 'Intenta nuevamente.');
      }
    };

    const openReviewForm = () => {
      setReviewRating(0);
      setReviewComment('');
      setReviewError(null);
      setShowReviewFormFor(item);
    };

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.postTitle}>{item.title || 'Sin titulo'}</Text>
            {description ? <Text style={styles.postDescription}>{description}</Text> : null}
          </View>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={16} color="#ffd44f" />
            <Text style={styles.ratingText}>{ratingAvg}</Text>
            <Text style={styles.ratingCount}>({ratingCount})</Text>
          </View>
        </View>
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.reviewButton} onPress={toggleReviews}>
            <Text style={styles.reviewText}>
              {isLoadingReviews
                ? 'Cargando...'
                : isExpanded
                ? 'Ocultar reseñas'
                : `Ver reseñas (${reviews.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#cfd7ff" />
          </TouchableOpacity>
        </View>
        {reviews.length > 0 && isExpanded && (
          <View style={styles.reviewList}>
            {reviews.slice(0, 3).map((rev) => (
              <View key={rev.id} style={styles.reviewItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="star" size={14} color="#ffd44f" />
                  <Text style={styles.reviewRating}>{rev.rating?.toFixed?.(1) || rev.rating}</Text>
                  <Text style={styles.reviewAuthor}>{rev.student?.nombre || 'Usuario'}</Text>
                </View>
                {rev.comment ? <Text style={styles.reviewComment}>{rev.comment}</Text> : null}
              </View>
            ))}
            {reviews.length > 3 ? (
              <Text style={styles.reviewMore}>+ {reviews.length - 3} reseñas más</Text>
            ) : null}
          </View>
        )}
        {!isOwnPost && canReview && (
          <TouchableOpacity style={styles.reviewWriteButton} onPress={openReviewForm}>
            <Ionicons name="create-outline" size={16} color="#0b7147" />
            <Text style={styles.reviewWriteText}>Escribir reseña</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const formatEventDate = useCallback((value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      await logout();
      router.replace('/');
      if (Platform.OS === 'web') {
        setTimeout(() => {
          router.replace('/');
          window.location.href = '/';
        }, 20);
      }
    } catch (err: any) {
      Alert.alert('No se pudo cerrar sesion', err?.message || 'Intenta nuevamente.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleOpenCamera = useCallback(async () => {
    if (capturing) return;
    try {
      setCapturing(true);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Autoriza el acceso a la cámara para tomar fotos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const uri = result.assets[0].uri;
        setCapturedPhoto(uri);
        setPhotoDescription('');
      }
    } catch (err: any) {
      Alert.alert('No se pudo abrir la cámara', err?.message || 'Intenta nuevamente.');
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const handlePickFromGallery = useCallback(async () => {
    if (capturing) return;
    try {
      setCapturing(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Autoriza el acceso a tus fotos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.85,
        mediaTypes: ImagePicker.MediaType.Images,
      });
      if (!result.canceled && result.assets?.length) {
        setCapturedPhoto(result.assets[0].uri);
        setPhotoDescription('');
      }
    } catch (err: any) {
      Alert.alert('No se pudo abrir la galer�a', err?.message || 'Intenta nuevamente.');
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const handleSavePhoto = useCallback(async () => {
    if (!capturedPhoto) return;
    try {
      setCapturing(true);
      const saved = await uploadUserPhoto(capturedPhoto, photoDescription.trim());
      setPhotos((prev) => [saved, ...prev]);
      Alert.alert('Foto guardada', 'Tu foto y descripción se guardaron en tu perfil.');
      setCapturedPhoto(null);
      setPhotoDescription('');
    } catch (err: any) {
      Alert.alert('No se pudo guardar la foto', err?.message || 'Intenta nuevamente.');
    } finally {
      setCapturing(false);
    }
  }, [capturedPhoto, photoDescription]);

  const handleDeletePhoto = useCallback(
    async (photo: UserPhoto) => {
      if (photoDeleting) return;
      try {
        setPhotoDeleting(photo.id);
        await deleteUserPhoto(photo);
        setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
        Alert.alert('Foto eliminada', 'La foto se eliminó de tu perfil.');
      } catch (err: any) {
        Alert.alert('No se pudo eliminar la foto', err?.message || 'Intenta nuevamente.');
      } finally {
        setPhotoDeleting(null);
      }
    },
    [photoDeleting]
  );

  const handleCancelEvent = useCallback(
    async (eventId: string) => {
      if (!eventId) return;
      try {
        setCancellingEvent(eventId);
        await cancelCalendarEvent(eventId);
        reload();
      } catch (err) {
        console.warn('[profile] no se pudo cancelar evento', err);
      } finally {
        setCancellingEvent(null);
      }
    },
    [reload]
  );

  const content = useMemo(() => {
    if (activeTab === 'estadisticas') {
      if (loadingStats) {
        return (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#59f5c9" />
            <Text style={styles.stateText}>Cargando estadísticas...</Text>
          </View>
        );
      }
      if (sessionStats.totalSessions === 0) {
        return (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Aún no hay sesiones completadas.</Text>
          </View>
        );
      }
      return (
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>📊 Resumen General</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{sessionStats.totalSessions}</Text>
                <Text style={styles.statLabel}>Sesiones</Text>
              </View>
              <View style={styles.statItem}>
                <View style={styles.statRating}>
                  <Ionicons name="star" size={16} color="#ffd44f" />
                  <Text style={styles.statValue}>{sessionStats.averageRating.toFixed(1)}</Text>
                </View>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.floor(sessionStats.totalMinutes / 60)}h</Text>
                <Text style={styles.statLabel}>Totales</Text>
              </View>
            </View>
            <Text style={styles.statsSubtext}>
              Promedio: {Math.floor(sessionStats.totalMinutes / sessionStats.totalSessions)} min por sesión
            </Text>
          </View>
        </View>
      );
    }
    if (activeTab === 'publicaciones') {
      if (loadingPosts) {
        return (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#59f5c9" />
            <Text style={styles.stateText}>Cargando publicaciones...</Text>
          </View>
        );
      }
      if (!posts.length) {
        return (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Este perfil aun no tiene publicaciones.</Text>
          </View>
        );
      }
      return (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPostCard}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      );
    }
    if (activeTab === 'fotos') {
      return (
        <View
          style={[
            styles.contentCard,
            { width: '100%', paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
          ]}
        >
          {isOwnProfile ? (
            <>
              <View style={styles.photoCtas}>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => router.push('/add-photo')}
                >
                  <Text style={styles.captureText}>Subir foto</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.stateText}>Fotos del usuario.</Text>
          )}

          {capturedPhoto && isOwnProfile ? (
            <View style={styles.overlayContainer} pointerEvents="box-none">
              <View style={styles.overlayBackdrop} />
              <View style={styles.overlayCard}>
                <Text style={styles.modalTitle}>Nueva foto</Text>
                <Image source={{ uri: capturedPhoto }} style={styles.photoPreview} />
                <TextInput
                  style={styles.photoDescInput}
                  placeholder="Escribe una descripción"
                  placeholderTextColor="#8aa0c6"
                  value={photoDescription}
                  onChangeText={setPhotoDescription}
                  multiline
                />
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancel, { flex: 1 }]}
                    onPress={() => {
                      setCapturedPhoto(null);
                      setPhotoDescription('');
                    }}
                  >
                    <Text style={styles.modalCancelText}>Descartar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirm, { flex: 1 }]}
                    onPress={handleSavePhoto}
                    disabled={capturing}
                  >
                    <Text style={styles.modalConfirmText}>
                      {capturing ? 'Guardando...' : 'Guardar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {loadingPhotos ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#59f5c9" />
              <Text style={styles.stateText}>Cargando fotos...</Text>
            </View>
          ) : photos.length ? (
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <View key={p.id} style={[styles.postCard, styles.photoPost, { marginHorizontal: 0 }]}>
                  {canDeletePhotos ? (
                    <TouchableOpacity
                      style={styles.photoDelete}
                      onPress={() => {
                        Alert.alert('Eliminar foto', '¿Quieres eliminar esta foto?', [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Eliminar', style: 'destructive', onPress: () => handleDeletePhoto(p) },
                        ]);
                      }}
                      disabled={photoDeleting === p.id}
                      accessibilityLabel="Eliminar foto"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={photoDeleting === p.id ? '#7a859f' : '#ff9aa2'}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.photoHeaderRow}>
                    <Image
                      source={{ uri: profile.fotoUrl || DEFAULT_AVATAR }}
                      style={styles.photoHeaderAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.photoHeaderName}>{profile?.nombre || 'Usuario'}</Text>
                      {p.descripcion ? (
                        <Text style={styles.photoHeaderDesc}>{p.descripcion}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Image source={{ uri: p.url }} style={styles.photoHero} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    }
    if (activeTab === 'calendario') {
      if (!isOwnProfile) {
        return (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Solo puedes ver tu propio calendario.</Text>
          </View>
        );
      }
      if (loadingCalendar) {
        return (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#59f5c9" />
            <Text style={styles.stateText}>Cargando eventos...</Text>
          </View>
        );
      }
      if (calendarError) {
        return (
          <View style={styles.stateBox}>
            <Text style={[styles.stateText, { color: '#ff9d9d' }]}>{calendarError}</Text>
          </View>
        );
      }
      if (!calendarEvents.length) {
        return (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              Aun no tienes reuniones agendadas ni historial disponible.
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.eventsList}>
          {calendarEvents.map((event) => {
            const eventDate = event.eventAt ? new Date(event.eventAt) : null;
            const isPast =
              eventDate && !Number.isNaN(eventDate.getTime()) && eventDate.getTime() <= Date.now();
            const isCancelled = (event.status || '').toLowerCase() === 'cancelled';
            const isFinished =
              !isCancelled &&
              (isPast ||
                event.status === 'completed' ||
                event.status === 'finished' ||
                event.status === 'done');

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventBubble}>
                  <Text style={styles.eventDate}>
                    {formatEventDate(event.eventAt) || 'Sin fecha'}
                  </Text>
                  <Text style={styles.eventPartner}>
                    Con: {event.partner?.nombre || 'usuario'}
                  </Text>
                </View>
                {isCancelled ? (
                  <View style={styles.finishedBadge}>
                    <Text style={styles.finishedText}>Cancelado</Text>
                  </View>
                ) : isFinished ? (
                  <View style={styles.finishedBadge}>
                    <Text style={styles.finishedText}>Finalizado</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      cancellingEvent === event.id && { opacity: 0.5 },
                    ]}
                    disabled={cancellingEvent === event.id || isPast}
                    onPress={() => handleCancelEvent(event.id)}
                  >
                    <Text style={styles.cancelText}>
                      {cancellingEvent === event.id ? 'Cancelando...' : 'Cancelar'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      );
    }
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>Seccion en construccion.</Text>
      </View>
    );
  }, [
    activeTab,
    calendarError,
    calendarEvents,
    cancellingEvent,
    formatEventDate,
    handleCancelEvent,
    isOwnProfile,
    loadingCalendar,
    loadingPosts,
    posts,
  ]);

  if (initializing || loadingProfile || !profile) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#59f5c9" />
        <Text style={styles.stateText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      key={profileUserId}
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        { paddingHorizontal: horizontalPadding },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.backRow, { width: '100%', maxWidth: contentMaxWidth }]}
        onPress={() => router.push('/(tabs)')}
        activeOpacity={0.85}
      >
        <Ionicons name="chevron-back" size={22} color="#14f195" />
        <Text style={styles.backText}>SkillSwapp</Text>
      </TouchableOpacity>

      <View style={[styles.profileCard, { width: '100%', maxWidth: contentMaxWidth }]}>
        <View style={styles.profileHeader}>
          <TouchableOpacity
            activeOpacity={isOwnProfile ? 0.8 : 1}
            onPress={() => {
              if (isOwnProfile) setPhotoModal(true);
            }}
          >
            <Image source={{ uri: profile.fotoUrl || DEFAULT_AVATAR }} style={styles.avatar} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.nombre || 'Sin nombre'}</Text>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            {profile.ciudad || profile.region ? (
              <Text style={styles.location}>
                {[profile.ciudad, profile.region].filter(Boolean).join(', ')}
              </Text>
            ) : null}
          </View>
          {isOwnProfile && (
            <View style={styles.profileActions}>
              <TouchableOpacity style={styles.editButton} onPress={() => setEditOpen(true)}>
                <Ionicons name="create-outline" size={18} color="#0b7147" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutButton, loggingOut && { opacity: 0.6 }]}
                onPress={handleLogout}
                disabled={loggingOut}
              >
                <Ionicons name="log-out-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsRow}
        >
          {tabs
            .filter((tab) => (tab.key === 'calendario' ? isOwnProfile : true))
            .map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabPill, activeTab === tab.key && styles.tabPillActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      <View style={[styles.contentCard, { width: '100%', maxWidth: contentMaxWidth }]}>
        {content}
      </View>

      <Modal
        visible={!!showReviewFormFor}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewFormFor(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Escribir reseña</Text>
            <Text style={styles.modalSubtitle}>
              {showReviewFormFor?.title || 'Publicación'}
            </Text>
            <Text style={styles.modalLabel}>Calificación (1 a 5)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setReviewRating(n)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={n <= reviewRating ? 'star' : 'star-outline'}
                    size={24}
                    color="#ffd44f"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>Comentario (opcional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Comparte tu experiencia"
              placeholderTextColor="#6b7280"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              textAlignVertical="top"
            />
            {reviewError ? <Text style={styles.modalError}>{reviewError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setShowReviewFormFor(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirm, savingReview && { opacity: 0.6 }]}
                disabled={savingReview}
                onPress={async () => {
                  if (!showReviewFormFor?.id) return;
                  if (!canReviewPost(showReviewFormFor)) {
                    setReviewError('Solo puedes reseñar a usuarios con los que hiciste match.');
                    return;
                  }
                  if (!reviewRating) {
                    setReviewError('Selecciona una calificación');
                    return;
                  }
                  const existing = reviewsByPost[showReviewFormFor.id] || [];
                  if (existing.some((r) => r.studentUid === viewerUid)) {
                    setReviewError('Ya enviaste una reseña para esta publicación.');
                    return;
                  }
                  setReviewError(null);
                  try {
                    setSavingReview(true);
                    await createReview({
                      postId: showReviewFormFor.id,
                      rating: reviewRating,
                      comment: reviewComment.trim() || undefined,
                    });
                    await loadReviewsForPost(showReviewFormFor.id);
                    setShowReviewFormFor(null);
                    Alert.alert('Gracias por tu reseña');
                  } catch (err: any) {
                    const msg = err?.message || '';
                    if (msg.includes('403') || msg.toLowerCase().includes('no puedes')) {
                      setReviewError('No tienes permiso para reseñar esta publicación.');
                    } else {
                      setReviewError(err?.message || 'No se pudo enviar la reseña.');
                    }
                  } finally {
                    setSavingReview(false);
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {savingReview ? 'Enviando...' : 'Enviar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <View style={styles.editHeader}>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <TouchableOpacity style={styles.editClose} onPress={() => setEditOpen(false)}>
                <Ionicons name="close" size={22} color="#cdd6f6" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.editModalContent}
            >
              <Text style={styles.modalLabel}>Nombre</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.nombre}
                onChangeText={(v) => setEditForm((prev) => ({ ...prev, nombre: v }))}
                placeholder="Tu nombre"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.modalLabel}>Bio</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 80 }]}
                value={editForm.bio}
                onChangeText={(v) => setEditForm((prev) => ({ ...prev, bio: v }))}
                placeholder="Cuenta algo sobre ti"
                placeholderTextColor="#6b7280"
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.modalLabel}>Ciudad</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.ciudad}
                onChangeText={(v) => setEditForm((prev) => ({ ...prev, ciudad: v }))}
                placeholder="Ciudad"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.modalLabel}>Regi??n</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.region}
                onChangeText={(v) => setEditForm((prev) => ({ ...prev, region: v }))}
                placeholder="Regi??n"
                placeholderTextColor="#6b7280"
              />
              {/* campo Foto (URL) eliminado */}
              {editError ? <Text style={styles.modalError}>{editError}</Text> : null}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={() => setEditOpen(false)}
                  disabled={editSaving}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirm, editSaving && { opacity: 0.6 }]}
                  disabled={editSaving}
                  onPress={async () => {
                    try {
                      setEditSaving(true);
                      setEditError(null);
                      await updateMyProfile(editForm);
                      await reload();
                      setEditOpen(false);
                    } catch (err: any) {
                      setEditError(err?.message || 'No se pudo actualizar el perfil.');
                    } finally {
                      setEditSaving(false);
                    }
                  }}
                >
                  <Text style={styles.modalConfirmText}>
                    {editSaving ? 'Guardando...' : 'Guardar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={photoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar foto de perfil</Text>
            <Text style={styles.modalLabel}>Desde la galería/archivos</Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalConfirm, uploadingPhoto && { opacity: 0.6 }]}
              disabled={uploadingPhoto}
              onPress={async () => {
                try {
                  setUploadingPhoto(true);
                  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!permission.granted) {
                    setEditError('Necesitas permisos para acceder a tus fotos.');
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({
                    allowsEditing: true,
                    mediaTypes: ImagePicker.MediaType.Images,
                    quality: 0.85,
                  });
                  if (result.canceled || !result.assets?.length) return;
                  const uri = result.assets[0].uri;
                  const user = auth.currentUser;
                  if (!user) throw new Error('No hay sesión activa.');
                  const response = await fetch(uri);
                  const blob = await response.blob();
                  const fileRef = ref(
                    storage,
                    `uploads/avatars/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
                  );
                  await uploadBytes(fileRef, blob, {
                    contentType: blob.type || 'image/jpeg',
                  });
                  const downloadUrl = await getDownloadURL(fileRef);
                  await updateMyProfile({ fotoUrl: downloadUrl });
                  await reload();
                  setPhotoUrlInput(downloadUrl);
                  setPhotoModal(false);
                } catch (err: any) {
                  setEditError(err?.message || 'No se pudo actualizar la foto.');
                } finally {
                  setUploadingPhoto(false);
                }
              }}
            >
              {uploadingPhoto ? (
                <ActivityIndicator color="#032415" />
              ) : (
                <Text style={styles.modalConfirmText}>Elegir foto</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Usar URL</Text>
            <TextInput
              style={styles.modalInput}
              value={photoUrlInput}
              onChangeText={setPhotoUrlInput}
              placeholder="https://..."
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setPhotoModal(false)}
                disabled={uploadingPhoto}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirm, uploadingPhoto && { opacity: 0.6 }]}
                disabled={uploadingPhoto}
                onPress={async () => {
                  if (!photoUrlInput.trim()) {
                    setEditError('Ingresa una URL válida.');
                    return;
                  }
                  try {
                    setUploadingPhoto(true);
                    setEditError(null);
                    await updateMyProfile({ fotoUrl: photoUrlInput.trim() });
                    await reload();
                    setPhotoModal(false);
                  } catch (err: any) {
                    setEditError(err?.message || 'No se pudo actualizar la foto.');
                  } finally {
                    setUploadingPhoto(false);
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {uploadingPhoto ? 'Guardando...' : 'Guardar URL'}
                </Text>
              </TouchableOpacity>
            </View>
            {editError ? <Text style={styles.modalError}>{editError}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#040315',
  },
  screenContent: {
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backText: {
    color: '#14f195',
    fontSize: 18,
    fontWeight: '800',
  },
  profileCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: '#0d152e',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#14f195',
  },
  name: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  bio: {
    color: '#cdd6f6',
    marginTop: 4,
  },
  location: {
    color: '#8ba3cb',
    marginTop: 4,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#14f195',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ff6b7a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsScroll: {
    marginTop: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  tabPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#1b2344',
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: '#14f195',
  },
  tabText: {
    color: '#7a8bb2',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#04121c',
  },
  contentCard: {
    borderRadius: 24,
    backgroundColor: '#0d162f',
    paddingVertical: 8,
    minHeight: 200,
  },
  eventsList: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  eventCard: {
    padding: 4,
    borderRadius: 26,
    backgroundColor: '#050d23',
    borderWidth: 1,
    borderColor: '#192954',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventBubble: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#12254d',
    borderWidth: 1,
    borderColor: '#2a3e74',
    shadowColor: '#020814',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  eventDate: {
    color: '#fdfdff',
    fontWeight: '800',
    fontSize: 17,
  },
  eventPartner: {
    color: '#bcd3ff',
    marginTop: 8,
    fontWeight: '600',
  },
  finishedBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#12254d',
    borderWidth: 1,
    borderColor: '#2a3e74',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishedText: {
    color: '#9fb4d8',
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#ff6b7a',
  },
  cancelText: {
    color: '#fff',
    fontWeight: '700',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#040315',
    gap: 12,
  },
  stateBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  stateText: {
    color: '#cdd6f6',
    textAlign: 'center',
  },
  postCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#0d1a34',
    borderWidth: 1,
    borderColor: '#18254a',
    gap: 12,
  },
  postHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  postTitle: {
    color: '#f7fbff',
    fontSize: 16,
    fontWeight: '700',
  },
  postDescription: {
    color: '#bbc7ec',
    marginTop: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#112841',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    color: '#ffd44f',
    fontWeight: '700',
  },
  ratingCount: {
    color: '#9fb4d8',
    fontSize: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#14f195',
  },
  reviewText: {
    color: '#03271a',
    fontWeight: '700',
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#233458',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewList: {
    marginTop: 10,
    gap: 8,
  },
  reviewItem: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0f1f3d',
    borderWidth: 1,
    borderColor: '#1a2c50',
    gap: 4,
  },
  reviewRating: {
    color: '#ffd44f',
    fontWeight: '700',
  },
  reviewAuthor: {
    color: '#cdd6f6',
  },
  reviewComment: {
    color: '#c0c9ea',
    lineHeight: 18,
  },
  reviewMore: {
    color: '#9fb4d8',
    fontSize: 12,
  },
  reviewWriteButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#13f195',
  },
  reviewWriteText: {
    color: '#032617',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#0d162f',
    padding: 18,
    gap: 10,
  },
  editModalCard: {
    width: '94%',
    maxWidth: 720,
    maxHeight: '86%',
    borderRadius: 24,
    backgroundColor: '#0d162f',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121f3d',
    borderWidth: 1,
    borderColor: '#1f2f59',
  },
  editModalContent: {
    paddingBottom: 12,
    gap: 10,
  },
  modalTitle: {
    color: '#f8fbff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#9fb2df',
  },
  modalLabel: {
    color: '#cdd6f6',
    fontWeight: '600',
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  starButton: {
    padding: 6,
  },
  modalInput: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#101b3c',
    borderWidth: 1,
    borderColor: '#1f2f59',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalCancel: {
    backgroundColor: '#132241',
  },
  modalCancelText: {
    color: '#d0d9fc',
    fontWeight: '700',
  },
  modalConfirm: {
    backgroundColor: '#14f195',
  },
  modalConfirmText: {
    color: '#032415',
    fontWeight: '700',
  },
  modalError: {
    color: '#ff9a9a',
  },
  reviewConstraint: {
    color: '#9fb4d8',
    fontSize: 12,
    marginTop: 6,
  },
  captureButton: {
    marginTop: 0,
    paddingHorizontal: 28,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#14f195',
    minWidth: 180,
  },
  photoCtas: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: -14,
    marginBottom: 4,
  },
  captureText: {
    color: '#032617',
    fontWeight: '800',
    textAlign: 'center',
  },
  photoDraft: {
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2f59',
    backgroundColor: '#0b1220',
  },
  photoDescInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2f59',
    backgroundColor: '#0f1f3d',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayCard: {
    width: '94%',
    maxWidth: 520,
    backgroundColor: '#0d162f',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  photoGrid: {
    width: '100%',
    marginTop: 16,
    gap: 12,
    paddingHorizontal: 0,
  },
  photoPost: {
    backgroundColor: '#0f1f3d',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f2f59',
    position: 'relative',
  },
  photoDelete: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0f233f',
    borderWidth: 1,
    borderColor: '#14f195',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  photoHeaderName: {
    color: '#f8fbff',
    fontWeight: '700',
    fontSize: 13,
  },
  photoHeaderDesc: {
    color: '#9fb4d8',
    fontSize: 11,
    marginTop: 2,
  },
  photoHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#18254a',
    backgroundColor: '#0b1220',
  },
  photoHero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: '#0b1220',
  },
  photoCaption: {
    marginTop: 6,
    color: '#d5defa',
    fontSize: 13,
  },
  statsContainer: {
    padding: 16,
    gap: 16,
  },
  statsCard: {
    backgroundColor: '#0a1428',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a2d4f',
  },
  statsTitle: {
    color: '#f8fbff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#14f195',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: '#9fb4d8',
    fontSize: 11,
    marginTop: 4,
  },
  statRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsRoles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  roleChip: {
    flex: 1,
    backgroundColor: '#12254d',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  roleText: {
    color: '#cdd6f6',
    fontSize: 12,
    fontWeight: '600',
  },
  statsTimeText: {
    color: '#14f195',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  statsSubtext: {
    color: '#9fb4d8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
