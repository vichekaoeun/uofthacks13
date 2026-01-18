import { useEffect, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { friendsAPI } from '@/services/api';

interface User {
  _id: string;
  username: string;
  email: string;
}

interface FriendRequestUser extends User {
  isFriend?: boolean;
  hasRequest?: boolean;
}

export default function FriendsScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendRequestUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'requests' | 'friends'>('search');
  const [sentRequests, setSentRequests] = useState<string[]>([]);

  const isDark = colorScheme === 'dark';

  // Load friend requests and friends on mount
  useEffect(() => {
    loadFriendRequests();
    loadFriends();
  }, []);

  const loadFriendRequests = async () => {
    try {
      setRequestsLoading(true);
      const response = await friendsAPI.getFriendRequests();
      if (response.success) {
        setFriendRequests(response.data);
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      setFriendsLoading(true);
      if (!user?._id) return;
      const response = await friendsAPI.getFriends(user._id);
      if (response.success) {
        setFriends(response.data);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await friendsAPI.searchUsers(query);
      if (response.success) {
        // Filter out current user and add status info
        const filtered = response.data
          .filter((u: User) => u._id !== user?._id)
          .map((u: User) => ({
            ...u,
            isFriend: friends.some(f => f._id === u._id),
            hasRequest: sentRequests.includes(u._id),
          }));
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (recipientId: string) => {
    try {
      const response = await friendsAPI.sendFriendRequest(recipientId);
      if (response.success) {
        setSentRequests([...sentRequests, recipientId]);
        Alert.alert('Success', 'Friend request sent!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    try {
      const response = await friendsAPI.acceptFriendRequest(senderId);
      if (response.success) {
        loadFriendRequests();
        loadFriends();
        Alert.alert('Success', 'Friend request accepted!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (senderId: string) => {
    try {
      const response = await friendsAPI.rejectFriendRequest(senderId);
      if (response.success) {
        loadFriendRequests();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to reject request');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      const response = await friendsAPI.removeFriend(friendId);
      if (response.success) {
        loadFriends();
        Alert.alert('Success', 'Friend removed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to remove friend');
    }
  };

  const renderSearchResult = ({ item }: { item: FriendRequestUser }) => (
    <ThemedView style={[styles.userCard, { borderColor: isDark ? '#444' : '#ddd' }]}>
      <View style={styles.userInfo}>
        <ThemedText style={styles.username}>{item.username}</ThemedText>
        <ThemedText style={styles.email}>{item.email}</ThemedText>
      </View>
      {item.isFriend ? (
        <TouchableOpacity
          style={[styles.button, styles.removeFriendBtn]}
          onPress={() => handleRemoveFriend(item._id)}
        >
          <Ionicons name="checkmark" size={18} color="white" />
        </TouchableOpacity>
      ) : item.hasRequest ? (
        <ThemedView style={[styles.button, { backgroundColor: '#888' }]}>
          <ThemedText style={{ color: 'white', fontSize: 12 }}>Requested</ThemedText>
        </ThemedView>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.addBtn]}
          onPress={() => handleSendRequest(item._id)}
        >
          <Ionicons name="add" size={18} color="white" />
        </TouchableOpacity>
      )}
    </ThemedView>
  );

  const renderFriendRequest = ({ item }: { item: User }) => (
    <ThemedView style={[styles.userCard, { borderColor: isDark ? '#444' : '#ddd' }]}>
      <View style={styles.userInfo}>
        <ThemedText style={styles.username}>{item.username}</ThemedText>
        <ThemedText style={styles.email}>{item.email}</ThemedText>
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.smallButton, styles.acceptBtn]}
          onPress={() => handleAcceptRequest(item._id)}
        >
          <Ionicons name="checkmark" size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallButton, styles.rejectBtn]}
          onPress={() => handleRejectRequest(item._id)}
        >
          <Ionicons name="close" size={16} color="white" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );

  const renderFriend = ({ item }: { item: User }) => (
    <ThemedView style={[styles.userCard, { borderColor: isDark ? '#444' : '#ddd' }]}>
      <View style={styles.userInfo}>
        <ThemedText style={styles.username}>{item.username}</ThemedText>
        <ThemedText style={styles.email}>{item.email}</ThemedText>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.removeFriendBtn]}
        onPress={() => handleRemoveFriend(item._id)}
      >
        <Ionicons name="close" size={18} color="white" />
      </TouchableOpacity>
    </ThemedView>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { borderBottomColor: isDark ? '#444' : '#ddd' }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'search' && styles.activeTab,
            activeTab === 'search' && {
              borderBottomColor: Colors[colorScheme ?? 'light'].tint,
            },
          ]}
          onPress={() => setActiveTab('search')}
        >
          <ThemedText style={styles.tabText}>Search</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'requests' && styles.activeTab,
            activeTab === 'requests' && {
              borderBottomColor: Colors[colorScheme ?? 'light'].tint,
            },
          ]}
          onPress={() => setActiveTab('requests')}
        >
          <ThemedText style={styles.tabText}>
            Requests {friendRequests.length > 0 && `(${friendRequests.length})`}
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'friends' && styles.activeTab,
            activeTab === 'friends' && {
              borderBottomColor: Colors[colorScheme ?? 'light'].tint,
            },
          ]}
          onPress={() => setActiveTab('friends')}
        >
          <ThemedText style={styles.tabText}>Friends ({friends.length})</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <View style={styles.content}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: isDark ? '#333' : '#f0f0f0',
                color: isDark ? 'white' : 'black',
                borderColor: isDark ? '#555' : '#ddd',
              },
            ]}
            placeholder="Search for users..."
            placeholderTextColor={isDark ? '#999' : '#666'}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {loading && <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />}
          {!loading && searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              style={styles.list}
            />
          )}
          {!loading && searchQuery && searchResults.length === 0 && (
            <ThemedText style={styles.emptyText}>No users found</ThemedText>
          )}
          {!searchQuery && (
            <ThemedText style={styles.emptyText}>Search for users to add as friends</ThemedText>
          )}
        </View>
      )}

      {/* Friend Requests Tab */}
      {activeTab === 'requests' && (
        <View style={styles.content}>
          {requestsLoading && (
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          )}
          {!requestsLoading && friendRequests.length > 0 && (
            <FlatList
              data={friendRequests}
              renderItem={renderFriendRequest}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              style={styles.list}
            />
          )}
          {!requestsLoading && friendRequests.length === 0 && (
            <ThemedText style={styles.emptyText}>No pending friend requests</ThemedText>
          )}
        </View>
      )}

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <View style={styles.content}>
          {friendsLoading && (
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          )}
          {!friendsLoading && friends.length > 0 && (
            <FlatList
              data={friends}
              renderItem={renderFriend}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              style={styles.list}
            />
          )}
          {!friendsLoading && friends.length === 0 && (
            <ThemedText style={styles.emptyText}>You haven&apos;t added any friends yet</ThemedText>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  list: {
    marginTop: 8,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
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
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  addBtn: {
    backgroundColor: '#4CAF50',
  },
  removeFriendBtn: {
    backgroundColor: '#b35953ff',
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 6,
  },
  acceptBtn: {
    backgroundColor: '#4CAF50',
  },
  rejectBtn: {
    backgroundColor: '#b35953ff',
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    opacity: 0.6,
    fontSize: 14,
  },
});
