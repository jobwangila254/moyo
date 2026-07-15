import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, useWindowDimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { payments, users } from '../services/api';
import { formatPhoneNumber, validatePhoneNumber, PAYMENT_OPTIONS } from '../services/mpesa';

export default function PaymentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  useWindowDimensions();
  const matchId = route.params?.matchId || null;
  const likerId = route.params?.likerId || null;
  const matchName = route.params?.matchName || null;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState(matchId ? 'match_unlock' : likerId ? 'like_unlock' : null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); }
    };
  }, []);

  useEffect(() => {
    if (!paymentResult) return;
    const timer = setTimeout(async () => {
      if (paymentResult.success && paymentResult.matchId) {
        let partner = { id: null, name: matchName || 'Match', profilePicUrl: null };
        try {
          const matchesRes = await users.getMatches();
          const matches = matchesRes.data?.data || [];
          const found = matches.find(m => m.id === paymentResult.matchId);
          if (found) {
            partner = { id: found.match?.id || null, name: found.match?.name || 'Match', profilePicUrl: found.match?.profilePicUrl || null };
          }
        } catch { /* use fallback */ }
        navigation.replace('Chat', { matchId: paymentResult.matchId, match: partner });
      } else if (paymentResult.success) {
        navigation.goBack();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [paymentResult]);

  const pollStatus = (transactionId) => {
    setPolling(true);
    setStatusMsg('Processing payment...');
    let attempts = 0;
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await payments.getStatus(transactionId);
        const tx = res.data?.data;
        if (tx?.status === 'completed') {
          clearInterval(pollingRef.current);
          setPolling(false);
          const unlockedMatchId = selectedPaymentType === 'match_unlock' ? matchId
            : selectedPaymentType === 'like_unlock' ? tx?.matchId || null
            : null;
          setStatusMsg('');
          setPaymentResult({ success: true, matchId: unlockedMatchId });
        } else if (tx?.status === 'failed') {
          clearInterval(pollingRef.current);
          setPolling(false);
          setStatusMsg('');
          setPaymentResult({ success: false, error: 'The payment was not completed. Please try again.' });
        } else if (attempts > 30) {
          clearInterval(pollingRef.current);
          setPolling(false);
          setStatusMsg('');
          setPaymentResult({ success: false, error: 'Payment is taking longer than expected.' });
        }
      } catch {
        if (attempts > 30) {
          clearInterval(pollingRef.current);
          setPolling(false);
          setStatusMsg('');
          setPaymentResult({ success: false, error: 'Could not verify payment status.' });
        }
      }
    }, 2000);
  };

  const availableOptions = matchId
    ? {
        match_unlock: { ...PAYMENT_OPTIONS.match_unlock, label: `Unlock ${matchName || 'Match'}` },
        daily_chat_unlock: { ...PAYMENT_OPTIONS.daily_chat_unlock, label: `Daily Chat - ${matchName || 'Match'}` },
      }
    : likerId
      ? { like_unlock: { ...PAYMENT_OPTIONS.like_unlock, label: `Like Back & Unlock ${matchName || ''}` } }
      : Object.fromEntries(Object.entries(PAYMENT_OPTIONS).filter(([k]) => k.startsWith('subscription')));

  const handlePayment = async () => {
    if (!selectedPaymentType) {
      setStatusMsg('Please select an option');
      return;
    }
    if (!validatePhoneNumber(phoneNumber)) {
      setStatusMsg('Please enter a valid phone number (e.g., 0712345678)');
      return;
    }
    setLoading(true);
    setStatusMsg('');
    setPaymentResult(null);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const payload = { phoneNumber: formattedPhone, type: selectedPaymentType };
      if (selectedPaymentType === 'match_unlock' && matchId) {payload.matchId = matchId;}
      if (selectedPaymentType === 'like_unlock' && likerId) {payload.matchId = likerId;}
      const res = await payments.initiateSTKPush(payload);
      setLoading(false);
      const transactionId = res.data?.data?.transactionId;
      if (transactionId) {
        pollStatus(transactionId);
      } else {
        setStatusMsg('Payment initiated. Check your phone.');
      }
    } catch (error) {
      setLoading(false);
      setStatusMsg(error.response?.data?.error || 'Payment failed. Please try again.');
    }
  };

  if (paymentResult?.success) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: '#34C759' }]}>
            <MaterialIcons name="check" size={48} color="#fff" />
          </View>
          <Text style={styles.resultTitle}>Payment Successful!</Text>
          <Text style={styles.resultSubtitle}>
            {selectedPaymentType === 'like_unlock'
              ? `You liked back ${matchName || 'your match'}! Redirecting to chat...`
              : selectedPaymentType === 'match_unlock'
                ? `Chat unlocked with ${matchName || 'your match'}! Redirecting...`
                : 'Payment completed! Redirecting...'}
          </Text>
          <ActivityIndicator size="small" color="#FF2D55" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      <View style={styles.headerSection}>
        <View style={styles.logoCircle}><MaterialIcons name="stars" size={36} color="#fff" /></View>
        <Text style={styles.title}>{matchId ? 'Unlock Love 💕' : likerId ? 'Like Back & Unlock 💕' : 'Find Love Everywhere'}</Text>
        <Text style={styles.subtitle}>
          {matchId ? `Keep chatting with ${matchName || 'your match'} — unlimited messages` : likerId ? `Like back and start chatting with ${matchName || 'your match'} for only Ksh 20` : 'Go Premium to see profiles from all 47 counties'}
        </Text>
      </View>

      <View style={styles.plans}>
        {Object.entries(availableOptions).map(([key, plan]) => (
          <TouchableOpacity
            key={key}
            style={[styles.planCard, selectedPaymentType === key && styles.selectedPlan]}
            onPress={() => setSelectedPaymentType(key)}
          >
            <View style={styles.planHeader}>
              <MaterialIcons name={selectedPaymentType === key ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={selectedPaymentType === key ? '#FF2D55' : '#8e8e93'} />
              <Text style={[styles.planName, selectedPaymentType === key && styles.selectedText]}>{plan.label}</Text>
              <View style={styles.flexSpacer} />
              <Text style={styles.planPrice}>KSh {plan.amount}</Text>
            </View>
            <Text style={styles.planDescription}>{plan.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>M-Pesa Number</Text>
        <View style={styles.inputWrapper}><MaterialIcons name="phone" size={20} color="#FF2D55" style={styles.inputIcon} /><TextInput style={styles.input} placeholder="0712 345 678" placeholderTextColor="#c7c7cc" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" maxLength={12} /></View>
        <Text style={styles.hint}>Your Safaricom number for M-Pesa</Text>
        <TouchableOpacity style={[styles.payButton, (!selectedPaymentType || loading || polling) && styles.payButtonDisabled]} onPress={(!selectedPaymentType || loading || polling) ? undefined : handlePayment}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <View style={styles.buttonInner}><MaterialIcons name="payment" size={20} color="#fff" /><Text style={styles.payButtonText}>{selectedPaymentType ? `Pay KSh ${availableOptions[selectedPaymentType]?.amount} via M-Pesa` : 'Select an option'}</Text></View>
          )}
        </TouchableOpacity>
        {polling && (
          <View style={styles.pollingRow}>
            <ActivityIndicator size="small" color="#FF2D55" />
            <Text style={styles.pollingText}>{statusMsg || 'Processing payment...'}</Text>
          </View>
        )}
        {statusMsg && !polling && !paymentResult && (
          <View style={styles.errorRow}>
            <MaterialIcons name="info-outline" size={16} color="#FF3B30" />
            <Text style={styles.errorText}>{statusMsg}</Text>
          </View>
        )}
        {paymentResult?.success === false && (
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={16} color="#FF3B30" />
            <Text style={styles.errorText}>{paymentResult.error}</Text>
          </View>
        )}
        <View style={styles.info}><MaterialIcons name="info" size={16} color="#8e8e93" /><Text style={styles.infoText}>You&apos;ll receive an STK push on your phone. Enter your M-Pesa PIN to complete.</Text></View>
      </View>
    </ScrollView>
  );
}

PaymentScreen.propTypes = {
  route: PropTypes.object,
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  headerSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 30, backgroundColor: '#FF2D55', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  plans: { paddingHorizontal: 20, marginTop: -15, gap: 12, zIndex: 1 },
  planCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 2, borderColor: '#f0d0d8', boxShadow: '0 2px 8px 0 rgba(255,45,85,0.06)' },
  selectedPlan: { borderColor: '#FF2D55', backgroundColor: '#FFF0F3' },
  flexSpacer: { flex: 1 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e' },
  selectedText: { color: '#FF2D55' },
  planPrice: { fontSize: 22, fontWeight: 'bold', color: '#FF2D55' },
  planDescription: { fontSize: 14, color: '#8e8e93', marginTop: 8, marginLeft: 32 },
  formCard: { backgroundColor: '#fff', marginHorizontal: 20, marginTop: 20, borderRadius: 16, padding: 20, boxShadow: '0 2px 8px 0 rgba(255,45,85,0.06)' },
  label: { fontSize: 13, fontWeight: '600', color: '#3a3a3c', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 12, backgroundColor: '#FFFAFB', paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 18, color: '#1c1c1e' },
  hint: { fontSize: 12, color: '#8e8e93', marginTop: 6 },
  payButton: { backgroundColor: '#FF2D55', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  payButtonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  info: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, gap: 8 },
  infoText: { flex: 1, fontSize: 12, color: '#8e8e93', lineHeight: 18 },
  pollingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 },
  pollingText: { fontSize: 14, color: '#FF2D55', fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  errorText: { fontSize: 13, color: '#FF3B30', fontWeight: '500' },
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: '#1c1c1e', textAlign: 'center' },
  resultSubtitle: { fontSize: 15, color: '#8e8e93', textAlign: 'center', marginTop: 8 },
});
