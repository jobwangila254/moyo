import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, Image, useWindowDimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { users } from '../services/api';

export default function ViewUserScreen({ route, navigation }) {
  const { userId, matched: initialMatched, iLikedBack: initialILikedBack, canApprove: initialCanApprove } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState(!!initialMatched);
  const [iLikedBack, setILikedBack] = useState(!!initialILikedBack);
  const [actionLoading, setActionLoading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await users.getProfileById(userId);
        setUser(res.data.data);
      } catch {
        Alert.alert('Error', 'Failed to load profile');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleApprove = async () => {
    if (user?.tier === 'FREE') {
      navigation.navigate('Payment', { likerId: userId, type: 'like_unlock', matchName: user?.name });
      return;
    }
    setActionLoading(true);
    try {
      const res = await users.approveLike(userId);
      const { matchId, unlocked } = res.data.data;
      setMatched(true);
      setILikedBack(true);
      Alert.alert(
        "It's a Match! 💕",
        unlocked ? 'Chat is unlocked — say hello!' : 'Chat is locked — unlock for Ksh 10 to start chatting',
        [
          { text: 'OK', onPress: () => navigation.goBack() },
          ...(matchId && !unlocked ? [{ text: 'Unlock for Ksh 10', onPress: () => { navigation.navigate('Payment', { matchId }); } }] : []),
          ...(matchId ? [{ text: 'Chat', onPress: () => { navigation.navigate('Chat', { matchId, match: { id: userId, name: user?.name, profilePicUrl: user?.profilePicUrl } }); } }] : []),
        ],
      );
    } catch (error) {
      if (error.response?.status === 403) {
        Alert.alert('Likes Used Up', 'Free users get 5 likes. Upgrade to Premium for unlimited likes.');
      } else if (error.response?.status === 409) {
        Alert.alert('Already Matched', 'You already matched with this user!');
        setMatched(true);
      } else if (error.response?.status === 404) {
        Alert.alert('No Longer Available', 'This like is no longer available.');
        navigation.goBack();
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to approve');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = () => {
    Alert.alert('Dismiss Like?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Dismiss', style: 'destructive', onPress: async () => {
        setActionLoading(true);
        await users.dismissLike(userId).catch(() => {});
        setActionLoading(false);
        navigation.goBack();
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  if (!user) return null;

  const toArray = (v) => {
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v || '[]'); } catch { return []; }
  };
  const photos = toArray(user.photos);
  const allPhotos = [user.profilePicUrl, ...photos].filter((url, i, arr) => url && arr.indexOf(url) === i);
  const likes = toArray(user.likes);
  const hobbies = toArray(user.hobbies);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FF2D55" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {matched && <View style={styles.matchedBadge}><Text style={styles.matchedBadgeText}>Matched ✅</Text></View>}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.carouselWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setPhotoIndex(idx);
            }}
          >
            {allPhotos.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={{ width, height: width, backgroundColor: '#f0f0f0' }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {allPhotos.length > 1 && (
            <View style={styles.dotsRow}>
              {allPhotos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIndex && styles.activeDot]} />
              ))}
            </View>
          )}
        </View>

        <Text style={styles.name}>{user.name}, {user.age}</Text>
        <View style={styles.metaRow}>
          <MaterialIcons name="location-on" size={16} color="#8e8e93" />
          <Text style={styles.county}>{user.county?.name || 'Unknown'}</Text>
        </View>

        {user.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.sectionText}>{user.bio}</Text>
          </View>
        )}

        {user.occupation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Occupation</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="work" size={18} color="#FF2D55" />
              <Text style={styles.sectionText}>{user.occupation}</Text>
            </View>
          </View>
        )}

        {likes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.tagsRow}>
              {likes.map((l, i) => (
                <View key={i} style={styles.tag}><Text style={styles.tagText}>{l}</Text></View>
              ))}
            </View>
          </View>
        )}

        {hobbies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hobbies</Text>
            <View style={styles.tagsRow}>
              {hobbies.map((h, i) => (
                <View key={i} style={styles.tag}><Text style={styles.tagText}>{h}</Text></View>
              ))}
            </View>
          </View>
        )}

        {!matched && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.approveBtn, actionLoading && styles.btnDisabled]}
              onPress={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="favorite" size={22} color="#fff" />
                  <Text style={styles.approveBtnText}>Like Back</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={handleDismiss}
              disabled={actionLoading}
            >
              <MaterialIcons name="close" size={22} color="#FF3B30" />
              <Text style={styles.dismissBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

ViewUserScreen.propTypes = {
  route: PropTypes.object,
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0d0d8', gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FF2D55', flex: 1 },
  matchedBadge: { backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  matchedBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  scroll: { paddingBottom: 40 },
  carouselWrapper: { marginTop: 0 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d0d0d0' },
  activeDot: { backgroundColor: '#FF2D55', width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 26, fontWeight: 'bold', color: '#1c1c1e', marginTop: 16, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 },
  county: { fontSize: 16, color: '#8e8e93' },
  section: { width: '100%', paddingHorizontal: 24, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  sectionText: { fontSize: 15, color: '#3a3a3c', lineHeight: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#FF2D55' },
  tagText: { color: '#FF2D55', fontSize: 14, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 30, paddingHorizontal: 24 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF2D55', paddingVertical: 14, borderRadius: 24, gap: 8 },
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dismissBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 24, borderWidth: 1, borderColor: '#FF3B30', gap: 8 },
  dismissBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.6 },
});
