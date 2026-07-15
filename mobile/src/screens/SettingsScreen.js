import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  ScrollView, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { users, auth, clearAuthToken } from '../services/api';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [pushNotifications, setPushNotifications] = useState(true);
  const [matchAlerts, setMatchAlerts] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [showAge, setShowAge] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);
  const [userTier, setUserTier] = useState('FREE');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    if (!feedback.message) return;
    const timer = setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [feedback.message]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, meRes] = await Promise.all([
          users.getSettings(),
          auth.getMe().catch(() => ({ data: { data: { tier: 'FREE' } } })),
        ]);
        const s = settingsRes.data.data;
        setPushNotifications(s.pushNotifications ?? true);
        setMatchAlerts(s.matchNotifications ?? true);
        setMessageAlerts(s.messageNotifications ?? true);
        setShowAge(s.showAge ?? true);
        setProfileVisible(s.profileVisible ?? true);
        setUserTier(meRes.data.data.tier || 'FREE');
      } catch (error) {
        setFeedback({ type: 'error', message: 'Failed to load settings' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const saveSettings = async (data) => {
    setSaving(true);
    try {
      await users.updateSettings(data);
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (setter, key, value) => {
    setter(value);
    saveSettings({ [key]: value });
  };

  const handleLoadBlocked = async () => {
    setShowBlockedModal(true);
    setBlockedLoading(true);
    try {
      const res = await users.getBlockedUsers();
      setBlockedUsers(res.data.data || []);
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to load blocked users' });
    } finally {
      setBlockedLoading(false);
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await users.unblockUser(userId);
      setBlockedUsers(prev => prev.filter(u => u.user?.id !== userId));
      setFeedback({ type: 'success', message: 'User unblocked' });
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to unblock user' });
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      await users.deleteAccount();
      await clearAuthToken();
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to delete account' });
    }
  };

  const renderToggle = (label, value, onValueChange) => (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#e0e0e0', true: '#FFB3C1' }}
        thumbColor={value ? '#FF2D55' : '#f4f3f4'}
        disabled={saving}
      />
    </View>
  );

  const renderMenuRow = (icon, iconColor, label, onPress, rightText) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <MaterialIcons name={icon} size={22} color={iconColor} />
      <Text style={styles.menuLabel}>{label}</Text>
      {rightText ? (
        <Text style={styles.menuRightText}>{rightText}</Text>
      ) : (
        <MaterialIcons name="chevron-right" size={22} color="#8e8e93" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top + 100 }]}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.scrollContent}>
      {feedback.message ? (
        <View style={[styles.feedbackBanner, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={[styles.feedbackText, feedback.type === 'error' ? styles.feedbackTextError : styles.feedbackTextSuccess]}>{feedback.message}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Notifications</Text>
        {renderToggle('Push Notifications', pushNotifications, (v) => handleToggle(setPushNotifications, 'pushNotifications', v))}
        {renderToggle('Match Alerts', matchAlerts, (v) => handleToggle(setMatchAlerts, 'matchNotifications', v))}
        {renderToggle('Message Alerts', messageAlerts, (v) => handleToggle(setMessageAlerts, 'messageNotifications', v))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Privacy</Text>
        {renderToggle('Show Age', showAge, (v) => handleToggle(setShowAge, 'showAge', v))}
        {renderToggle('Profile Visible', profileVisible, (v) => handleToggle(setProfileVisible, 'profileVisible', v))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Support</Text>
        {renderMenuRow('security', '#34C759', 'Safety Tips', () => navigation.navigate('Safety'))}
        {renderMenuRow('help-outline', '#5856D6', 'Help & FAQ', () => setShowFaq(true))}
        {renderMenuRow('support-agent', '#FF9500', 'Contact Support', () => setShowSupport(true))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Account</Text>
        {renderMenuRow('block', '#FF3B30', 'View Blocked Users', handleLoadBlocked)}
        {renderMenuRow('delete-forever', '#FF3B30', 'Delete Account', () => setShowDeleteConfirm(true))}
        {showDeleteConfirm && (
          <View style={styles.deleteConfirmBox}>
            <Text style={styles.deleteConfirmText}>Are you sure? This action cannot be undone.</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmBtnCancel} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.confirmBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnDelete} onPress={handleDeleteAccount}>
                <Text style={styles.confirmBtnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Premium</Text>
        <View style={styles.premiumRow}>
          <MaterialIcons name={userTier === 'PREMIUM' ? 'stars' : 'star-border'} size={22} color={userTier === 'PREMIUM' ? '#FF9500' : '#8e8e93'} />
          <Text style={[styles.menuLabel, userTier === 'PREMIUM' && styles.premiumActiveText]}>
            {userTier === 'PREMIUM' ? 'Premium Active' : 'Free Plan'}
          </Text>
          {userTier === 'PREMIUM' ? (
            <MaterialIcons name="check-circle" size={22} color="#34C759" />
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('Payment')}>
              <Text style={styles.upgradeText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal visible={showBlockedModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Blocked Users</Text>
              <TouchableOpacity onPress={() => setShowBlockedModal(false)}>
                <MaterialIcons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            {blockedLoading ? (
              <ActivityIndicator size="large" color="#FF2D55" style={{ marginVertical: 30 }} />
            ) : blockedUsers.length === 0 ? (
              <Text style={styles.emptyText}>No blocked users</Text>
            ) : (
              <FlatList
                data={blockedUsers}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.blockedRow}>
                    <Text style={styles.blockedName}>{item.user?.name || 'Unknown'}</Text>
                    <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(item.user?.id)}>
                      <Text style={styles.unblockBtnText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showFaq} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & FAQ</Text>
              <TouchableOpacity onPress={() => setShowFaq(false)}>
                <MaterialIcons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.faqScroll}>
              <Text style={styles.faqItem}>How do I match with someone?\nTap the heart icon on a profile you like. If they like you back, it's a match!</Text>
              <Text style={styles.faqItem}>How do I verify my account?\nWe'll send a code to your phone during registration. Enter it to verify.</Text>
              <Text style={styles.faqItem}>Can I change my preferences?\nYes! Go to your Profile screen to update your interests and bio.</Text>
              <Text style={styles.faqItem}>How do I report someone?\nUse the report button on their profile to let us know about any concerns.</Text>
              <Text style={styles.faqItem}>What is Premium?\nPremium gives you unlimited likes, see who liked you, and more profile visibility.</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showSupport} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <TouchableOpacity onPress={() => setShowSupport(false)}>
                <MaterialIcons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            <View style={styles.supportBody}>
              <Text style={styles.supportText}>Need help? Reach out to us:</Text>
              <Text style={styles.supportEmail}>support@moyo.app</Text>
              <Text style={styles.supportText}>Our team typically responds within 24 hours.</Text>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

SettingsScreen.propTypes = {
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  scrollContent: { paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center' },
  section: { backgroundColor: '#fff', marginTop: 12, paddingHorizontal: 20, paddingVertical: 4 },
  sectionHeader: {
    fontSize: 13, fontWeight: '600', color: '#8e8e93',
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 0, paddingVertical: 12,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f7',
  },
  toggleLabel: { fontSize: 16, color: '#1c1c1e' },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f7', gap: 12,
  },
  menuLabel: { flex: 1, fontSize: 16, color: '#1c1c1e' },
  menuRightText: { fontSize: 14, color: '#8e8e93' },
  premiumRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 12,
  },
  premiumActiveText: { color: '#FF9500' },
  upgradeText: { color: '#FF2D55', fontSize: 15, fontWeight: '600' },
  deleteConfirmBox: { backgroundColor: '#FFF5F5', padding: 14, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: '#FFD0D0' },
  deleteConfirmText: { fontSize: 14, color: '#3a3a3c', marginBottom: 10, lineHeight: 20 },
  confirmButtons: { flexDirection: 'row', gap: 10 },
  confirmBtnCancel: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  confirmBtnCancelText: { fontSize: 14, fontWeight: '500', color: '#3a3a3c' },
  confirmBtnDelete: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FF3B30' },
  confirmBtnDeleteText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 34 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  emptyText: { textAlign: 'center', paddingVertical: 30, fontSize: 15, color: '#8e8e93' },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f7',
  },
  blockedName: { fontSize: 16, color: '#1c1c1e', flex: 1 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFF0F3', borderWidth: 1, borderColor: '#FF2D55' },
  unblockBtnText: { fontSize: 13, color: '#FF2D55', fontWeight: '600' },
  faqScroll: { paddingHorizontal: 20 },
  faqItem: { fontSize: 15, color: '#1c1c1e', lineHeight: 22, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f7' },
  supportBody: { paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' },
  supportText: { fontSize: 15, color: '#8e8e93', textAlign: 'center', marginBottom: 8 },
  supportEmail: { fontSize: 17, color: '#FF2D55', fontWeight: '600', marginBottom: 12 },
  feedbackBanner: { paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 15, marginTop: 10, borderRadius: 10 },
  feedbackSuccess: { backgroundColor: '#E8F5E9' },
  feedbackError: { backgroundColor: '#FFEBEE' },
  feedbackText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  feedbackTextSuccess: { color: '#2E7D32' },
  feedbackTextError: { color: '#C62828' },
});
