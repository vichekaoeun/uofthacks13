import { StyleSheet, Alert, TouchableOpacity, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const isDark = colorScheme === 'dark';

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          }
        },
      ]
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
          <ThemedText style={styles.subtitle}>Manage your account</ThemedText>
        </View>

        {user && (
          <>
            {/* User Profile Section */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Account</ThemedText>
              <View style={[styles.card, { borderColor: isDark ? '#444' : '#ddd' }]}>
                <View style={styles.profileHeader}>
                  <View style={[styles.avatar, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
                    <Ionicons name="person" size={24} color="#fff" />
                  </View>
                  <View style={styles.userInfo}>
                    <ThemedText style={styles.username}>{user.username}</ThemedText>
                    <ThemedText style={styles.email}>{user.email}</ThemedText>
                  </View>
                </View>
              </View>
            </View>

            {/* About Section */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>About</ThemedText>
              <View style={[styles.card, { borderColor: isDark ? '#444' : '#ddd' }]}>
                <View style={styles.aboutItem}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[colorScheme ?? 'light'].tint} />
                  <View style={styles.aboutText}>
                    <ThemedText style={styles.aboutLabel}>Version</ThemedText>
                    <ThemedText style={styles.aboutValue}>1.0.0</ThemedText>
                  </View>
                </View>
              </View>
            </View>

            {/* Logout Button */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={[styles.logoutBtn, { backgroundColor: isDark ? '#4a3a3a' : '#ffe6e6' }]} 
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
                <ThemedText style={styles.logoutText}>Logout</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <ThemedText style={styles.footerText}>NowAndThen © 2026</ThemedText>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 12,
    opacity: 0.6,
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutText: {
    marginLeft: 12,
    flex: 1,
  },
  aboutLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
  },
});
