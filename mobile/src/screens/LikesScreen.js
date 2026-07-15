import { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { users, auth } from '../services/api';

export default function LikesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myTier, setMyTier] = useState('FREE');
  const [pendingDismiss, setPendingDismiss] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const toastTimer = useRef(null);
  const errorTimer = useRef(null);

  const fetchLikes = async () => {
    setLoading(true);
    try {
      const [recRes, sentRes, meRes] = await Promise.all([
        users.getLikesReceived().catch(() => ({ data: { data: { likes: [] } } })),
        users.getLikesSent().catch(() => ({ data: { data: [] } })),
        auth.getMe().catch(() => ({ data: { data: { tier: 'FREE' } } })),
      ]);
      setReceived(recRes.data.data.likes || []);
      setSent(sentRes.data.data || []);
      setMyTier(meRes.data.data.tier || 'FREE');
    } catch { /* ignore */
    } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { fetchLikes(); }, []));

  const handleLikeBack = (likerId, likerName) => {
    if (myTier === 'FREE') {
      navigation.navigate('Payment', { likerId, type: 'like_unlock', matchName: likerName });
    } else {
      users.approveLike(likerId).then(res => {
        const { matchId } = res.data.data;
        if (matchId) {
          navigation.navigate('Chat', { matchId, match: received.find(r => r.user.id === likerId)?.user });
        }
        fetchLikes();
      }).catch(err => {
        if (err.response?.status === 409) {
          setToast('You already matched with this user!');
          fetchLikes();
        } else {
          setError(err.response?.data?.error || 'Failed to like back');
        }
      });
    }
  };

  const handleDismiss = (item) => {
    setPendingDismiss(item);
  };

  const confirmDismiss = async () => {
    if (!pendingDismiss) return;
    await users.dismissLike(pendingDismiss.user.id).catch(() => {});
    setPendingDismiss(null);
    fetchLikes();
  };

  useEffect(() => {
    if (toast) {
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  useEffect(() => {
    if (error) {
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(null), 3000);
    }
    return () => clearTimeout(errorTimer.current);
  }, [error]);

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
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {pendingDismiss && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Dismiss this like?</Text>
            <View style={styles.overlayActions}>
              <TouchableOpacity style={styles.overlayCancelBtn} onPress={() => setPendingDismiss(null)}>
                <Text style={styles.overlayCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.overlayDismissBtn} onPress={confirmDismiss}>
                <Text style={styles.overlayDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FF2D55" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Likes 💕</Text>
      </View>

      <View style={styles.tabBar}>
        {['received', 'sent'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.activeTab]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'received' ? 'Received' : 'Sent'} ({t === 'received' ? received.length : sent.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'received' && (
        received.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="favorite-border" size={60} color="#8e8e93" />
            <Text style={styles.emptyTitle}>No likes yet</Text>
            <Text style={styles.emptySubtitle}>When someone likes you, they&apos;ll show up here</Text>
          </View>
        ) : (
          <FlatList
            data={received}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isBlurred = !item.revealed;
              return (
                <View style={[styles.likeCard, isBlurred && styles.blurredCard]}>
                  {isBlurred ? (
                    <View style={styles.likeCardBody}>
                      <View style={[styles.avatar, styles.blurredAvatar]}>
                        <MaterialIcons name="person" size={28} color="#c7c7cc" />
                      </View>
                      <View style={styles.likeInfo}>
                        <Text style={styles.blurredName}>Someone liked you</Text>
                        <Text style={styles.blurredHint}>Pay to reveal who</Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.likeCardBody} onPress={() => navigation.navigate('ViewUser', { userId: item.user.id })}>
                      <Image
                        source={{ uri: item.user.profilePicUrl || 'https://via.placeholder.com/60' }}
                        style={styles.avatar}
                      />
                      <View style={styles.likeInfo}>
                        <Text style={styles.likeName}>{item.user.name}</Text>
                        <Text style={styles.likeMeta}>{item.user.age} | {item.user.county?.name || 'Unknown'}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <View style={styles.likeActions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleLikeBack(item.user.id, item.user.name)}>
                      <MaterialIcons name="favorite" size={18} color="#fff" />
                      <Text style={styles.approveBtnText}>
                        {myTier === 'FREE' ? 'Reveal & Match · Ksh 20' : 'Like Back'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dismissBtn} onPress={() => handleDismiss(item)}>
                      <MaterialIcons name="close" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )
      )}

      {tab === 'sent' && (
        sent.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="favorite-border" size={60} color="#8e8e93" />
            <Text style={styles.emptyTitle}>No likes sent</Text>
            <Text style={styles.emptySubtitle}>Swipe right on profiles to start matching</Text>
          </View>
        ) : (
          <FlatList
            data={sent}
            keyExtractor={(item) => String(item.user.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.likeCard}
                onPress={item.matched ? () => navigation.navigate('Chat', { matchId: item.matchId, match: item.user }) : undefined}
              >
                <Image
                  source={{ uri: item.user.profilePicUrl || 'https://via.placeholder.com/60' }}
                  style={styles.avatar}
                />
                <View style={styles.likeInfo}>
                  <Text style={styles.likeName}>{item.user.name}</Text>
                  <Text style={styles.likeMeta}>{item.user.age} | {item.user.county?.name || 'Unknown'}</Text>
                </View>
                <View style={styles.statusBadge}>
                  {item.matched ? (
                    <TouchableOpacity
                      style={styles.matchedBadge}
                      onPress={() => navigation.navigate('Chat', { matchId: item.matchId, match: item.user })}
                    >
                      <MaterialIcons name="check-circle" size={16} color="#34C759" />
                      <Text style={styles.matchedText}>Chat</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <MaterialIcons name="hourglass-empty" size={16} color="#FF9500" />
                      <Text style={styles.pendingText}>Pending</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        )
      )}
    </View>
  );
}

LikesScreen.propTypes = {
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0d0d8', gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FF2D55' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0d0d8' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#FF2D55' },
  tabText: { fontSize: 15, color: '#8e8e93', fontWeight: '600' },
  activeTabText: { color: '#FF2D55' },
  list: { padding: 16 },
  likeCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  blurredCard: { backgroundColor: '#f8f8f8', opacity: 0.9 },
  likeCardBody: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f0f0f0' },
  blurredAvatar: { backgroundColor: '#e8e8e8', justifyContent: 'center', alignItems: 'center' },
  likeInfo: { flex: 1 },
  likeName: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e' },
  likeMeta: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  blurredName: { fontSize: 16, fontWeight: 'bold', color: '#8e8e93' },
  blurredHint: { fontSize: 13, color: '#c7c7cc', marginTop: 2 },
  likeActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF2D55', paddingVertical: 10, borderRadius: 16, gap: 6 },
  approveBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  dismissBtn: { padding: 8 },
  statusBadge: { marginLeft: 8 },
  matchedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchedText: { color: '#34C759', fontWeight: '600', fontSize: 13 },
  pendingText: { color: '#FF9500', fontWeight: '600', fontSize: 13 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginTop: 15 },
  emptySubtitle: { fontSize: 14, color: '#8e8e93', textAlign: 'center', marginTop: 8 },
  toast: { backgroundColor: '#34C759', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 10 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorBanner: { backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 10 },
  errorText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  overlayCard: { backgroundColor: '#fff', borderRadius: 14, padding: 24, marginHorizontal: 32, alignItems: 'center' },
  overlayTitle: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 20 },
  overlayActions: { flexDirection: 'row', gap: 12 },
  overlayCancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f0f0f0' },
  overlayCancelText: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  overlayDismissBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FF3B30' },
  overlayDismissText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
