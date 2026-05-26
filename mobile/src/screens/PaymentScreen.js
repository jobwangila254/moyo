import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { payments } from '../services/api';
import { formatPhoneNumber, validatePhoneNumber, PAYMENT_OPTIONS } from '../services/mpesa';

export default function PaymentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const matchId = route.params?.matchId || null;
  const matchName = route.params?.matchName || null;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState(matchId ? 'match_unlock' : null);
  const [loading, setLoading] = useState(false);

  const availableOptions = matchId
    ? { match_unlock: { ...PAYMENT_OPTIONS.match_unlock, label: `Unlock ${matchName || 'Match'}` } }
    : PAYMENT_OPTIONS;

  const handlePayment = async () => {
    if (!selectedPaymentType) {
      Alert.alert('Error', 'Please select an option');
      return;
    }
    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid Kenyan phone number (e.g., 0712345678)');
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const payload = { phoneNumber: formattedPhone, type: selectedPaymentType };
      if (selectedPaymentType === 'match_unlock' && matchId) payload.matchId = matchId;
      await payments.initiateSTKPush(payload);
      Alert.alert(
        'STK Push Sent',
        'Check your phone for the M-Pesa prompt. Enter your PIN to complete the payment 💕',
        [{ text: 'OK' }]
      );
    } catch (error) {
      const message = error.response?.data?.error || 'Payment failed. Please try again.';
      Alert.alert('Error', message);
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      <View style={styles.headerSection}>
        <View style={styles.logoCircle}><MaterialIcons name="stars" size={36} color="#fff" /></View>
        <Text style={styles.title}>{matchId ? 'Unlock Love 💕' : 'Find Love Everywhere'}</Text>
        <Text style={styles.subtitle}>
          {matchId ? `Keep chatting with ${matchName || 'your match'} — unlimited messages for only Ksh 50` : 'Go Premium to see profiles from all 47 counties'}
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
              <View style={{ flex: 1 }} />
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
        <TouchableOpacity style={[styles.payButton, (!selectedPaymentType || loading) && styles.payButtonDisabled]} onPress={handlePayment} disabled={!selectedPaymentType || loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <View style={styles.buttonInner}><MaterialIcons name="payment" size={20} color="#fff" /><Text style={styles.payButtonText}>{selectedPaymentType ? `Pay KSh ${PAYMENT_OPTIONS[selectedPaymentType]?.amount || 50} via M-Pesa` : 'Select an option'}</Text></View>
          )}
        </TouchableOpacity>
        <View style={styles.info}><MaterialIcons name="info" size={16} color="#8e8e93" /><Text style={styles.infoText}>You'll receive an STK push on your phone. Enter your M-Pesa PIN to complete.</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  headerSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 30, backgroundColor: '#FF2D55', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  plans: { paddingHorizontal: 20, marginTop: -15, gap: 12, zIndex: 1 },
  planCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 2, borderColor: '#f0d0d8', boxShadow: '0 2px 8px 0 rgba(255,45,85,0.06)' },
  selectedPlan: { borderColor: '#FF2D55', backgroundColor: '#FFF0F3' },
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
});
