import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { users } from '../services/api';
import { connectSocket, joinMatchRoom, leaveMatchRoom, onNewMessage } from '../services/socket';

export default function ChatScreen({ route, navigation }) {
  const { matchId, match, freeRemaining: initialFree, unlocked: initialUnlocked } = route.params;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    connectSocket().then(() => {
      joinMatchRoom(matchId);
    });
    return () => {
      leaveMatchRoom(matchId);
    };
  }, [matchId]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState({
    myUserId: null,
    myFreeUsed: 3 - (initialFree || 0),
    myFreeRemaining: initialFree || 0,
    unlocked: initialUnlocked || false,
    canSend: initialUnlocked || (initialFree || 0) > 0,
  });
  const flatListRef = useRef(null);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await users.getMessages(matchId);
      setMessages(res.data.data.messages || []);
      setQuota(res.data.data.quota);
    } catch (e) {
      if (e.response?.status === 404) {setMessages([]);}
    } finally { setLoading(false); }
  }, [matchId]);

  useFocusEffect(useCallback(() => { loadMessages(); }, [loadMessages]));

  useEffect(() => {
    const unsubscribe = onNewMessage((msg) => {
      if (msg.matchId === matchId || msg.matchId === parseInt(matchId, 10)) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    return unsubscribe;
  }, [matchId]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) {return;}
    if (!quota.canSend) {
      setShowUnlockPrompt(true);
      return;
    }
    setSending(true);
    setInputText('');
    try {
      const res = await users.sendMessage(matchId, text);
      const newMsg = res.data.data;
      setMessages((prev) => [...prev, newMsg]);
      setQuota((prev) => ({
        ...prev, myFreeUsed: prev.myFreeUsed + 1, myFreeRemaining: Math.max(0, prev.myFreeRemaining - 1),
        canSend: prev.myFreeRemaining - 1 > 0 || prev.unlocked,
      }));
    } catch (error) {
      const isQuotaError = error.response?.status === 403 || error.response?.data?.data?.quotaExceeded;
      if (isQuotaError) {
        setQuota((prev) => ({ ...prev, myFreeRemaining: 0, canSend: false }));
        navigation.navigate('Payment', { matchId, matchName: match.name });
      }
      setInputText(text);
    } finally { setSending(false); }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === quota.myUserId;
    return (
      <View style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgThem]}>
        {!isMe && <Text style={styles.msgSender}>{item.senderName}</Text>}
        <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>{item.content}</Text>
        <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>{formatTime(item.createdAt)}</Text>
      </View>
    );
  };

  if (loading) {
    return <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}><ActivityIndicator size="large" color="#FF2D55" /></View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><MaterialIcons name="arrow-back" size={24} color="#FF2D55" /></TouchableOpacity>
        <Image source={{ uri: match.profilePicUrl || 'https://via.placeholder.com/40' }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{match.name}</Text>
          <Text style={styles.headerStatus}>{quota.unlocked ? 'Unlimited 💕' : `${quota.myFreeRemaining} free messages`}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => { setReportResult(null); setShowReportModal(true); }}
        >
          <MaterialIcons name="flag" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, idx) => item.id?.toString() || String(idx)}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={messages.length === 0 ? styles.emptyMessagesContainer : styles.messagesContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <MaterialIcons name="favorite" size={48} color="#FF2D55" />
            <Text style={styles.emptyText}>You&apos;re connected!</Text>
            <Text style={styles.emptySubtext}>Say something lovely to {match.name} 💕</Text>
          </View>
        }
      />

      {!quota.unlocked && quota.myFreeRemaining <= 0 && (
        <View style={styles.quotaBanner}>
          <MaterialIcons name="lock" size={16} color="#fff" />
          <Text style={styles.quotaBannerText}>Free messages used — </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Payment', { matchId, matchName: match.name })}>
            <Text style={styles.quotaBannerLink}>Unlock for Ksh 10</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.textInput}
          placeholder={quota.canSend ? 'Type something sweet...' : 'Messages locked'}
          placeholderTextColor="#c7c7cc"
          value={inputText} onChangeText={setInputText}
          editable={quota.canSend} multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!quota.canSend || !inputText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={quota.canSend ? handleSend : () => navigation.navigate('Payment', { matchId, matchName: match.name })}
          disabled={sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name={quota.canSend ? 'send' : 'lock-open'} size={22} color="#fff" />}
        </TouchableOpacity>
      </View>
      {showUnlockPrompt && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <MaterialIcons name="lock" size={36} color="#FF2D55" />
            <Text style={styles.overlayTitle}>You&apos;ve used all free messages</Text>
            <Text style={styles.overlaySubtitle}>Unlock this match for Ksh 10 or get daily chat for Ksh 30 💕</Text>
            <TouchableOpacity
              style={styles.overlayBtn}
              onPress={() => { setShowUnlockPrompt(false); navigation.navigate('Payment', { matchId, type: 'match_unlock' }); }}
            >
              <Text style={styles.overlayBtnText}>Unlock Chat - Ksh 10</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUnlockPrompt(false)}>
              <Text style={styles.overlayDismiss}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            {reportResult === null ? (
              <>
                <MaterialIcons name="flag" size={36} color="#FF3B30" />
                <Text style={styles.overlayTitle}>Report User</Text>
                <Text style={styles.overlaySubtitle}>Report {match.name} for inappropriate behavior?</Text>
                {reporting ? (
                  <ActivityIndicator size="large" color="#FF2D55" style={{ marginVertical: 16 }} />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#e0e0e0' }]} onPress={() => setShowReportModal(false)}>
                      <Text style={[styles.overlayBtnText, { color: '#1c1c1e' }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.overlayBtn, { backgroundColor: '#8e8e93' }]}
                      onPress={async () => {
                        setReporting(true);
                        try {
                          await users.blockUser(match.id);
                          setShowReportModal(false);
                          navigation.goBack();
                        } catch { /* ignore */ }
                        finally { setReporting(false); }
                      }}
                    >
                      <Text style={styles.overlayBtnText}>Block</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.overlayBtn, { backgroundColor: '#FF3B30' }]}
                      onPress={async () => {
                        setReporting(true);
                        try {
                          await users.reportUser({ reportedId: match.id, reason: 'Inappropriate behavior', details: 'Reported from chat' });
                          setReportResult('success');
                        } catch {
                          setReportResult('error');
                        } finally { setReporting(false); }
                      }}
                    >
                      <Text style={styles.overlayBtnText}>Report</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : reportResult === 'success' ? (
              <>
                <MaterialIcons name="check-circle" size={36} color="#34C759" />
                <Text style={styles.overlayTitle}>Reported</Text>
                <Text style={styles.overlaySubtitle}>Thank you. We will review this profile.</Text>
                <TouchableOpacity style={styles.overlayBtn} onPress={() => { setShowReportModal(false); navigation.goBack(); }}>
                  <Text style={styles.overlayBtnText}>OK</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <MaterialIcons name="error-outline" size={36} color="#FF3B30" />
                <Text style={styles.overlayTitle}>Error</Text>
                <Text style={styles.overlaySubtitle}>Failed to submit report</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: '#e0e0e0' }]} onPress={() => setShowReportModal(false)}>
                    <Text style={[styles.overlayBtnText, { color: '#1c1c1e' }]}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.overlayBtn} onPress={() => setReportResult(null)}>
                    <Text style={styles.overlayBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

ChatScreen.propTypes = {
  route: PropTypes.object,
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0d0d8' },
  backBtn: { marginRight: 8 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0' },
  headerAction: { padding: 4, marginLeft: 4 },
  headerInfo: { marginLeft: 12, flex: 1 },
  headerName: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e' },
  headerStatus: { fontSize: 13, color: '#FF2D55' },
  messagesList: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 12 },
  emptyMessagesContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyMessages: { alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#FF2D55', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: '#8e8e93', marginTop: 4, textAlign: 'center' },
  msgBubble: { maxWidth: '80%', marginVertical: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  msgMe: { alignSelf: 'flex-end', backgroundColor: '#FF2D55', borderBottomRightRadius: 4 },
  msgThem: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: '600', color: '#8e8e93', marginBottom: 2 },
  msgText: { fontSize: 16, lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTextThem: { color: '#1c1c1e' },
  msgTime: { fontSize: 11, marginTop: 4 },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  msgTimeThem: { color: '#c7c7cc' },
  quotaBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5856D6', paddingVertical: 10, paddingHorizontal: 16, gap: 4 },
  quotaBannerText: { color: '#fff', fontSize: 14 },
  quotaBannerLink: { color: '#fff', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0d0d8' },
  textInput: { flex: 1, borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 100, backgroundColor: '#FFFAFB', color: '#1c1c1e' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF2D55', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendBtnDisabled: { opacity: 0.5 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  overlayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center', width: '82%', maxWidth: 340 },
  overlayTitle: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e', marginTop: 12 },
  overlaySubtitle: { fontSize: 14, color: '#8e8e93', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  overlayBtn: { backgroundColor: '#FF2D55', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 28, marginTop: 16 },
  overlayBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  overlayDismiss: { fontSize: 14, color: '#8e8e93', marginTop: 12, textDecorationLine: 'underline' },
});
