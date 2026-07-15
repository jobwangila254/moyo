import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { users, auth } from '../services/api';

export default function SuperLikeQueueScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [superLikes, setSuperLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myTier, setMyTier] = useState('FREE');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const fetchSuperLikes = async () => {
    setLoading(true);
    try {
      const [slRes, meRes] = await Promise.all([
        users.getSuperLikeQueue().catch(() => ({ data: { data: [] } })),
        auth.getMe().catch(() => ({ data: { data: { tier: 'FREE' } } })),
      ]);
      setSuperLikes(slRes.data.data || []);
      setMyTier(meRes.data.data.tier || 'FREE');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchSuperLikes(); }, []));

  useEffect(() => {
    if (toast) {
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const handleLikeBack = (superlikerId, superlikerName) => {
    if (myTier === 'FREE') {
      navigation.navigate('Payment', { likerId: superlikerId, type: 'like_unlock', matchName: superlikerName });
    } else {
      users.approveLike(superlikerId).then(res => {
        const { matchId } = res.data.data;
        if (matchId) {
          const sl = superLikes.find(s => s.superliker.id === superlikerId);
          navigation.navigate('Chat', { matchId, match: sl?.superliker });
        }
        fetchSuperLikes();
      }).catch(err => {
        if (err.response?.status === 409) {
          setToast('You already matched with this user!');
          fetchSuperLikes();
        } else {
          setToast(err.response?.data?.error || 'Failed to like back');
        }
      });
    }
  };

  const handleViewProfile = (superliker) => {
    navigation.navigate('ViewUser', { userId: superliker.id });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FF2D55" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Super Likes</Text>
      </View>

      {superLikes.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="star-border" size={60} color="#8e8e93" />
          <Text style={styles.emptyTitle}>No super likes yet</Text>
          <Text style={styles.emptySubtitle}>When someone super likes you, they&apos;ll show up here</Text>
        </View>
      ) : (
        <FlatList
          data={superLikes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const sl = item.superliker;
            return (
              <View style={styles.card}>
                <TouchableOpacity style={styles.cardBody} onPress={() => handleViewProfile(sl)}>
                  <Image
                    source={{ uri: sl.profilePicUrl || 'https://via.placeholder.com/60' }}
                    style={styles.avatar}
                  />
                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{sl.name}</Text>
                      <MaterialIcons name="star" size={16} color="#FFD700" />
                    </View>
                    <Text style={styles.meta}>{sl.age} | {sl.county?.name || 'Unknown'}</Text>
                    {sl.occupation && <Text style={styles.occupation}>{sl.occupation}</Text>}
                  </View>
                </TouchableOpacity>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => handleViewProfile(sl)}>
                    <MaterialIcons name="person" size={18} color="#FF2D55" />
                    <Text style={styles.viewBtnText}>View Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.likeBackBtn} onPress={() => handleLikeBack(sl.id, sl.name)}>
                    <MaterialIcons name="favorite" size={18} color="#fff" />
                    <Text style={styles.likeBackBtnText}>
                      {myTier === 'FREE' ? 'Like Back · Ksh 20' : 'Like Back'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

SuperLikeQueueScreen.propTypes = {
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0d0d8', gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FF2D55' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  cardBody: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f0f0f0' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e' },
  meta: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  occupation: { fontSize: 13, color: '#8e8e93', marginTop: 1 },
  actions: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: '#FF2D55', gap: 6 },
  viewBtnText: { color: '#FF2D55', fontSize: 14, fontWeight: 'bold' },
  likeBackBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF2D55', paddingVertical: 10, borderRadius: 16, gap: 6 },
  likeBackBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginTop: 15 },
  emptySubtitle: { fontSize: 14, color: '#8e8e93', textAlign: 'center', marginTop: 8 },
  toast: { backgroundColor: '#34C759', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 10 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
