import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { auth } from '@/src/services/firebase';
import { getMyNotifications } from '@/src/services/notifications';
import { getMatches } from '@/src/services/interactions';

const RoundedBackground = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.tabBarShell}>
    <View style={styles.tabBar}>{children}</View>
  </View>
);

const TabButton = (props: any) => {
  const { onPress, accessibilityState, icon, label, badge } = props;
  const active = accessibilityState.selected;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.tabButton}>
      <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: 'center' }}>
        <View>
          <Ionicons
            name={icon}
            size={22}
            color={active ? '#ffffff' : '#d2dbe7'}
            style={{ marginBottom: 2 }}
          />
          {badge && badge > 0 ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : `${badge}`}</Text>
            </Animated.View>
          ) : null}
        </View>
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? 'light'].tint;
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  const refreshBadges = React.useCallback(async () => {
    try {
      const notifs = await getMyNotifications();
      const unread = (notifs?.items || notifs || []).filter((n: any) => !n.read).length;
      setUnreadNotifications(unread);
    } catch (err) {
      // ignore
    }
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
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace('/');
      }
    });
    return () => unsub();
  }, [router]);

  useFocusEffect(
    React.useCallback(() => {
      refreshBadges();
    }, [refreshBadges])
  );

  const badgeByRoute = useMemo(
    () => ({
      likes: unreadChats,
      notifications: unreadNotifications,
    }),
    [unreadChats, unreadNotifications]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarStyle: { position: 'absolute', height: 0 },
        tabBarBackground: () => <RoundedBackground children={null} />,
        tabBarButton: (props) => <HapticTab {...props} />,
      }}
      tabBar={(props) => {
        const activeRoute = props.state.routes[props.state.index]?.name;
        if (activeRoute === 'explore') {
          // Hide bottom bar on the matches screen
          return null;
        }
        return (
          <RoundedBackground>
            {props.state.routes.map((route, index) => {
              if (route.name === 'explore') {
                // Do not show a tab button for the hidden matches screen
                return null;
              }
              const { options } = props.descriptors[route.key];
              const isFocused = props.state.index === index;
              const onPress = () => {
                const event = props.navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  props.navigation.navigate(route.name);
                }
              };
              const icon =
                route.name === 'index'
                  ? 'home'
                  : route.name === 'likes'
                  ? 'heart'
                  : route.name === 'notifications'
                  ? 'notifications'
                  : route.name === 'profile'
                  ? 'person'
                  : 'ellipse';
              return (
                <TabButton
                  key={route.key}
                  onPress={onPress}
                  accessibilityState={{ selected: isFocused }}
                  icon={icon}
                  label={options.title ?? route.name}
                  badge={badgeByRoute[route.name as keyof typeof badgeByRoute] || 0}
                />
              );
            })}
            <TouchableOpacity style={styles.fab} onPress={() => router.push('/create')}>
              <Ionicons name="add" size={26} color="#07a45a" />
            </TouchableOpacity>
          </RoundedBackground>
        );
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Likes',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alertas',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          // Hidden from bottom bar, used for matches screen
          href: null,
          title: 'Chats',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarShell: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  tabBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#00c48c',
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 12,
    shadowColor: '#00c48c',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: '#d2dbe7',
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#ff6b7a',
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    top: -24,
    left: '50%',
    marginLeft: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
});
