import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { DEFAULT_AVATAR } from '@/constants/images';

const { width } = Dimensions.get('window');

interface MatchModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenChat: () => void;
  otherUserName?: string;
  otherUserPhoto?: string | null;
  myPhoto?: string | null;
}

export function MatchModal({
  visible,
  onClose,
  onOpenChat,
  otherUserName = 'Usuario',
  otherUserPhoto,
  myPhoto,
}: MatchModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, scaleAnim, fadeAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <Ionicons name="heart" size={48} color="#ff4458" />
            <Text style={styles.title}>¡Es un Match!</Text>
            <Text style={styles.subtitle}>
              A {otherUserName} también le gustó tu publicación
            </Text>
          </View>

          <View style={styles.avatarsContainer}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: myPhoto || DEFAULT_AVATAR }}
                style={styles.avatar}
                contentFit="cover"
              />
            </View>
            <View style={styles.heartBadge}>
              <Ionicons name="heart" size={32} color="#fff" />
            </View>
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: otherUserPhoto || DEFAULT_AVATAR }}
                style={styles.avatar}
                contentFit="cover"
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.chatButton} onPress={onOpenChat}>
              <Ionicons name="chatbubbles" size={20} color="#052014" />
              <Text style={styles.chatButtonText}>Abrir Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Continuar explorando</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: width - 48,
    maxWidth: 400,
    borderRadius: 32,
    backgroundColor: '#0d1530',
    padding: 32,
    alignItems: 'center',
    gap: 32,
    shadowColor: '#14f195',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9aa0ab',
    textAlign: 'center',
    lineHeight: 22,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  avatarWrapper: {
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#14f195',
    padding: 4,
    backgroundColor: '#0a1428',
    shadowColor: '#14f195',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  heartBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff4458',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4458',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#14f195',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#14f195',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  chatButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#052014',
  },
  closeButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7ed7ff',
  },
});
