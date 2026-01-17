import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, Modal, TextInput, KeyboardAvoidingView, Image, ScrollView, Alert } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const FALLBACK_REGION: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const insets = useSafeAreaInsets();


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
  () => [
    styles.overlay,
    {
      backgroundColor: Colors[colorScheme ?? 'light'].background,
      top: 0,                    // behind notifications
      paddingTop: insets.top + 16 // keeps text below the status bar
    },
  ],
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

  const handlePost = () => {
    if (postContent.trim()) {
      console.log('Posting:', postContent, 'Photo:', selectedPhoto);
      // Handle post submission here
      setPostContent('');
      setSelectedPhoto(null);
      setShowPostModal(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedPhoto(result.assets[0].uri);
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
      setSelectedPhoto(result.assets[0].uri);
    }
  };

  const handleAddPhoto = () => {
    Alert.alert('Add Photo', 'How would you like to add a photo?', [
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
        <ThemedText type="title">HereAndNow</ThemedText>
        <ThemedText>Nearby memories are displayed on the map.</ThemedText>
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
      <Pressable style={styles.plusButton} onPress={() => setShowPostModal(true)}>
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
                <ThemedText type="title">Create Post</ThemedText>
                <Pressable onPress={handlePost} disabled={!postContent.trim()}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{
                      color: postContent.trim() ? '#007AFF' : '#ccc',
                    }}
                  >
                    Post
                  </ThemedText>
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

                {/* Selected Photo */}
                {selectedPhoto && (
                  <View style={styles.photoContainer}>
                    <Image source={{ uri: selectedPhoto }} style={styles.selectedPhoto} />
                    <Pressable
                      style={styles.removePhotoButton}
                      onPress={() => setSelectedPhoto(null)}
                    >
                      <Ionicons name="close-circle" size={28} color="#fff" />
                    </Pressable>
                  </View>
                )}

                {/* Photo Upload Button */}
                <Pressable style={styles.photoButton} onPress={handleAddPhoto}>
                  <Ionicons name="image" size={24} color="#007AFF" />
                  <ThemedText type="defaultSemiBold" style={{ color: '#007AFF', marginLeft: 8 }}>
                    Add Photo
                  </ThemedText>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  photoContainer: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  photoButton: {
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
