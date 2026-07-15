import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { height } = useWindowDimensions();

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigation.goBack(), 1500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSendCode = async () => {
    setError('');
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      await auth.forgotPassword(phone);
      setStep(2);
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send reset code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!code || !password) {
      setError('Please enter the code and a new password');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await auth.resetPassword({ phone, code, password });
      setSuccess('Your password has been reset 💕');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to reset password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ minHeight: height }} keyboardShouldPersistTaps="handled">
        <View style={styles.romanticHeader}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="lock" size={36} color="#fff" />
          </View>
          <Text style={styles.romanticTitle}>
            {step === 1 ? 'Forgot Your Secret?' : 'Reset Password'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 1 ? "Don't worry, we've got you covered" : 'Enter the code sent to your phone'}
          </Text>
        </View>

        <View style={styles.formCard}>
          {step === 1 ? (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="phone" size={20} color="#FF2D55" style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="0712 345 678"
                  placeholderTextColor="#c7c7cc" value={phone} onChangeText={setPhone}
                  keyboardType="phone-pad" maxLength={13}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>Send Reset Code</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification Code</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="lock" size={20} color="#FF2D55" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="000000"
                  placeholderTextColor="#c7c7cc"
                  value={code} onChangeText={setCode}
                  keyboardType="number-pad" maxLength={6}
                />
              </View>

              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="vpn-key" size={20} color="#FF2D55" style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="Min 8 characters"
                  placeholderTextColor="#c7c7cc" value={password} onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#8e8e93" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <View style={styles.buttonInner}>
                    <Text style={styles.buttonText}>Reset Password</Text>
                    <MaterialIcons name="check" size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
          {error ? <Text style={{ color: 'red', textAlign: 'center', marginTop: 10 }}>{error}</Text> : null}
          {success ? <Text style={{ color: '#34C759', textAlign: 'center', marginTop: 10 }}>{success}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

ForgotPasswordScreen.propTypes = {
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
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  eyeButton: { padding: 4 },
  button: { backgroundColor: '#FF2D55', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  linkButton: { alignItems: 'center', marginTop: 15 },
  linkText: { color: '#FF2D55', fontSize: 14 },
});
