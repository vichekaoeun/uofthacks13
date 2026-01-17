import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, View, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Image, ScrollView, Alert, useWindowDimensions } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { commentsAPI } from '@/services/api';

const FALLBACK_REGION: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

type MapMode = 'discover' | 'follow';
const FOLLOW_DELTA = 0.001;
const PAN_AWAY_METERS = 60;
// Simple minimal map style - adjust colors as needed
const MINIMAL_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#F5F5F1' }], // land
  },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }], // Show icons
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }], // Darker text
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#f5f5f5' }], // Light stroke
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'on' }], // Hide points of interest
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#F5F5F1' }], // White roads
  },
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [{ visibility: 'on' }], // Hide road labels
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#CDD5E2' }], // water
  },
  {
    featureType: 'water',
    elementType: 'labels.text',
    stylers: [{ visibility: 'on' }],
  },
  {
  featureType: 'landscape.man_made',
  elementType: 'geometry',
  stylers: [{ color: '#E3E3D4' }], // Building color
},
];

type MediaAttachment = {
  uri: string;
  type: 'photo' | 'video';
};

type CommentItem = {
  _id: string;
  userId: string;
  username: string;
  displayUsername?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  content: {
    text: string | null;
    mediaUrl: string | null;
  };
  createdAt: string;
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MapMode>('follow');
  const previousDeltaRef = useRef(region.latitudeDelta);
  const isAnimatingRef = useRef(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const vignetteOpacity = useRef(new Animated.Value(1)).current;
  const { user, logout } = useAuth();
  const [showPostModal, setShowPostModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [mediaAttachment, setMediaAttachment] = useState<MediaAttachment | null>(null);
  const [composeMode, setComposeMode] = useState<'post' | 'comment'>('post');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

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
          latitudeDelta: FOLLOW_DELTA,
          longitudeDelta: FOLLOW_DELTA,
        };
        setRegion(nextRegion);
        previousDeltaRef.current = nextRegion.latitudeDelta;
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

    const startWatching = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 200,
          distanceInterval: 3,
        },
        (position) => {
          setCurrentLocation(position);
          if (mode === 'follow') {
            const nextRegion: Region = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              latitudeDelta: FOLLOW_DELTA,
              longitudeDelta: FOLLOW_DELTA,
            };
            isAnimatingRef.current = true;
            setRegion(nextRegion);
            mapRef.current?.animateToRegion(nextRegion, 450);
            setTimeout(() => {
              isAnimatingRef.current = false;
            }, 500);
          }
        }
      );
    };

    void startWatching();

    return () => {
      isMounted = false;
      locationWatchRef.current?.remove();
      locationWatchRef.current = null;
    };
  }, [mode]);

  const overlayStyle = useMemo(
    () => [
      styles.overlay,
      {
        backgroundColor: Colors[colorScheme ?? 'light'].background,
        top: 0,
        paddingTop: insets.top + 16
      },
    ],
    [colorScheme, insets.top]
  );

  const handleRecenter = () => {
    if (currentLocation) {
      const nextRegion: Region = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: FOLLOW_DELTA,
        longitudeDelta: FOLLOW_DELTA,
      };
      setMode('follow');
      isAnimatingRef.current = true;
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 450);
      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 500);
    }
  };

  const handleRegionChange = (nextRegion: Region) => {
    if (isAnimatingRef.current) return;
    if (!currentLocation) return;

    const zoomedOut = nextRegion.latitudeDelta > FOLLOW_DELTA + 0.00005;
    const distanceMeters = getDistanceMeters(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      nextRegion.latitude,
      nextRegion.longitude
    );
    const pannedAway = distanceMeters > PAN_AWAY_METERS;

    if (mode === 'follow' && (zoomedOut || pannedAway)) {
      setMode('discover');
    }
  };

  const handleRegionChangeComplete = (nextRegion: Region) => {
    setRegion(nextRegion);
    previousDeltaRef.current = nextRegion.latitudeDelta;
  };

  useEffect(() => {
    Animated.timing(vignetteOpacity, {
      toValue: mode === 'follow' ? 1 : 0,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [mode, vignetteOpacity]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!currentLocation) return;
      try {
        const data = await commentsAPI.getNearby(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          500,
          user?._id
        );
        setComments(Array.isArray(data) ? data : []);
      } catch (error) {
        console.log('Failed to load comments', error);
      }
    };

    void fetchComments();
  }, [currentLocation, user]);

  const handlePost = async () => {
    if (!postContent.trim()) return;

    if (composeMode === 'comment') {
      if (!user || !currentLocation) {
        Alert.alert('Login required', 'Please login to send comments.');
        return;
      }

      setIsSubmittingComment(true);
      try {
        const created = await commentsAPI.create({
          userId: user._id,
          username: user.username,
          lat: currentLocation.coords.latitude,
          lon: currentLocation.coords.longitude,
          text: postContent.trim(),
        });
        setComments((prev) => [created, ...prev]);
        setPostContent('');
        setShowPostModal(false);
      } catch (error) {
        Alert.alert('Error', 'Failed to send comment.');
      } finally {
        setIsSubmittingComment(false);
      }
      return;
    }

    console.log('Posting:', postContent, 'Media:', mediaAttachment);
    // TODO: send post to MongoDB when media uploads are wired
    setPostContent('');
    setMediaAttachment(null);
    setShowPostModal(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setMediaAttachment({ uri: result.assets[0].uri, type: 'photo' });
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setMediaAttachment({ uri: result.assets[0].uri, type: 'photo' });
    }
  };

  const recordVideo = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 60,
      quality: 1,
    });

    if (!result.canceled) {
      setMediaAttachment({ uri: result.assets[0].uri, type: 'video' });
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });

    if (!result.canceled) {
      setMediaAttachment({ uri: result.assets[0].uri, type: 'video' });
    }
  };

  const handleAddMedia = () => {
    Alert.alert('Add Media', 'Choose how to attach media.', [
      {
        text: 'Record Video',
        onPress: recordVideo,
      },
      {
        text: 'Choose Video',
        onPress: pickVideo,
      },
      {
        text: 'Take Photo',
        onPress: takePhoto,
      },
      {
        text: 'Choose from Library',
        onPress: pickImage,
      },
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
    ]);
  };

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={[styles.container, styles.webFallback]}>
        <StatusBar translucent backgroundColor="transparent" />
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
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
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
        {comments.map((comment) => {
          const isAnonymous = comment.displayUsername === 'anonymous';
          return (
            <Marker
              key={comment._id}
              coordinate={{
                latitude: comment.location.coordinates[1],
                longitude: comment.location.coordinates[0],
              }}
              title={comment.displayUsername || comment.username}
              description={comment.content?.text ?? ''}
            >
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: isAnonymous ? '#808080' : '#2d8941',
                borderWidth: 2,
                borderColor: 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }} />
            </Marker>
          );
        })}
      </MapView>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: vignetteOpacity }]}>
        <Svg width={width} height={height} style={styles.vignetteSvg}>
          <Defs>
            <RadialGradient
              id="vignette"
              cx={width / 2}
              cy={height / 2}
              r={Math.min(width, height) / 2}
              gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="65%" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="85%" stopColor="#FFFFFF" stopOpacity={0.35} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.65} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#vignette)" />
        </Svg>
      </Animated.View>

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

      {/* Plus button in bottom right */}
      <Pressable
        style={styles.plusButton}
        onPress={() => {
          setComposeMode('comment');
          setShowPostModal(true);
        }}>
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

      {/* Post Modal */}
      <Modal
        visible={showPostModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPostModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowPostModal(false)}>
                  <Ionicons name="close" size={28} color={Colors[colorScheme ?? 'light'].text} />
                </Pressable>
                <ThemedText type="title">
                  {composeMode === 'comment' ? 'Add Comment' : 'Create Post'}
                </ThemedText>
                <Pressable onPress={handlePost} disabled={!postContent.trim() || isSubmittingComment}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{
                      color: postContent.trim() && !isSubmittingComment ? '#007AFF' : '#ccc',
                    }}
                  >
                    {composeMode === 'comment' ? 'Send' : 'Post'}
                  </ThemedText>
                </Pressable>
              </View>

              <View style={styles.modeToggle}>
                <Pressable
                  style={[styles.modeOption, composeMode === 'comment' && styles.modeOptionActive]}
                  onPress={() => setComposeMode('comment')}>
                  <ThemedText type="defaultSemiBold">Comment</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modeOption, composeMode === 'post' && styles.modeOptionActive]}
                  onPress={() => setComposeMode('post')}>
                  <ThemedText type="defaultSemiBold">Post</ThemedText>
                </Pressable>
              </View>

              <ScrollView style={styles.scrollContent}>
                {/* Input */}
                <TextInput
                  style={[
                    styles.textInput,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}
                  placeholder="What makes this place yours?"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                  multiline
                  value={postContent}
                  onChangeText={setPostContent}
                />

                {composeMode === 'post' ? (
                  <>
                    {/* Selected Media */}
                    {mediaAttachment && (
                      <View style={styles.mediaContainer}>
                        {mediaAttachment.type === 'photo' ? (
                          <Image source={{ uri: mediaAttachment.uri }} style={styles.selectedMedia} />
                        ) : (
                          <Video
                            style={styles.selectedMedia}
                            source={{ uri: mediaAttachment.uri }}
                            useNativeControls
                            resizeMode={ResizeMode.COVER}
                            isLooping
                          />
                        )}
                        <Pressable
                          style={styles.removeMediaButton}
                          onPress={() => setMediaAttachment(null)}
                        >
                          <Ionicons name="close-circle" size={28} color="#fff" />
                        </Pressable>
                      </View>
                    )}

                    {/* Media Upload Button */}
                    <Pressable style={styles.mediaButton} onPress={handleAddMedia}>
                      <Ionicons name="image" size={24} color="#007AFF" />
                      <ThemedText type="defaultSemiBold" style={{ color: '#007AFF', marginLeft: 8 }}>
                        Add Photo or Video
                      </ThemedText>
                    </Pressable>
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const getDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  vignetteSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
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
  plusButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  webFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 300,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  modeOptionActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 20,
  },
  mediaContainer: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
});