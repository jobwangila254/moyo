import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  FlatList, Image, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { users, payments, auth } from '../services/api';

export default function LikesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  useWindowDimensions();
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [pollingLikes, setPollingLikes] = useState(false);

  const fetchLikes = async () => {
    setLoading(true);
    try {
      const [recRes, sentRes] = await Promise.all([
        users.getLikesReceived().catch(() => ({ data: { data: { requiresPayment: false, likes: [] } } })),
        users.getLikesSent().catch(() => ({ data: { data: [] } })),
      ]);
      const recData = recRes.data.data;
      setRequiresPayment(recData.requiresPayment || false);
      setReceived(recData.likes || []);
      setSent(sentRes.data.data || []);
    } catch (e) { /* ignore */
    } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { fetchLikes(); }, []));

  const pollLikeViewerStatus = (transactionId) => {
    setPollingLikes(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await payments.getStatus(transactionId);
        const tx = res.data?.data;
        if (tx?.status === 'completed') {
          clearInterval(interval);
          setPollingLikes(false);
          Alert.alert('Payment Successful!', 'You can now see who likes you 💕');
          fetchLikes();
        } else if (tx?.status === 'failed' || attempts > 30) {
          clearInterval(interval);
          setPollingLikes(false);
        }
      } catch {
        if (attempts > 30) {
          clearInterval(interval);
          setPollingLikes(false);
        }
      }
    }, 2000);
  };

  const handlePayToView = async () => {
    Alert.alert(
      'See Who Likes You',
      'Pay Ksh 50 to see who has liked you and start matching 💕',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Ksh 50',
          onPress: async () => {
            setPaying(true);
            try {
              const meRes = await auth.getMe();
              const phone = meRes.data.data.phone;
              const res = await payments.initiateSTKPush({ phone, type: 'like_viewer' });
              setPaying(false);
              const txId = res.data?.data?.transactionId;
              if (txId) {
                pollLikeViewerStatus(txId);
              } else {
                Alert.alert('Payment Sent', 'Once confirmed, you will see your likes.');
                setTimeout(fetchLikes, 4000);
              }
            } catch (e) {
              setPaying(false);
              Alert.alert('Error', e.response?.data?.error || 'Payment failed');
            }
          },
        },
      ],
    );
  };

  const handleApprove = async (likerId, likerTier, likerName) => {
    if (likerTier === 'FREE') {
      try {
        const res = await users.useFreeUnlock(likerId);
        const { matchId } = res.data.data;
        navigation.navigate('Chat', { matchId, match: { id: null, name: likerName, profilePicUrl: null } });
        return;
      } catch (err) {
        if (err.response?.status !== 403) {
          Alert.alert('Error', err.response?.data?.error || 'Failed to unlock');
          return;
        }
        navigation.navigate('Payment', { likerId, type: 'like_unlock', matchName: likerName });
        return;
      }
    }
    try {
      const res = await users.approveLike(likerId);
      const { matchId, unlocked } = res.data.data;
      Alert.alert(
        "It's a Match! 💕",
        unlocked ? 'Chat is unlocked — say hello!' : 'Chat is locked — unlock for Ksh 50 to start chatting',
        [
          { text: 'OK', onPress: () => fetchLikes() },
          ...(matchId && !unlocked ? [{ text: 'Unlock for Ksh 50', onPress: () => navigation.navigate('Payment', { matchId }) }] : []),
          ...(matchId ? [{ text: 'Chat', onPress: () => navigation.navigate('Chat', { matchId, match: received.find(r => r.user.id === likerId)?.user }) }] : []),
        ],
      );
    } catch (error) {
      if (error.response?.status === 403) {
        Alert.alert('Likes Used Up', 'Free users get 5 likes. Upgrade to Premium for unlimited likes.');
      } else if (error.response?.status === 409) {
        Alert.alert('Already Matched', 'You already matched with this user!');
        fetchLikes();
      } else if (error.response?.status === 404) {
        Alert.alert('No Longer Available', 'This like is no longer available.');
        fetchLikes();
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to approve');
      }
    }
  };

  const handleDismiss = (likerId) => {
    Alert.alert('Dismiss Like?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Dismiss', style: 'destructive', onPress: async () => {
        await users.dismissLike(likerId).catch(() => {});
        fetchLikes();
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#FF2D55" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Likes 💕</Text>
      </View>

      {requiresPayment && (
        <View style={styles.payBanner}>
          <MaterialIcons name="lock" size={20} color="#fff" />
          <Text style={styles.payBannerText}>Pay Ksh 50 to see who likes you</Text>
          {pollingLikes ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <TouchableOpacity style={styles.payBtn} onPress={handlePayToView} disabled={paying}>
              {paying ? <ActivityIndicator size="small" color="#FF2D55" /> : <Text style={styles.payBtnText}>Unlock</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.tabBar}>
        {['received', 'sent'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.activeTab]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'received' ? 'Received' : 'Sent'} ({t === 'received' ? (requiresPayment ? '?' : received.length) : sent.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'received' && (
        requiresPayment ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="favorite-border" size={60} color="#8e8e93" />
            <Text style={styles.emptyTitle}>Locked 🔒</Text>
            <Text style={styles.emptySubtitle}>Pay Ksh 50 to see who has liked you and start matching</Text>
          </View>
        ) : received.length === 0 ? (
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
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.likeCard} onPress={() => navigation.navigate('ViewUser', { userId: item.user.id, matched: item.matched, iLikedBack: item.iLikedBack, canApprove: item.canApprove, likeId: item.id })}>
                <Image
                  source={{ uri: item.user.profilePicUrl || 'https://via.placeholder.com/60' }}
                  style={styles.avatar}
                />
                <View style={styles.likeInfo}>
                  <Text style={styles.likeName}>{item.user.name}</Text>
                  <Text style={styles.likeMeta}>{item.user.age} | {item.user.county?.name || 'Unknown'}</Text>
                </View>
                {item.matched ? (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => navigation.navigate('Chat', { matchId: item.matchId, match: item.user })}>
                    <MaterialIcons name="chat" size={18} color="#fff" />
                    <Text style={styles.approveBtnText}>Chat</Text>
                  </TouchableOpacity>
                ) : (
                  !item.iLikedBack && (
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.user.id, item.user.tier, item.user.name)}>
                      <MaterialIcons name="favorite" size={20} color="#fff" />
                      <Text style={styles.approveBtnText}>Like Back</Text>
                    </TouchableOpacity>
                  )
                )}
                {!item.matched && item.canApprove && (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.user.id, item.user.tier, item.user.name)}>
                    <MaterialIcons name="favorite" size={20} color="#fff" />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.dismissBtn} onPress={() => handleDismiss(item.user.id)}>
                  <MaterialIcons name="close" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
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
  payBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5856D6', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  payBannerText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  payBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  payBtnText: { color: '#5856D6', fontWeight: 'bold', fontSize: 14 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0d0d8' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#FF2D55' },
  tabText: { fontSize: 15, color: '#8e8e93', fontWeight: '600' },
  activeTabText: { color: '#FF2D55' },
  list: { padding: 16 },
  likeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f0f0f0' },
  likeInfo: { flex: 1 },
  likeName: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e' },
  likeMeta: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  statusBadge: { marginLeft: 8 },
  matchedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF2D55', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 4 },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  matchedText: { color: '#34C759', fontWeight: '600', fontSize: 13 },
  pendingText: { color: '#FF9500', fontWeight: '600', fontSize: 13 },
  dismissBtn: { padding: 6, marginLeft: 4 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginTop: 15 },
  emptySubtitle: { fontSize: 14, color: '#8e8e93', textAlign: 'center', marginTop: 8 },
});
