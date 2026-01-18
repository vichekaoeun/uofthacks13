import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, View, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Image, ScrollView, Alert, useWindowDimensions } from 'react-native';
import MapView, { Marker, Region, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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
  contentType?: 'text' | 'photo' | 'video';
  content: {
    text: string | null;
    mediaUrl: string | null;
  };
  likes?: number;
  likedByMe?: boolean;
  createdAt: string;
};

type ClusterSortMode = 'recent' | 'likes';

type PostCluster = {
  id: string;
  center: { latitude: number; longitude: number };
  median: { latitude: number; longitude: number };
  items: CommentItem[];
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const buttonHitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<MapMode>('follow');
  const previousDeltaRef = useRef(region.latitudeDelta);
  const isAnimatingRef = useRef(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const vignetteOpacity = useRef(new Animated.Value(1)).current;
  const { user } = useAuth();
  const [showPostModal, setShowPostModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [mediaAttachment, setMediaAttachment] = useState<MediaAttachment | null>(null);
  const [composeMode, setComposeMode] = useState<'post' | 'comment'>('post');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentRadius, setCommentRadius] = useState(500);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isAnimatingPath, setIsAnimatingPath] = useState(false);
  const [animatedPathProgress, setAnimatedPathProgress] = useState(0);

  const [selectedComment, setSelectedComment] = useState<CommentItem | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<PostCluster | null>(null);
  const [clusterSortMode, setClusterSortMode] = useState<ClusterSortMode>('recent');
  const [clusterTitles, setClusterTitles] = useState<Record<string, string>>({});
  const wasInFollowModeRef = useRef(false);

  const lastPostTimeRef = useRef<number>(0);
  const lastLikeActionRef = useRef<number>(0);
  const fetchCommentsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);



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
          accuracy:
            Platform.OS === 'ios'
              ? Location.Accuracy.BestForNavigation
              : Location.Accuracy.Balanced,
          timeInterval: Platform.OS === 'ios' ? 500 : 1000,
          distanceInterval: Platform.OS === 'ios' ? 1 : 10,
          mayShowUserSettingsDialog: true,
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
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        top: 0,
        paddingTop: insets.top + 10
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

  const handleCloseComment = () => {
    setSelectedComment(null);
    if (wasInFollowModeRef.current) {
      handleRecenter();
    }
  };

  const handleCloseCluster = () => {
    setSelectedCluster(null);
  };

  const handleLike = async (commentId: string) => {
    if (!user?._id) {
      Alert.alert('Login required', 'Please log in to like posts.');
      return;
    }
    lastLikeActionRef.current = Date.now();
    const findExisting = (items: CommentItem[]) => items.find((c) => c._id === commentId);

    const existing =
      findExisting(comments) ||
      (selectedComment && selectedComment._id === commentId ? selectedComment : undefined) ||
      (selectedCluster ? findExisting(selectedCluster.items) : undefined);

    const wasLikedByMe = existing?.likedByMe ?? false;
    const previousLikes = existing?.likes ?? 0;

    const applyOptimistic = (items: CommentItem[]) =>
      items.map((c) =>
        c._id === commentId
          ? {
              ...c,
              likedByMe: !wasLikedByMe,
              likes: Math.max(0, (c.likes ?? 0) + (wasLikedByMe ? -1 : 1)),
            }
          : c
      );

    setComments((prev) => applyOptimistic(prev));
    setSelectedComment((prev) =>
      prev && prev._id === commentId
        ? {
            ...prev,
            likedByMe: !wasLikedByMe,
            likes: Math.max(0, (prev.likes ?? 0) + (wasLikedByMe ? -1 : 1)),
          }
        : prev
    );
    setSelectedCluster((prev) =>
      prev
        ? {
            ...prev,
            items: applyOptimistic(prev.items),
          }
        : prev
    );

    try {
      const result = await commentsAPI.toggleLike(commentId);
      if (typeof result?.likes === 'number' && typeof result?.liked === 'boolean') {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId ? { ...c, likes: result.likes, likedByMe: result.liked } : c
          )
        );
        setSelectedComment((prev) =>
          prev && prev._id === commentId
            ? { ...prev, likes: result.likes, likedByMe: result.liked }
            : prev
        );
        setSelectedCluster((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((c) =>
                  c._id === commentId ? { ...c, likes: result.likes, likedByMe: result.liked } : c
                ),
              }
            : prev
        );
      }
    } catch (_err) {
      setComments((prev) =>
        prev.map((c) =>
          c._id === commentId ? { ...c, likes: previousLikes, likedByMe: wasLikedByMe } : c
        )
      );
      setSelectedComment((prev) =>
        prev && prev._id === commentId
          ? { ...prev, likes: previousLikes, likedByMe: wasLikedByMe }
          : prev
      );
      setSelectedCluster((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((c) =>
                c._id === commentId ? { ...c, likes: previousLikes, likedByMe: wasLikedByMe } : c
              ),
            }
          : prev
      );
    }
  };

  const handleRegionChange = (nextRegion: Region) => {
    if (isAnimatingRef.current) return;
    if (!currentLocation) return;
    if (selectedComment) return; // Don't exit focus mode while viewing a comment

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
    if (mode === 'follow') {
      setSelectedCluster(null);
    }
  }, [mode]);

  const zoomedOutForClusters = useMemo(() => region.latitudeDelta > FOLLOW_DELTA * 1.2, [region.latitudeDelta]);

  const clusters = useMemo(() => {
    if (mode === 'follow' || !zoomedOutForClusters) return [] as PostCluster[];
    return buildClusters(comments, region);
  }, [comments, mode, region, zoomedOutForClusters]);

  const sortedClusterItems = useMemo(() => {
    if (!selectedCluster) return [] as CommentItem[];
    const items = [...selectedCluster.items];
    if (clusterSortMode === 'likes') {
      return items.sort((a, b) => {
        const likeDiff = (b.likes ?? 0) - (a.likes ?? 0);
        if (likeDiff !== 0) return likeDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [selectedCluster, clusterSortMode]);

  const resolveClusterTitle = async (cluster: PostCluster) => {
    if (clusterTitles[cluster.id]) return;
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: cluster.median.latitude,
        longitude: cluster.median.longitude,
      });
      const first = results[0];
      const title =
        first?.name ||
        first?.street ||
        first?.district ||
        first?.city ||
        first?.region ||
        'Nearby posts';
      setClusterTitles((prev) => (prev[cluster.id] ? prev : { ...prev, [cluster.id]: title }));
    } catch (error) {
      setClusterTitles((prev) => (prev[cluster.id] ? prev : { ...prev, [cluster.id]: 'Nearby posts' }));
    }
  };

  const handleSelectCluster = (cluster: PostCluster) => {
    setSelectedComment(null);
    setSelectedCluster(cluster);
    void resolveClusterTitle(cluster);
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
  // Debounce and prevent overwriting optimistically added comments
  if (fetchCommentsTimeoutRef.current) {
    clearTimeout(fetchCommentsTimeoutRef.current);
  }

  fetchCommentsTimeoutRef.current = setTimeout(async () => {
    if (!currentLocation) return;

    // Skip fetch if we just posted a comment (within 2 seconds)
    const timeSinceLastPost = Date.now() - lastPostTimeRef.current;
    if (timeSinceLastPost < 2000) return;

    // Skip fetch if we just liked/unliked a comment (within 2 seconds)
    const timeSinceLastLike = Date.now() - lastLikeActionRef.current;
    if (timeSinceLastLike < 2000) return;

    try {
      const data = await commentsAPI.getNearby(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        commentRadius,
        user?._id
      );
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Failed to load comments', error);
    }
  }, 1500);

  return () => {
    if (fetchCommentsTimeoutRef.current) {
      clearTimeout(fetchCommentsTimeoutRef.current);
    }
  };
}, [currentLocation, user, commentRadius]);

// Filter and sort comments by user for path animation
const getUserComments = (userId: string) => {
  return comments
    .filter((c) => c.userId === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

// Catmull-Rom spline interpolation for smooth, artful curves
const catmullRomSpline = (
  p0: { latitude: number; longitude: number },
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number },
  p3: { latitude: number; longitude: number },
  t: number
) => {
  const t2 = t * t;
  const t3 = t2 * t;

  const latitude =
    0.5 *
    ((2 * p1.latitude) +
      (-p0.latitude + p2.latitude) * t +
      (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
      (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3);

  const longitude =
    0.5 *
    ((2 * p1.longitude) +
      (-p0.longitude + p2.longitude) * t +
      (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
      (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3);

  return { latitude, longitude };
};

// Create smooth, artful curved path from all user comments
const getInterpolatedPath = (userComments: CommentItem[]) => {
  if (userComments.length < 2) return [];

  const points = userComments.map((c) => ({
    latitude: c.location.coordinates[1],
    longitude: c.location.coordinates[0],
  }));

  const interpolatedPath: { latitude: number; longitude: number }[] = [];
  const numPointsPerSegment = 30;

  interpolatedPath.push(points[0]);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let j = 1; j <= numPointsPerSegment; j++) {
      const t = j / numPointsPerSegment;
      interpolatedPath.push(catmullRomSpline(p0, p1, p2, p3, t));
    }
  }

  return interpolatedPath;
};

// Handle marker press to start path animation
const handleMarkerPress = (comment: CommentItem) => {
  if (comment.displayUsername === 'anonymous') return;

  const userComments = getUserComments(comment.userId);
  if (userComments.length <= 1) return;

  setSelectedUserId(comment.userId);
  setAnimatedPathProgress(0);
  setIsAnimatingPath(true);

  fitPathToView(userComments);
  animatePathLine(userComments.length);
};

// Fit all path comments in the map view
const fitPathToView = (userComments: CommentItem[]) => {
  const coordinates = userComments.map((c) => ({
    latitude: c.location.coordinates[1],
    longitude: c.location.coordinates[0],
  }));

  if (coordinates.length === 0) return;

  setMode('discover');
  isAnimatingRef.current = true;

  mapRef.current?.fitToCoordinates(coordinates, {
    edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
    animated: true,
  });

  setTimeout(() => {
    isAnimatingRef.current = false;
  }, 1000);
};

// Animate the dotted line drawing progressively
const animatePathLine = (_totalComments: number) => {
  const duration = 4000;
  const steps = 120;
  const stepDuration = duration / steps;
  let currentStep = 0;

  const intervalId = setInterval(() => {
    currentStep++;
    setAnimatedPathProgress(currentStep / steps);

    if (currentStep >= steps) {
      clearInterval(intervalId);
      setTimeout(() => {
        setIsAnimatingPath(false);
        setSelectedUserId(null);
        setAnimatedPathProgress(0);
      }, 10000);
    }
  }, stepDuration);
}; 
  const handlePost = async () => {
    if (composeMode === 'comment') {
      const trimmed = postContent.trim();

      if (!trimmed && !mediaAttachment) {
        Alert.alert('Add content', 'Please add text or attach a photo/video.');
        return;
      }

      if (!user || !currentLocation) {
        Alert.alert('Login required', 'Please login to send comments.');
        return;
      }

      setIsSubmittingComment(true);
      try {
        let mediaUrl: string | null = null;
        let contentType: 'text' | 'photo' | 'video' = 'text';

        if (mediaAttachment) {
          const uploadResult = await commentsAPI.uploadMedia(mediaAttachment);
          mediaUrl = uploadResult?.url || null;
          contentType = mediaAttachment.type;
        }

        const created = await commentsAPI.create({
          userId: user._id,
          username: user.username,
          lat: currentLocation.coords.latitude,
          lon: currentLocation.coords.longitude,
          text: trimmed || undefined,
          contentType,
          mediaUrl,
        });

        // Mark the time we posted to prevent fetch from overwriting
        lastPostTimeRef.current = Date.now();

        // Ensure the comment has the correct structure for display
        const commentId = created._id || `temp-${Date.now()}`;
        const newComment: CommentItem = {
          _id: commentId,
          userId: created.userId || user._id,
          username: created.username || user.username,
          displayUsername: created.displayUsername || user.username,
          location: created.location || {
            type: 'Point',
            coordinates: [currentLocation.coords.longitude, currentLocation.coords.latitude],
          },
          contentType: created.contentType || contentType,
          content: created.content || {
            text: trimmed || null,
            mediaUrl,
          },
          createdAt: created.createdAt || new Date().toISOString(),
        };

        setComments((prev) => [newComment, ...prev]);
        setPostContent('');
        setMediaAttachment(null);
        setShowPostModal(false);
      } catch (error) {
        const message =
          (error as any)?.response?.data?.error ||
          (error as any)?.message ||
          'Failed to send comment.';
        Alert.alert('Error', message);
      } finally {
        setIsSubmittingComment(false);
      }
      return;
    }

    if (!postContent.trim()) return;

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
        provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton>
        {/* Path Polyline - connects comments in chronological order (only when zoomed in) */}
        {isAnimatingPath && selectedUserId && (mode === 'follow' || !zoomedOutForClusters) && (() => {
          const userComments = getUserComments(selectedUserId);
          const fullPath = getInterpolatedPath(userComments);
          const numPointsToShow = Math.floor(animatedPathProgress * fullPath.length);
          const coordinatesToShow = fullPath.slice(0, Math.max(2, numPointsToShow));

          return coordinatesToShow.length > 1 ? (
            <Polyline
              coordinates={coordinatesToShow}
              strokeColor="#7B61FF"
              strokeWidth={5}
              lineDashPattern={[0.1, 12]}
              lineCap="round"
              lineJoin="round"
            />
          ) : null;
        })()}
        
        {mode === 'follow' || !zoomedOutForClusters
          ? comments.map((comment) => {
              const isAnonymous = comment.displayUsername === 'anonymous';
              const isSelectedUser = selectedUserId === comment.userId;
              const userComments = isSelectedUser ? getUserComments(comment.userId) : [];
              const commentIndex = isSelectedUser ? userComments.findIndex(c => c._id === comment._id) : -1;
              const progressThreshold = commentIndex / Math.max(1, userComments.length - 1);
              const isRevealed = isSelectedUser && isAnimatingPath && animatedPathProgress >= progressThreshold;
              const isInPath = isSelectedUser && isAnimatingPath;
              
              return (
                <Marker
                  key={comment._id}
                  coordinate={{
                    latitude: comment.location.coordinates[1],
                    longitude: comment.location.coordinates[0],
                  }}
                  title={comment.displayUsername || comment.username}
                  description={comment.content?.text ?? ''}
                  anchor={{ x: 0.5, y: 1 }}
                  centerOffset={{ x: 0, y: 0 }}
                  
                  onPress={() => {
                    // Start path animation if available, but always open the comment sheet
                    if (comment.displayUsername !== 'anonymous') {
                      const userComments = getUserComments(comment.userId);
                      if (userComments.length > 1) {
                        handleMarkerPress(comment);
                      }
                    }

                    wasInFollowModeRef.current = mode === 'follow';
                    setSelectedCluster(null);
                    setSelectedComment(comment);
                  }}  
                >
                <View style={styles.markerWrapper}>
                  <Image
                    source={isAnonymous 
                      ? require('@/assets/images/add-comment.png')
                      : require('@/assets/images/add-comment-friend.png')
                    }
                    style={styles.markerImage}
                  />
                </View>
                </Marker>
              );
            })
          : clusters.map((cluster) => (
              <Marker
                key={cluster.id}
                coordinate={cluster.center}
                onPress={() => handleSelectCluster(cluster)}>
                <View style={styles.clusterMarker}>
                  <ThemedText style={styles.clusterMarkerText}>{cluster.items.length}</ThemedText>
                </View>
              </Marker>
            ))}
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

      {selectedComment ? (
        <View style={styles.sheetOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.sheetBackdrop}
            onPress={handleCloseComment}
            hitSlop={buttonHitSlop}
          />
          <View style={styles.sheetCenter} pointerEvents="box-none">
            <View
              style={[
                styles.commentSheet,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  borderColor: Colors[colorScheme ?? 'light'].text + '20',
                },
              ]}>
            <View style={styles.commentSheetHeader}>
              <ThemedText type="defaultSemiBold">{selectedComment.username}</ThemedText>
              <Pressable onPress={handleCloseComment} hitSlop={buttonHitSlop}>
                <Ionicons name="close" size={20} color={Colors[colorScheme ?? 'light'].text} />
              </Pressable>
            </View>
            <ThemedText style={styles.commentSheetText}>
              {selectedComment.content?.text || '—'}
            </ThemedText>
            {selectedComment.content?.mediaUrl ? (
              <View style={styles.commentMediaContainer}>
                {selectedComment.contentType === 'video' ||
                selectedComment.content?.mediaUrl?.match(/\.(mp4|mov|m4v|webm)$/i) ? (
                  <Video
                    style={styles.commentMedia}
                    source={{ uri: selectedComment.content.mediaUrl }}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                    isLooping
                  />
                ) : (
                  <Image
                    source={{ uri: selectedComment.content.mediaUrl }}
                    style={styles.commentMedia}
                  />
                )}
              </View>
            ) : null}
            <View style={styles.commentMetaRow}>
              <ThemedText style={styles.commentSheetMeta}>
                {new Date(selectedComment.createdAt).toLocaleString()}
              </ThemedText>
              <Pressable
                style={styles.likeButton}
                onPress={() => void handleLike(selectedComment._id)}
                hitSlop={buttonHitSlop}>
                <Ionicons
                  name={selectedComment.likedByMe ? 'heart' : 'heart-outline'}
                  size={14}
                  color="#FF3B30"
                />
                <ThemedText style={styles.likeButtonText}>
                  {selectedComment.likes ?? 0}
                </ThemedText>
              </Pressable>
            </View>
            </View>
          </View>
        </View>
      ) : null}

      {selectedCluster ? (
        <View style={styles.sheetOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.sheetBackdrop}
            onPress={handleCloseCluster}
            hitSlop={buttonHitSlop}
          />
          <View style={styles.sheetCenter} pointerEvents="box-none">
            <View
              style={[
                styles.clusterSheet,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  borderColor: Colors[colorScheme ?? 'light'].text + '20',
                },
              ]}>
            <View style={styles.commentSheetHeader}>
              <View style={styles.clusterHeaderText}>
                <ThemedText type="defaultSemiBold">
                  {clusterTitles[selectedCluster.id] || 'Loading location…'}
                </ThemedText>
                <ThemedText style={styles.clusterCountText}>
                  {selectedCluster.items.length} posts
                </ThemedText>
              </View>
              <Pressable onPress={handleCloseCluster} hitSlop={buttonHitSlop}>
                <Ionicons name="close" size={20} color={Colors[colorScheme ?? 'light'].text} />
              </Pressable>
            </View>

            <View style={styles.clusterSortRow}>
              <Pressable
                style={[
                  styles.clusterSortOption,
                  clusterSortMode === 'recent' && styles.clusterSortOptionActive,
                ]}
                onPress={() => setClusterSortMode('recent')}
                hitSlop={buttonHitSlop}>
                <ThemedText type="defaultSemiBold">Newest</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.clusterSortOption,
                  clusterSortMode === 'likes' && styles.clusterSortOptionActive,
                ]}
                onPress={() => setClusterSortMode('likes')}
                hitSlop={buttonHitSlop}>
                <ThemedText type="defaultSemiBold">Top</ThemedText>
              </Pressable>
            </View>

            <ScrollView style={styles.clusterList} nestedScrollEnabled>
              {sortedClusterItems.map((item) => (
                <View key={item._id} style={styles.clusterItem}>
                  <ThemedText type="defaultSemiBold">
                    {item.displayUsername || item.username}
                  </ThemedText>
                  <ThemedText style={styles.clusterItemText}>
                    {item.content?.text || '—'}
                  </ThemedText>
                  <View style={styles.clusterItemMetaRow}>
                    <ThemedText style={styles.clusterItemMeta}>
                      {new Date(item.createdAt).toLocaleString()}
                    </ThemedText>
                    <Pressable
                      style={styles.clusterLikeBadge}
                      onPress={() => void handleLike(item._id)}
                      hitSlop={buttonHitSlop}>
                      <Ionicons
                        name={item.likedByMe ? 'heart' : 'heart-outline'}
                        size={12}
                        color="#FF3B30"
                      />
                      <ThemedText style={styles.clusterLikeText}>
                        {item.likes ?? 0}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
            </View>
          </View>
        </View>
      ) : null}

      <View style={overlayStyle}>
        <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.homeTitle}>NowAndThen</ThemedText>
          </View>
          {/* {user && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <ThemedText style={styles.logoutText}>Logout</ThemedText>
            </TouchableOpacity>
          )} */}
        </View>
        
        {/* Radius Control */}
        <View style={styles.radiusControl}>
          <ThemedText style={styles.radiusLabel}>Comment Range: {commentRadius}m</ThemedText>
          <View style={styles.radiusButtons}>
            <Pressable 
              style={[styles.radiusButton, commentRadius === 25 && styles.radiusButtonActive]}
              onPress={() => setCommentRadius(25)}
              hitSlop={buttonHitSlop}>
              <ThemedText style={[styles.radiusButtonText, commentRadius === 25 && styles.radiusButtonTextActive]}>25m</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.radiusButton, commentRadius === 50 && styles.radiusButtonActive]}
              onPress={() => setCommentRadius(50)}
              hitSlop={buttonHitSlop}>
              <ThemedText style={[styles.radiusButtonText, commentRadius === 50 && styles.radiusButtonTextActive]}>50m</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.radiusButton, commentRadius === 100 && styles.radiusButtonActive]}
              onPress={() => setCommentRadius(100)}
              hitSlop={buttonHitSlop}>
              <ThemedText style={[styles.radiusButtonText, commentRadius === 100 && styles.radiusButtonTextActive]}>100m</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.radiusButton, commentRadius === 500 && styles.radiusButtonActive]}
              onPress={() => setCommentRadius(500)}
              hitSlop={buttonHitSlop}>
              <ThemedText style={[styles.radiusButtonText, commentRadius === 500 && styles.radiusButtonTextActive]}>500m</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.radiusButton, commentRadius === 1000 && styles.radiusButtonActive]}
              onPress={() => setCommentRadius(1000)}
              hitSlop={buttonHitSlop}>
              <ThemedText style={[styles.radiusButtonText, commentRadius === 1000 && styles.radiusButtonTextActive]}>1km</ThemedText>
            </Pressable>
          </View>
        </View>
        
        {errorMessage ? <ThemedText>{errorMessage}</ThemedText> : null}
        {loading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <Pressable style={styles.recenterButton} onPress={handleRecenter} hitSlop={buttonHitSlop}>
            <ThemedText type="defaultSemiBold" style={{ color: '#525b51ff' }}>Re-center</ThemedText>
          </Pressable>
        )}
      {/* Plus button in bottom right */}
      <Pressable
        style={styles.plusButton}
        onPress={() => {
          setComposeMode('comment');
          setShowPostModal(true);
        }}
        hitSlop={buttonHitSlop}>
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
                <Pressable onPress={() => setShowPostModal(false)} hitSlop={buttonHitSlop}>
                  <Ionicons name="close" size={28} color={Colors[colorScheme ?? 'light'].text} />
                </Pressable>
                <ThemedText type="title">
                  Add Comment
                </ThemedText>
                <Pressable
                  onPress={handlePost}
                  disabled={!postContent.trim() || isSubmittingComment}
                  hitSlop={buttonHitSlop}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{
                      color: postContent.trim() && !isSubmittingComment ? '#007AFF' : '#ccc',
                    }}
                  >
                    Send
                  </ThemedText>
                </Pressable>
              </View>

              {/* <View style={styles.modeToggle}>
                <Pressable
                  style={[styles.modeOption, composeMode === 'comment' && styles.modeOptionActive]}
                  onPress={() => setComposeMode('comment')}
                  hitSlop={buttonHitSlop}>
                  <ThemedText type="defaultSemiBold">Comment</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modeOption, composeMode === 'post' && styles.modeOptionActive]}
                  onPress={() => setComposeMode('post')}
                  hitSlop={buttonHitSlop}>
                  <ThemedText type="defaultSemiBold">Post</ThemedText>
                </Pressable>
              </View> */}

              <ScrollView style={styles.scrollContent}>
                {/* Input */}
                <TextInput
                  style={[
                    styles.textInput,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}
                  placeholder='What’s this place’s story?'
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                  multiline
                  value={postContent}
                  onChangeText={setPostContent}
                />

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
                          hitSlop={buttonHitSlop}
                        >
                          <Ionicons name="close-circle" size={28} color="#fff" />
                        </Pressable>
                      </View>
                    )}

                    {/* Media Upload Button */}
                    <Pressable style={styles.mediaButton} onPress={handleAddMedia} hitSlop={buttonHitSlop}>
                      <Ionicons name="image" size={24} color="#007AFF" />
                      <ThemedText type="defaultSemiBold" style={{ color: '#007AFF', marginLeft: 8 }}>
                        Add Photo or Video
                      </ThemedText>
                    </Pressable>
                  </>
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

const getMedian = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const buildClusters = (items: CommentItem[], region: Region): PostCluster[] => {
  if (items.length === 0) return [];
  // Non-linear zoom factor: clusters expand faster the further out you are
  const zoomFactor = Math.max(1, Math.pow(region.latitudeDelta / FOLLOW_DELTA, 1.5));
  const latGrid = Math.max(0.0005, (region.latitudeDelta / 3) * zoomFactor);
  const lonGrid = Math.max(0.0005, (region.longitudeDelta / 3) * zoomFactor);

  const buckets = new Map<string, CommentItem[]>();
  items.forEach((item) => {
    const lat = item.location.coordinates[1];
    const lon = item.location.coordinates[0];
    const latKey = Math.floor(lat / latGrid);
    const lonKey = Math.floor(lon / lonGrid);
    const key = `${latKey}:${lonKey}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.push(item);
    } else {
      buckets.set(key, [item]);
    }
  });

  return Array.from(buckets.entries()).map(([key, bucketItems]) => {
    const latitudes = bucketItems.map((item) => item.location.coordinates[1]);
    const longitudes = bucketItems.map((item) => item.location.coordinates[0]);
    const center = {
      latitude: latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length,
      longitude: longitudes.reduce((sum, value) => sum + value, 0) / longitudes.length,
    };
    const median = {
      latitude: getMedian(latitudes),
      longitude: getMedian(longitudes),
    };
    return {
      id: key,
      center,
      median,
      items: bucketItems,
    };
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathNumberContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathNumber: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  markerWrapper: {
    width: Platform.OS === 'android' ? 33 : 48,
    height: Platform.OS === 'android' ? 31 : 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  pathAnimationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(123, 97, 255, 0.15)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7B61FF',
    gap: 12,
  },
  pathProgress: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  vignetteSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 16,
    borderRadius: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 8,
  },
  homeTitle: {
    fontFamily: 'radley-italic',
    fontSize: 28,
    color: '#000000',
  },
  userInfo: {
    fontSize: 12,
    marginTop: 4,
  },
  instructionText: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  // logoutBtn: {
  //   backgroundColor: '#FF3B30',
  //   paddingHorizontal: 12,
  //   paddingVertical: 8,
  //   borderRadius: 6,
  // },
  // logoutText: {
  //   color: '#fff',
  //   fontWeight: '600',
  //   fontSize: 12,
  // },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 98,
    left: 6,
    width: 100,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#e2ebe1ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  spinner: {
    alignSelf: 'flex-start',
  },
  plusButton: {
    position: 'absolute',
    bottom: 96,
    right: 6,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#73aa6eff',
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
  radiusControl: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  radiusLabel: {
    fontSize: 12,
    marginBottom: 6,
    opacity: 0.7,
    fontWeight: '500',
  },
  radiusButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radiusButtonActive: {
    backgroundColor: '#e0bd40ff',
    borderColor: '#d3b64bff',
  },
  radiusButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  radiusButtonTextActive: {
    color: '#fff',
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
  commentSheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    //padding: Platform.OS === 'android' ? 12 : 24,
    zIndex: 20,
    elevation: 20,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  commentSheet: {
    width: '100%',
    maxWidth: 360,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  commentSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentSheetText: {
    fontSize: 16,
    marginBottom: 8,
  },
  commentMediaContainer: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  commentMedia: {
    width: '100%',
    height: 220,
  },
  commentSheetMeta: {
    fontSize: 12,
    opacity: 0.6,
  },
  commentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  likeButtonText: {
    fontSize: 12,
  },
  clusterSheet: {
    width: '100%',
    maxWidth: 420,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  clusterHeaderText: {
    flex: 1,
  },
  clusterCountText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  clusterSortRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  clusterSortOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  clusterSortOptionActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  clusterList: {
    maxHeight: 360,
  },
  clusterItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  clusterItemText: {
    fontSize: 14,
    marginTop: 4,
  },
  clusterItemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  clusterItemMeta: {
    fontSize: 12,
    opacity: 0.6,
  },
  clusterLikeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  clusterLikeText: {
    fontSize: 12,
  },
  clusterMarker: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E88E5',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  clusterMarkerText: {
    color: '#fff',
    fontSize: 12,
  },
});