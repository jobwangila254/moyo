import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, useWindowDimensions, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, setAuthToken } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { height } = useWindowDimensions();
  const isSmall = height < 700;

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Hold on', 'Both phone and password are needed');
      return;
    }

    setLoading(true);
    try {
      const response = await auth.login({ phone, password });
      setAuthToken(response.data.data.token);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed. Check your details and try again.';
      Alert.alert('Not yet', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ minHeight: height }} keyboardShouldPersistTaps="handled">
        <View style={styles.romanticHeader}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="favorite" size={36} color="#fff" />
          </View>
          <Text style={styles.romanticTitle}>Welcome back, sunshine</Text>
          <Text style={styles.subtitle}>Someone&apos;s been missing you ✨</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="phone" size={20} color="#FF2D55" style={styles.inputIcon} />
            <TextInput
              style={styles.input} placeholder="0712 345 678"
              placeholderTextColor="#c7c7cc" value={phone} onChangeText={setPhone}
              keyboardType="phone-pad" maxLength={13}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock" size={20} color="#FF2D55" style={styles.inputIcon} />
            <TextInput
              style={styles.input} placeholder="Enter your password"
              placeholderTextColor="#c7c7cc" value={password} onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
              <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#8e8e93" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <View style={styles.buttonInner}>
                <Text style={styles.buttonText}>Open My Heart 💕</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.linkText}>Forgot your secret?</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, isSmall && styles.footerSmall]}>
          <Text style={styles.footerText}>Haven&apos;t found love yet? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Join Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

LoginScreen.propTypes = {
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF5F7' },
  scroll: { flex: 1 },
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
  formCard: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 20,
    marginTop: -20, padding: 20,
    boxShadow: '0 2px 12px 0 rgba(255,45,85,0.08)',
  },
  label: {
    fontSize: 13, fontWeight: '600', color: '#3a3a3c',
    marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: '#f0d0d8', borderRadius: 12, backgroundColor: '#FFFAFB', paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#1c1c1e' },
  eyeButton: { padding: 4 },
  button: { backgroundColor: '#FF2D55', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  linkButton: { alignItems: 'center', marginTop: 15 },
  linkText: { color: '#FF2D55', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 30 },
  footerSmall: { paddingVertical: 20 },
  footerText: { color: '#8e8e93', fontSize: 14 },
  footerLink: { color: '#FF2D55', fontSize: 14, fontWeight: 'bold' },
});
