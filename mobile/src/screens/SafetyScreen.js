import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { users } from '../services/api';

export default function SafetyScreen() {
  const insets = useSafeAreaInsets();
  const [safetyData, setSafetyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [callingContact, setCallingContact] = useState(null);

  const loadSafetyData = useCallback(async () => {
    try {
      const res = await users.getSafetyStatus();
      setSafetyData(res.data.data);
    } catch {
      // silently ignore load errors
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSafetyData(); }, [loadSafetyData]));

  const handleCall = (contact) => {
    setCallingContact(contact);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  const tips = safetyData?.tips || [];

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.romanticHeader}>
        <View style={styles.logoCircle}>
          <MaterialIcons name="security" size={36} color="#fff" />
        </View>
        <Text style={styles.romanticTitle}>Stay Safe</Text>
        <Text style={styles.subtitle}>Your safety is our priority 💕</Text>
      </View>

      {tips.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Safety Tips</Text>
          {tips.map((tip, idx) => (
            <View key={idx} style={styles.tipRow}>
              <MaterialIcons name="check-circle" size={20} color="#34C759" style={styles.tipIcon} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {safetyData?.emergencyContacts?.length > 0 && (
        <View style={[styles.card, styles.lastCard]}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          {callingContact && (
            <View style={styles.callConfirm}>
              <Text style={styles.callConfirmText}>Call {callingContact.name}?</Text>
              <View style={styles.callConfirmActions}>
                <TouchableOpacity
                  style={styles.callConfirmBtn}
                  onPress={() => { Linking.openURL(`tel:${callingContact.phone}`); setCallingContact(null); }}
                >
                  <Text style={styles.callConfirmBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.callConfirmBtn, styles.callConfirmCancel]}
                  onPress={() => setCallingContact(null)}
                >
                  <Text style={[styles.callConfirmBtnText, styles.callConfirmCancelText]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {safetyData.emergencyContacts.map((contact, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.contactRow}
              onPress={() => handleCall(contact)}
            >
              <View style={styles.phoneIconCircle}>
                <MaterialIcons name="phone" size={20} color="#fff" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#8e8e93" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

SafetyScreen.propTypes = {};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  romanticHeader: {
    alignItems: 'center', paddingTop: 20, paddingBottom: 30,
    backgroundColor: '#FF2D55', borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
  },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  romanticTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 20,
    marginTop: 20, padding: 20,
    boxShadow: '0 2px 12px 0 rgba(255,45,85,0.08)',
  },
  lastCard: { marginBottom: 30 },
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#FF2D55',
    marginBottom: 16,
  },
  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 14, gap: 10,
  },
  tipIcon: { marginTop: 2 },
  tipText: { flex: 1, fontSize: 15, color: '#3a3a3c', lineHeight: 20 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  phoneIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center',
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600', color: '#1c1c1e' },
  contactPhone: { fontSize: 14, color: '#8e8e93', marginTop: 2 },
  callConfirm: { backgroundColor: '#FFF5F7', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f0d0d8' },
  callConfirmText: { fontSize: 16, fontWeight: '600', color: '#1c1c1e', textAlign: 'center', marginBottom: 12 },
  callConfirmActions: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  callConfirmBtn: { backgroundColor: '#34C759', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  callConfirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  callConfirmCancel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d0d0d0' },
  callConfirmCancelText: { color: '#3a3a3c' },
});
