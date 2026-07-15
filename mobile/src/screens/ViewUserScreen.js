import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Image, useWindowDimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { users, auth } from '../services/api';

export default function ViewUserScreen({ route, navigation }) {
  const { userId } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [myTier, setMyTier] = useState('FREE');
  const [loadError, setLoadError] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [userRes, meRes] = await Promise.all([
          users.getProfileById(userId),
          auth.getMe().catch(() => ({ data: { data: { tier: 'FREE' } } })),
        ]);
        setUser(userRes.data.data);
        setMyTier(meRes.data.data.tier || 'FREE');
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleApprove = async () => {
    setActionLoading(true);
    if (myTier === 'FREE') {
      setActionLoading(false);
      navigation.navigate('Payment', { likerId: userId, type: 'like_unlock', matchName: user?.name });
      return;
    }
    try {
      const res = await users.approveLike(userId);
      const { matchId } = res.data.data;
      if (matchId) {
        navigation.replace('Chat', { matchId, match: { id: userId, name: user?.name, profilePicUrl: user?.profilePicUrl } });
      } else {
        navigation.goBack();
      }
    } catch (error) {
      if (error.response?.status === 409) {
        navigation.goBack();
      } else if (error.response?.status === 404) {
        navigation.goBack();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    setActionLoading(true);
    await users.dismissLike(userId).catch(() => {});
    setActionLoading(false);
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <MaterialIcons name="error-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Failed to load profile</Text>
        <TouchableOpacity
          style={styles.errorBackBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.errorBackBtnText}>Go Back</Text>
        </TouchableOpacity>
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

        {user.videoUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Video</Text>
            <View style={styles.videoIndicator}>
              <MaterialIcons name="play-circle-filled" size={28} color="#FF2D55" />
              <Text style={styles.videoIndicatorText}>Video Available</Text>
            </View>
          </View>
        )}

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
                <Text style={styles.approveBtnText}>{myTier === 'FREE' ? 'Like Back · Ksh 20' : 'Like Back'}</Text>
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
        <TouchableOpacity
          style={styles.blockBtn}
          onPress={() => setShowBlockConfirm(true)}
        >
          <MaterialIcons name="block" size={16} color="#8e8e93" />
          <Text style={styles.blockBtnText}>Block User</Text>
        </TouchableOpacity>
        {showBlockConfirm && (
          <View style={styles.blockConfirmBox}>
            <Text style={styles.blockConfirmText}>Block this user? They won't be able to see your profile or message you.</Text>
            <View style={styles.blockConfirmButtons}>
              <TouchableOpacity style={styles.blockConfirmCancel} onPress={() => setShowBlockConfirm(false)}>
                <Text style={styles.blockConfirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.blockConfirmDelete}
                onPress={async () => {
                  try {
                    await users.blockUser(userId);
                    navigation.goBack();
                  } catch { /* ignore */ }
                }}
              >
                <Text style={styles.blockConfirmDeleteText}>Block</Text>
              </TouchableOpacity>
            </View>
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
  videoIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0F3', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  videoIndicatorText: { fontSize: 15, fontWeight: '500', color: '#FF2D55' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 30, paddingHorizontal: 24 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF2D55', paddingVertical: 14, borderRadius: 24, gap: 8 },
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dismissBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 24, borderWidth: 1, borderColor: '#FF3B30', gap: 8 },
  dismissBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.6 },
  blockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 10 },
  blockBtnText: { color: '#8e8e93', fontSize: 14 },
  errorText: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e', marginTop: 12 },
  errorBackBtn: { marginTop: 20, backgroundColor: '#FF2D55', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  errorBackBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  blockConfirmBox: { backgroundColor: '#FFF5F5', padding: 14, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#FFD0D0' },
  blockConfirmText: { fontSize: 14, color: '#3a3a3c', marginBottom: 10, lineHeight: 20 },
  blockConfirmButtons: { flexDirection: 'row', gap: 10 },
  blockConfirmCancel: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  blockConfirmCancelText: { fontSize: 14, fontWeight: '500', color: '#3a3a3c' },
  blockConfirmDelete: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FF3B30' },
  blockConfirmDeleteText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
