import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, useWindowDimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { subscriptions } from '../services/api';
import { PAYMENT_OPTIONS } from '../services/mpesa';

const PLAN_KEYS = ['subscription_weekly', 'subscription_fortnightly', 'subscription_monthly', 'subscription_halfyear', 'subscription_yearly'];

const PLAN_META = {
  subscription_weekly: { label: 'Weekly', color: '#FF9500', icon: 'calendar-today' },
  subscription_fortnightly: { label: 'Fortnightly', color: '#34C759', icon: 'date-range' },
  subscription_monthly: { label: 'Monthly', color: '#FF2D55', icon: 'calendar-month' },
  subscription_halfyear: { label: '6 Months', color: '#5856D6', icon: 'event' },
  subscription_yearly: { label: 'Yearly', color: '#007AFF', icon: 'event-available' },
};

export default function SubscriptionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [currentSub, setCurrentSub] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [changing, setChanging] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [currentRes, historyRes] = await Promise.all([
        subscriptions.getCurrent(),
        subscriptions.getHistory(),
      ]);
      setCurrentSub(currentRes.data?.data || null);
      setHistory(historyRes.data?.data || []);
    } catch {
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancel = async () => {
    if (!currentSub) return;
    setCancelling(true);
    setError('');
    try {
      await subscriptions.cancel(currentSub.id);
      setSuccess('Auto-renewal cancelled. Your plan is active until ' + new Date(currentSub.endDate).toLocaleDateString());
      setConfirmCancel(false);
      fetchData();
    } catch {
      setError('Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleChangePlan = async (plan) => {
    setChanging(plan);
    setError('');
    setSuccess('');
    try {
      await subscriptions.changePlan({ plan, paymentMethod: 'mpesa' });
      setSuccess(`Switching to ${PLAN_META[plan]?.label || plan}. Processing payment...`);
      setTimeout(fetchData, 2000);
    } catch {
      setError('Failed to change plan');
    } finally {
      setChanging(null);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatAmount = (plan) => PAYMENT_OPTIONS[plan]?.amount || '—';

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2D55" />
          <Text style={styles.loadingText}>Loading subscriptions...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      <View style={styles.headerSection}>
        <View style={styles.logoCircle}><MaterialIcons name="card-membership" size={36} color="#fff" /></View>
        <Text style={styles.title}>Subscriptions</Text>
        <Text style={styles.subtitle}>Manage your premium plan</Text>
      </View>

      {error ? (
        <View style={styles.alertRow}>
          <MaterialIcons name="error-outline" size={18} color="#FF3B30" />
          <Text style={styles.alertError}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={styles.alertRow}>
          <MaterialIcons name="check-circle" size={18} color="#34C759" />
          <Text style={styles.alertSuccess}>{success}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Plan</Text>
        {currentSub ? (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View style={[styles.activeBadge, { backgroundColor: PLAN_META[currentSub.plan]?.color || '#FF2D55' }]}>
                <MaterialIcons name={PLAN_META[currentSub.plan]?.icon || 'star'} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activePlanName}>{PLAN_META[currentSub.plan]?.label || currentSub.plan}</Text>
                <Text style={styles.activePlanPrice}>KSh {formatAmount(currentSub.plan)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: currentSub.autoRenew ? '#34C75920' : '#FF950020' }]}>
                <Text style={[styles.statusBadgeText, { color: currentSub.autoRenew ? '#34C759' : '#FF9500' }]}>
                  {currentSub.autoRenew ? 'Auto-Renew' : 'No Auto-Renew'}
                </Text>
              </View>
            </View>
            <View style={styles.activeDetails}>
              <View style={styles.detailRow}>
                <MaterialIcons name="play-circle-outline" size={16} color="#8e8e93" />
                <Text style={styles.detailLabel}>Started</Text>
                <Text style={styles.detailValue}>{formatDate(currentSub.startDate)}</Text>
              </View>
              <View style={styles.detailRow}>
                <MaterialIcons name="event-busy" size={16} color="#8e8e93" />
                <Text style={styles.detailLabel}>Renews</Text>
                <Text style={styles.detailValue}>{formatDate(currentSub.endDate)}</Text>
              </View>
              {currentSub.cancelledAt ? (
                <View style={styles.detailRow}>
                  <MaterialIcons name="cancel" size={16} color="#FF3B30" />
                  <Text style={styles.detailLabel}>Cancelled</Text>
                  <Text style={[styles.detailValue, { color: '#FF3B30' }]}>{formatDate(currentSub.cancelledAt)}</Text>
                </View>
              ) : null}
            </View>

            {!confirmCancel ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmCancel(true)}>
                <MaterialIcons name="cancel" size={18} color="#FF3B30" />
                <Text style={styles.cancelBtnText}>Cancel Auto-Renewal</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>Cancel auto-renewal? Your plan stays active until {formatDate(currentSub.endDate)}.</Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity style={styles.confirmNo} onPress={() => setConfirmCancel(false)}>
                    <Text style={styles.confirmNoText}>Keep</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmYes, cancelling && { opacity: 0.5 }]} onPress={handleCancel} disabled={cancelling}>
                    {cancelling ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmYesText}>Yes, Cancel</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="subscriptions" size={40} color="#d1d1d6" />
            <Text style={styles.emptyTitle}>No Active Subscription</Text>
            <Text style={styles.emptySubtitle}>Choose a plan below to get started</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{currentSub ? 'Change Plan' : 'Choose a Plan'}</Text>
        {PLAN_KEYS.map((key) => {
          const meta = PLAN_META[key];
          const option = PAYMENT_OPTIONS[key];
          const isActive = currentSub?.plan === key;
          const isProcessing = changing === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.planCard, isActive && styles.planCardActive]}
              onPress={() => !isActive && !isProcessing && handleChangePlan(key)}
              disabled={isActive || isProcessing}
            >
              <View style={[styles.planIcon, { backgroundColor: meta.color + '20' }]}>
                <MaterialIcons name={meta.icon} size={24} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, isActive && { color: meta.color }]}>{meta.label}</Text>
                <Text style={styles.planDesc}>{option?.description}</Text>
              </View>
              <Text style={[styles.planPrice, { color: meta.color }]}>KSh {option?.amount}</Text>
              {isActive ? (
                <View style={[styles.activeTag, { backgroundColor: meta.color + '20' }]}>
                  <Text style={[styles.activeTagText, { color: meta.color }]}>Current</Text>
                </View>
              ) : isProcessing ? (
                <ActivityIndicator size="small" color={meta.color} />
              ) : (
                <MaterialIcons name="chevron-right" size={22} color="#c7c7cc" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {history.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription History</Text>
          {history.map((sub) => (
            <View key={sub.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyPlan}>{PLAN_META[sub.plan]?.label || sub.plan}</Text>
                <View style={[styles.historyStatus, { backgroundColor: sub.status === 'active' ? '#34C75920' : sub.status === 'cancelled' ? '#FF950020' : '#FF3B3020' }]}>
                  <Text style={[styles.historyStatusText, { color: sub.status === 'active' ? '#34C759' : sub.status === 'cancelled' ? '#FF9500' : '#FF3B30' }]}>
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.historyDetails}>
                <Text style={styles.historyDate}>{formatDate(sub.startDate)} - {formatDate(sub.endDate)}</Text>
                <Text style={styles.historyAmount}>KSh {formatAmount(sub.plan)}</Text>
              </View>
              {sub.cancelledAt ? (
                <Text style={styles.historyCancelled}>Cancelled {formatDate(sub.cancelledAt)}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

SubscriptionScreen.propTypes = {
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#8e8e93' },
  headerSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 30, backgroundColor: '#FF2D55', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 12 },
  activeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 2, borderColor: '#FF2D55', boxShadow: '0 2px 8px 0 rgba(255,45,85,0.06)' },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeBadge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  activePlanName: { fontSize: 18, fontWeight: 'bold', color: '#1c1c1e' },
  activePlanPrice: { fontSize: 14, color: '#8e8e93', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  activeDetails: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 14, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 13, color: '#8e8e93', width: 70 },
  detailValue: { fontSize: 13, fontWeight: '500', color: '#1c1c1e', flex: 1 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FF3B3040', backgroundColor: '#FF3B3008' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#FF3B30' },
  confirmBox: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#FFF5F5' },
  confirmText: { fontSize: 13, color: '#3a3a3c', lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  confirmNo: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#d1d1d6', alignItems: 'center' },
  confirmNoText: { fontSize: 14, fontWeight: '600', color: '#8e8e93' },
  confirmYes: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center' },
  confirmYesText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#f0d0d8' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#3a3a3c', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#8e8e93', marginTop: 4 },
  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: '#f0d0d8', gap: 12 },
  planCardActive: { borderColor: '#FF2D55', backgroundColor: '#FFF0F3' },
  planIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  planName: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e' },
  planDesc: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  planPrice: { fontSize: 18, fontWeight: 'bold' },
  activeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  activeTagText: { fontSize: 11, fontWeight: '600' },
  historyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyPlan: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  historyStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  historyStatusText: { fontSize: 11, fontWeight: '600' },
  historyDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  historyDate: { fontSize: 12, color: '#8e8e93' },
  historyAmount: { fontSize: 12, fontWeight: '600', color: '#FF2D55' },
  historyCancelled: { fontSize: 11, color: '#FF9500', marginTop: 6 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#fff' },
  alertError: { flex: 1, fontSize: 13, color: '#FF3B30', fontWeight: '500' },
  alertSuccess: { flex: 1, fontSize: 13, color: '#34C759', fontWeight: '500' },
});
