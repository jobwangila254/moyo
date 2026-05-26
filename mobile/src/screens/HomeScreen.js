import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  RefreshControl, ScrollView, Image, TextInput, useWindowDimensions, Modal, FlatList, SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import UserCard from '../components/UserCard';
import TierBadge from '../components/TierBadge';
import { users, auth, clearAuthToken } from '../services/api';

const LIKES_FILTERS = ['Music', 'Travel', 'Food', 'Fitness', 'Movies', 'Reading', 'Art', 'Fashion', 'Tech', 'Nature', 'Photography', 'Dancing', 'Animals', 'Coffee'];
const HOBBIES_FILTERS = ['Hiking', 'Cooking', 'Gaming', 'Sports', 'Yoga', 'Painting', 'Writing', 'Gardening', 'Cycling', 'Swimming', 'Running', 'Singing', 'Dancing', 'Camping'];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('discover');
  const [matches, setMatches] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [counties, setCounties] = useState([]);
  const [showCountyFilter, setShowCountyFilter] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const [filters, setFilters] = useState({
    countyId: '',
    countyName: 'All Counties',
    minAge: '',
    maxAge: '',
    gender: '',
    occupation: '',
    likes: [],
    hobbies: [],
  });

  const fetchData = useCallback(async (isRefresh) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = {};
      if (filters.countyId) params.countyId = filters.countyId;
      if (filters.minAge) params.minAge = filters.minAge;
      if (filters.maxAge) params.maxAge = filters.maxAge;
      if (filters.gender) params.gender = filters.gender;

      const [profilesRes, meRes] = await Promise.all([
        users.getProfiles(params).catch(() => ({ data: { data: [] } })),
        auth.getMe(),
      ]);
      setUserData(meRes.data.data);
      let allProfiles = profilesRes.data.data || [];

      if (filters.occupation) {
        const occ = filters.occupation.toLowerCase();
        allProfiles = allProfiles.filter(p => p.occupation && p.occupation.toLowerCase().includes(occ));
      }
      if (filters.likes.length > 0) {
        allProfiles = allProfiles.filter(p => {
          const pLikes = p.likes || [];
          return filters.likes.some(l => pLikes.includes(l));
        });
      }
      if (filters.hobbies.length > 0) {
        allProfiles = allProfiles.filter(p => {
          const pHobbies = p.hobbies || [];
          return filters.hobbies.some(h => pHobbies.includes(h));
        });
      }

      setProfiles(allProfiles);
      setCurrentIndex(0);

      if (activeTab === 'matches') {
        const matchesRes = await users.getMatches().catch(() => ({ data: { data: [] } }));
        setMatches(matchesRes.data.data || []);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        await clearAuthToken();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, activeTab]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleSwipe = async (direction, swipedId) => {
    try {
      await users.swipe({ swipedId, direction });
      setCurrentIndex((prev) => prev + 1);
    } catch (error) {
      if (error.response?.status === 409) setCurrentIndex((prev) => prev + 1);
      else if (error.response?.status === 403) {
        Alert.alert('Likes Used Up', error.response?.data?.error || 'Free users get 5 likes. Upgrade to Premium for unlimited likes.');
      }
    }
  };

  const handleLogout = async () => {
    await clearAuthToken();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const currentProfile = profiles[currentIndex];

  const applyFilters = () => {
    setShowFilters(false);
    setLoading(true);
    fetchData();
  };

  const toggleLikeFilter = (l) => {
    setFilters(prev => ({
      ...prev,
      likes: prev.likes.includes(l) ? prev.likes.filter(x => x !== l) : [...prev.likes, l],
    }));
  };

  const toggleHobbyFilter = (h) => {
    setFilters(prev => ({
      ...prev,
      hobbies: prev.hobbies.includes(h) ? prev.hobbies.filter(x => x !== h) : [...prev.hobbies, h],
    }));
  };

  const renderDiscover = () => {
    if (loading) {
      return <View style={[styles.loadingContainer, { paddingTop: height * 0.1 }]}><ActivityIndicator size="large" color="#FF2D55" /></View>;
    }
    if (!currentProfile) {
      return (
        <View style={[styles.emptyState, { paddingTop: height * 0.12 }]}>
          <MaterialIcons name="search-off" size={60} color="#8e8e93" />
          <Text style={styles.emptyTitle}>No more profiles</Text>
          <Text style={styles.emptySubtitle}>
            {filters.countyId || filters.minAge || filters.gender || filters.likes.length > 0
              ? 'Try adjusting your filters to find more people'
              : 'Check back later for new people in your area'}
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchData}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <UserCard key={currentProfile.id} user={currentProfile} onSwipe={handleSwipe} onPress={setSelectedProfile} cardHeight={height < 700 ? height * 0.55 : height * 0.6} />;
  };

  const loadMatches = async () => {
    try {
      const res = await users.getMatches();
      setMatches(res.data.data || []);
    } catch (e) {}
  };

  const onRefresh = () => fetchData(true);

  const renderMatches = () => {
    if (loading && matches.length === 0) {
      return <View style={[styles.loadingContainer, { paddingTop: height * 0.1 }]}><ActivityIndicator size="large" color="#FF2D55" /></View>;
    }
    if (matches.length === 0) {
      return (
        <View style={[styles.emptyState, { paddingTop: height * 0.12 }]}>
          <MaterialIcons name="favorite-border" size={60} color="#8e8e93" />
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtitle}>Swipe right on profiles to find your match</Text>
        </View>
      );
    }
    return (
      <ScrollView style={styles.matchesList}>
        {matches.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={styles.matchCard}
            onPress={() => navigation.navigate('Chat', { matchId: m.id, match: m.match, freeRemaining: m.freeRemaining, unlocked: m.unlocked })}
          >
            <Image source={{ uri: m.match.profilePicUrl || 'https://via.placeholder.com/60' }} style={styles.matchAvatar} />
            <View style={styles.matchInfo}>
              <View style={styles.matchNameRow}>
                <Text style={styles.matchName}>{m.match.name}</Text>
                {m.match.tier === 'PREMIUM' && <MaterialIcons name="star" size={14} color="#FF9500" />}
              </View>
              <Text style={styles.matchDetail}>{m.match.age} | {m.match.county?.name}</Text>
              {!m.unlocked ? (
                <Text style={styles.matchQuota}>{m.freeRemaining} free messages left</Text>
              ) : (
                <Text style={styles.matchUnlocked}>Unlimited messages 💕</Text>
              )}
            </View>
            <View style={styles.matchArrow}><MaterialIcons name="chat" size={22} color="#FF2D55" /></View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderFilterPanel = () => (
    <Modal visible={showFilters} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.filterModal}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Find Your Type</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <MaterialIcons name="close" size={24} color="#1c1c1e" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.filterBody}>
            <Text style={styles.filterLabel}>County</Text>
            <TouchableOpacity style={styles.filterInput} onPress={() => setShowCountyFilter(true)}>
              <MaterialIcons name="location-on" size={18} color="#FF2D55" />
              <Text style={[styles.filterInputText, !filters.countyId && { color: '#c7c7cc' }]}>
                {filters.countyName || 'All Counties'}
              </Text>
            </TouchableOpacity>

            <View style={styles.filterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterLabel}>Min Age</Text>
                <TextInput
                  style={styles.filterInput} placeholder="18" placeholderTextColor="#c7c7cc"
                  value={filters.minAge} onChangeText={(v) => setFilters(prev => ({ ...prev, minAge: v }))}
                  keyboardType="number-pad" maxLength={2}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.filterLabel}>Max Age</Text>
                <TextInput
                  style={styles.filterInput} placeholder="60" placeholderTextColor="#c7c7cc"
                  value={filters.maxAge} onChangeText={(v) => setFilters(prev => ({ ...prev, maxAge: v }))}
                  keyboardType="number-pad" maxLength={2}
                />
              </View>
            </View>

            <Text style={styles.filterLabel}>Gender</Text>
            <View style={styles.filterChipsRow}>
              {['all', 'male', 'female'].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.filterChip, filters.gender === g && styles.filterChipActive]}
                  onPress={() => setFilters(prev => ({ ...prev, gender: g === prev.gender ? '' : g }))}
                >
                  <Text style={[styles.filterChipText, filters.gender === g && styles.filterChipTextActive]}>
                    {g === 'all' ? 'Any' : g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Occupation</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="e.g. Engineer, Teacher..."
              placeholderTextColor="#c7c7cc"
              value={filters.occupation}
              onChangeText={(v) => setFilters(prev => ({ ...prev, occupation: v }))}
            />

            <Text style={styles.filterLabel}>Likes ❤️</Text>
            <View style={styles.filterChipsRow}>
              {LIKES_FILTERS.map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.filterChip, filters.likes.includes(l) && styles.filterChipActive]}
                  onPress={() => toggleLikeFilter(l)}
                >
                  <Text style={[styles.filterChipText, filters.likes.includes(l) && styles.filterChipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Hobbies ⭐</Text>
            <View style={styles.filterChipsRow}>
              {HOBBIES_FILTERS.map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.filterChip, filters.hobbies.includes(h) && styles.filterChipHobbyActive]}
                  onPress={() => toggleHobbyFilter(h)}
                >
                  <Text style={[styles.filterChipText, filters.hobbies.includes(h) && styles.filterChipTextHobbyActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appName}>Moyo</Text>
          {userData && <TierBadge tier={userData.tier} />}
        </View>
        <View style={styles.headerRight}>
          {userData?.tier === 'PREMIUM' && (
            <TouchableOpacity style={styles.filterBtn} onPress={() => {
              if (!counties.length) {
                users.getCounties().then(res => setCounties(res.data.data || [])).catch(() => {});
              }
              setShowFilters(true);
            }}>
              <MaterialIcons name="tune" size={24} color="#FF2D55" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={() => navigation.navigate('Likes')}>
            <MaterialIcons name="favorite-border" size={26} color="#FF2D55" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <MaterialIcons name="person" size={28} color="#FF2D55" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      {userData?.tier === 'PREMIUM' && (filters.countyId || filters.minAge || (filters.gender && filters.gender !== 'all') || filters.likes.length > 0) && (
        <View style={styles.activeFilterBar}>
          <MaterialIcons name="filter-list" size={16} color="#FF2D55" />
          <Text style={styles.activeFilterText}>Filters active</Text>
          <TouchableOpacity onPress={() => {
            setFilters({ countyId: '', countyName: 'All Counties', minAge: '', maxAge: '', gender: '', occupation: '', likes: [], hobbies: [] });
            setLoading(true);
            setTimeout(() => fetchData(), 100);
          }}>
            <Text style={styles.clearFilterText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabBar}>
        {['discover', 'matches'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <MaterialIcons
              name={tab === 'discover' ? 'explore' : 'favorite'}
              size={22} color={activeTab === tab ? '#FF2D55' : '#8e8e93'}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'discover' ? 'Discover' : 'Matches'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'discover' && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ flex: !!currentProfile ? 1 : undefined }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {renderDiscover()}
        </ScrollView>
      )}

      {activeTab === 'matches' && renderMatches()}

      <TouchableOpacity
        style={[styles.upgradeFAB, { bottom: Math.max(insets.bottom, 16) + 10 }]}
        onPress={() => navigation.navigate('Payment', { matchId: null })}
      >
        <MaterialIcons name="stars" size={24} color="#fff" />
        <Text style={styles.upgradeText}>
          {userData?.tier === 'PREMIUM' ? 'Unlock Match' : 'Go Premium'}
        </Text>
      </TouchableOpacity>

      {renderFilterPanel()}

      <Modal visible={showCountyFilter} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Select County</Text>
              <TouchableOpacity onPress={() => setShowCountyFilter(false)}>
                <MaterialIcons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: '', name: 'All Counties' }, ...counties]}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, filters.countyId === item.id && styles.modalItemActive]}
                  onPress={() => {
                    setFilters(prev => ({ ...prev, countyId: item.id, countyName: item.name }));
                    setShowCountyFilter(false);
                  }}
                >
                  <Text style={[styles.modalItemText, filters.countyId === item.id && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                  {filters.countyId === item.id && <MaterialIcons name="check" size={20} color="#FF2D55" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedProfile} transparent animationType="fade">
        <SafeAreaView style={styles.profileModalOverlay}>
          <ScrollView style={styles.profileModalContent}>
            <TouchableOpacity style={styles.profileModalClose} onPress={() => setSelectedProfile(null)}>
              <MaterialIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {selectedProfile && (
              <>
                <Image
                  source={{ uri: (selectedProfile.photos?.[0] || selectedProfile.profilePicUrl || 'https://via.placeholder.com/400') }}
                  style={styles.profileModalImage}
                />
                <View style={styles.profileModalBody}>
                  <View style={styles.profileModalNameRow}>
                    <Text style={styles.profileModalName}>{selectedProfile.name}</Text>
                    {selectedProfile.age && <Text style={styles.profileModalAge}>, {selectedProfile.age}</Text>}
                  </View>
                  <View style={styles.profileModalDetailRow}>
                    <MaterialIcons name="location-on" size={16} color="#FF2D55" />
                    <Text style={styles.profileModalDetail}>{selectedProfile.county?.name || 'Unknown'}</Text>
                  </View>
                  {selectedProfile.occupation && (
                    <View style={styles.profileModalDetailRow}>
                      <MaterialIcons name="work" size={16} color="#FF2D55" />
                      <Text style={styles.profileModalDetail}>{selectedProfile.occupation}</Text>
                    </View>
                  )}
                  {selectedProfile.gender && (
                    <View style={styles.profileModalDetailRow}>
                      <MaterialIcons name="wc" size={16} color="#FF2D55" />
                      <Text style={styles.profileModalDetail}>{selectedProfile.gender}</Text>
                    </View>
                  )}
                  {selectedProfile.bio && (
                    <View style={styles.profileModalSection}>
                      <Text style={styles.profileModalSectionTitle}>About Me ❤️</Text>
                      <Text style={styles.profileModalBio}>{selectedProfile.bio}</Text>
                    </View>
                  )}
                  {(selectedProfile.likes || []).length > 0 && (
                    <View style={styles.profileModalSection}>
                      <Text style={styles.profileModalSectionTitle}>Likes ❤️</Text>
                      <View style={styles.profileModalTags}>
                        {selectedProfile.likes.map(l => (
                          <View key={l} style={[styles.profileModalTag, styles.profileModalLikeTag]}>
                            <Text style={styles.profileModalTagText}>{l}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {(selectedProfile.hobbies || []).length > 0 && (
                    <View style={styles.profileModalSection}>
                      <Text style={styles.profileModalSectionTitle}>Hobbies ⭐</Text>
                      <View style={styles.profileModalTags}>
                        {selectedProfile.hobbies.map(h => (
                          <View key={h} style={[styles.profileModalTag, styles.profileModalHobbyTag]}>
                            <Text style={styles.profileModalTagText}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  loadingContainer: { alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appName: { fontSize: 20, fontWeight: 'bold', color: '#FF2D55' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterBtn: { padding: 4 },
  activeFilterBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F3',
    paddingHorizontal: 16, paddingVertical: 8, gap: 6,
  },
  activeFilterText: { fontSize: 13, color: '#FF2D55', flex: 1 },
  clearFilterText: { fontSize: 13, color: '#FF2D55', fontWeight: 'bold' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0d0d8',
  },
  tab: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 12, gap: 6,
  },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#FF2D55' },
  tabText: { fontSize: 14, color: '#8e8e93' },
  activeTabText: { color: '#FF2D55', fontWeight: '600' },
  content: { flex: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginTop: 15 },
  emptySubtitle: { fontSize: 14, color: '#8e8e93', textAlign: 'center', marginTop: 8 },
  refreshButton: { marginTop: 20, backgroundColor: '#FF2D55', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  refreshButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  matchesList: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  matchCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    boxShadow: '0 1px 6px 0 rgba(255,45,85,0.06)',
  },
  matchAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f0f0f0' },
  matchInfo: { flex: 1, marginLeft: 14 },
  matchNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchName: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e' },
  matchDetail: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  matchQuota: { fontSize: 12, color: '#FF9500', marginTop: 2, fontWeight: '600' },
  matchUnlocked: { fontSize: 12, color: '#34C759', marginTop: 2, fontWeight: '600' },
  matchArrow: { marginLeft: 8 },
  upgradeFAB: {
    position: 'absolute', right: 20, backgroundColor: '#5856D6',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 25, gap: 8,     boxShadow: '0 4px 8px 0 rgba(0,0,0,0.3)', elevation: 8,
  },
  upgradeText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 34 },
  filterHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  filterTitle: { fontSize: 18, fontWeight: 'bold', color: '#FF2D55' },
  filterBody: { paddingHorizontal: 20, paddingVertical: 16 },
  filterLabel: {
    fontSize: 12, fontWeight: '600', color: '#3a3a3c', marginTop: 14, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  filterInput: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f0d0d8',
    borderRadius: 10, backgroundColor: '#FFFAFB', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  filterInputText: { fontSize: 15, color: '#1c1c1e', flex: 1, marginLeft: 8 },
  filterRow: { flexDirection: 'row', gap: 12 },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: {
    borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#FFFAFB',
  },
  filterChipActive: { borderColor: '#FF2D55', backgroundColor: '#FFF0F3' },
  filterChipHobbyActive: { borderColor: '#5856D6', backgroundColor: '#F5F3FF' },
  filterChipText: { fontSize: 12, color: '#8e8e93' },
  filterChipTextActive: { color: '#FF2D55', fontWeight: '600' },
  filterChipTextHobbyActive: { color: '#5856D6', fontWeight: '600' },
  applyButton: {
    backgroundColor: '#FF2D55', padding: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 24,
  },
  applyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f7',
  },
  modalItemActive: { backgroundColor: '#FFF0F3' },
  modalItemText: { fontSize: 16, color: '#1c1c1e' },
  modalItemTextActive: { color: '#FF2D55', fontWeight: '600' },
  profileModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  profileModalContent: { flex: 1 },
  profileModalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8 },
  profileModalImage: { width: '100%', height: 380 },
  profileModalBody: { padding: 24 },
  profileModalNameRow: { flexDirection: 'row', alignItems: 'baseline' },
  profileModalName: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  profileModalAge: { fontSize: 22, color: '#ccc', marginLeft: 4 },
  profileModalDetailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  profileModalDetail: { fontSize: 15, color: '#ccc' },
  profileModalSection: { marginTop: 20 },
  profileModalSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#FF2D55', marginBottom: 8 },
  profileModalBio: { fontSize: 15, lineHeight: 22, color: '#ddd' },
  profileModalTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  profileModalTag: {
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
  },
  profileModalLikeTag: { backgroundColor: '#FF2D5522' },
  profileModalHobbyTag: { backgroundColor: '#5856D622' },
  profileModalTagText: { fontSize: 13, color: '#fff' },
});
