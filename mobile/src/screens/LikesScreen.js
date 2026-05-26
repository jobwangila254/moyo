import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  FlatList, Image, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { users, payments } from '../services/api';

export default function LikesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useFocusEffect(useCallback(() => { fetchLikes(); }, []));

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
    } catch (e) {
    } finally { setLoading(false); }
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
              await payments.initiateSTKPush({ phone: '0710000000', type: 'like_viewer' });
              Alert.alert('Payment Sent', 'Once confirmed, you will see your likes.');
              setTimeout(fetchLikes, 4000);
            } catch (e) {
              Alert.alert('Error', e.response?.data?.error || 'Payment failed');
            } finally { setPaying(false); }
          },
        },
      ]
    );
  };

  const handleApprove = async (likerId) => {
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
        ]
      );
    } catch (error) {
      if (error.response?.status === 403) {
        Alert.alert('Likes Used Up', 'Free users get 5 likes. Upgrade to Premium for unlimited likes.');
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
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
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
          <TouchableOpacity style={styles.payBtn} onPress={handlePayToView} disabled={paying}>
            {paying ? <ActivityIndicator size="small" color="#FF2D55" /> : <Text style={styles.payBtnText}>Unlock</Text>}
          </TouchableOpacity>
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
            <Text style={styles.emptySubtitle}>When someone likes you, they'll show up here</Text>
          </View>
        ) : (
          <FlatList
            data={received}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.likeCard}>
                <Image
                  source={{ uri: item.user.profilePicUrl || 'https://via.placeholder.com/60' }}
                  style={styles.avatar}
                />
                <View style={styles.likeInfo}>
                  <Text style={styles.likeName}>{item.user.name}</Text>
                  <Text style={styles.likeMeta}>{item.user.age} | {item.user.county?.name || 'Unknown'}</Text>
                  {item.matched && <Text style={styles.matchedBadge}>Matched ✅</Text>}
                </View>
                {!item.matched && !item.iLikedBack && (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.user.id)}>
                    <MaterialIcons name="favorite" size={20} color="#fff" />
                    <Text style={styles.approveBtnText}>Like Back</Text>
                  </TouchableOpacity>
                )}
                {item.canApprove && (
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.user.id)}>
                    <MaterialIcons name="favorite" size={20} color="#fff" />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.dismissBtn} onPress={() => handleDismiss(item.user.id)}>
                  <MaterialIcons name="close" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
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
              <View style={styles.likeCard}>
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
                    <View style={styles.matchedBadge}>
                      <MaterialIcons name="check-circle" size={16} color="#34C759" />
                      <Text style={{ color: '#34C759', fontWeight: '600', fontSize: 13 }}>Matched</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <MaterialIcons name="hourglass-empty" size={16} color="#FF9500" />
                      <Text style={{ color: '#FF9500', fontWeight: '600', fontSize: 13 }}>Pending</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          />
        )
      )}
    </View>
  );
}

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
  dismissBtn: { padding: 6, marginLeft: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginTop: 15 },
  emptySubtitle: { fontSize: 14, color: '#8e8e93', textAlign: 'center', marginTop: 8 },
});
