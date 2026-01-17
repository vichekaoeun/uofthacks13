import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

const FALLBACK_REGION: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();

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
          }
        },
      ]
    );
  };

  useEffect(() => {
    let isMounted = true;

    const loadLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setErrorMessage('Location permission denied. Showing default map view.');
            setLoading(false);
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isMounted) return;

        setCurrentLocation(position);
        const nextRegion: Region = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(nextRegion);
      } catch (error) {
        if (isMounted) {
          setErrorMessage('Unable to fetch location. Showing default map view.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const overlayStyle = useMemo(
    () => [styles.overlay, { backgroundColor: Colors[colorScheme ?? 'light'].background, top: insets.top + 8 }],
    [colorScheme, insets.top]
  );

  const handleRecenter = () => {
    if (currentLocation) {
      const nextRegion: Region = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 450);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={[styles.container, styles.webFallback]}>
        <ThemedText type="title">Map view</ThemedText>
        <ThemedText>
          Map rendering is only available on iOS/Android in this build. Open the app in Expo Go to
          see the live map.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton>
        {currentLocation ? (
          <Marker
            coordinate={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            }}
            title="You"
          />
        ) : null}
      </MapView>

      <View style={overlayStyle}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="title">HereAndNow</ThemedText>
            <ThemedText>Nearby memories are displayed on the map.</ThemedText>
            {user && <ThemedText style={styles.userInfo}>Logged in as: {user.username}</ThemedText>}
          </View>
          {user && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <ThemedText style={styles.logoutText}>Logout</ThemedText>
            </TouchableOpacity>
          )}
        </View>
        {errorMessage ? <ThemedText>{errorMessage}</ThemedText> : null}
        {loading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <Pressable style={styles.button} onPress={handleRecenter}>
            <ThemedText type="defaultSemiBold">Recenter</ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  userInfo: {
    fontSize: 12,
    marginTop: 4,
  },
  logoutBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  spinner: {
    alignSelf: 'flex-start',
  },
  webFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
});
