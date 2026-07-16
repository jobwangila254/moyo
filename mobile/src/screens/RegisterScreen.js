import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Modal, FlatList, useWindowDimensions, Image, Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, users, uploadApi, setAuthToken } from '../services/api';

const GENDERS = ['male', 'female', 'non-binary', 'other'];
const INTERESTED_IN_OPTIONS = [
  { label: 'Women', value: 'female' },
  { label: 'Men', value: 'male' },
  { label: 'Everyone', value: 'both' },
];

const LIKES_OPTIONS = [
  'Music', 'Travel', 'Food', 'Fitness', 'Movies', 'Reading', 'Art',
  'Fashion', 'Tech', 'Nature', 'Photography', 'Dancing', 'Animals', 'Coffee',
];

const HOBBIES_OPTIONS = [
  'Hiking', 'Cooking', 'Gaming', 'Sports', 'Yoga', 'Painting', 'Writing',
  'Gardening', 'Cycling', 'Swimming', 'Running', 'Singing', 'Dancing', 'Camping',
];

export default function RegisterScreen({ navigation }) {
  const { height } = useWindowDimensions();
  const [step, setStep] = useState(1);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [countyId, setCountyId] = useState('');
  const [countyName, setCountyName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [selectedLikes, setSelectedLikes] = useState([]);
  const [selectedHobbies, setSelectedHobbies] = useState([]);
  const [code, setCode] = useState('');
  const [counties, setCounties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCountyPicker, setShowCountyPicker] = useState(false);
  const [countiesLoading, setCountiesLoading] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showInterestedPicker, setShowInterestedPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [, setUploadingPhotos] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (verified) {
      navigation.reset({ index: 0, routes: [{ name: 'OnboardingSetup' }] });
    }
  }, [verified]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountiesLoading(true);
    users.getCounties().then(res => {
      if (!cancelled) { setCounties(res.data.data || []); }
    }).catch(() => {}).finally(() => {
      if (!cancelled) { setCountiesLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const toggleLike = (item) => {
    setSelectedLikes(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item],
    );
  };

  const toggleHobby = (item) => {
    setSelectedHobbies(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item],
    );
  };

  const handleRegister = async () => {
    setError('');
    setSentMessage('');
    if (!phone || !password || !name || !age || !gender || !countyId) {
      setError('Please fill in all required fields');
      return;
    }
    if (phone.length < 10) {
      setError('Please enter a valid phone number (e.g. 0712345678)');
      return;
    }
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) {
      setError('Please enter a valid age (18-120)');
      return;
    }

    setLoading(true);
    try {
      await auth.register({
        phone, password, name, age: parsedAge, gender, interestedIn: interestedIn || 'both', countyId,
        occupation: occupation || undefined,
        likes: selectedLikes,
        hobbies: selectedHobbies,
      });
      setStep(2);
    } catch (error) {
      const msg = error.response?.data?.error || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    if (!code) {
      setError('Please enter the verification code');
      return;
    }
    setLoading(true);
    try {
      const response = await auth.verifyPhone({ phone, code });
      setAuthToken(response.data.data.token);
      if (photos.length > 0) {
        setUploadingPhotos(true);
        try {
          for (const uri of photos) {
            const formData = new FormData();
            const filename = uri.split('/').pop() || 'photo.jpg';
            if (Platform.OS === 'web') {
              const response = await fetch(uri);
              const blob = await response.blob();
              formData.append('photo', blob, filename);
            } else {
              formData.append('photo', { uri, type: 'image/jpeg', name: filename });
            }
            await uploadApi.uploadPhoto(formData);
          }
        } catch (e) {
          console.warn('Photo upload failed', e);
        } finally {
          setUploadingPhotos(false);
        }
      }
      setVerified(true);
    } catch (error) {
      const msg = error.response?.data?.error || 'Verification failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6 - photos.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleResend = async () => {
    setError('');
    setSentMessage('');
    setLoading(true);
    try {
      await auth.resendCode(phone);
      setSentMessage('Code sent!');
    } catch (error) {
      setError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <View style={styles.root}>
        <ScrollView style={styles.scroll} contentContainerStyle={{ minHeight: height }} keyboardShouldPersistTaps="handled">
          <View style={styles.romanticHeader}>
            <View style={styles.logoCircle}>
              <MaterialIcons name="favorite" size={36} color="#fff" />
            </View>
            <Text style={styles.romanticTitle}>One last step...</Text>
            <Text style={styles.subtitle}>Enter the code sent to {phone}</Text>
          </View>
          <View style={styles.formCard}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor="#c7c7cc"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Verify My Heart 💕</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            {error ? <Text style={{color:'red',textAlign:'center',marginTop:8}}>{error}</Text> : null}
            {sentMessage ? <Text style={{color:'green',textAlign:'center',marginTop:8}}>{sentMessage}</Text> : null}
            <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={loading}>
              <Text style={styles.resendText}>Resend code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ minHeight: height }} keyboardShouldPersistTaps="handled">
        <View style={styles.romanticHeader}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="favorite" size={36} color="#fff" />
          </View>
          <Text style={styles.romanticTitle}>Find Your Spark</Text>
          <Text style={styles.subtitle}>Your next love story starts here</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.form}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="phone" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="0712 345 678"
                placeholderTextColor="#c7c7cc" value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" maxLength={13}
              />
            </View>

            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="Min 8 characters"
                placeholderTextColor="#c7c7cc" value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#8e8e93" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="person" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="John Doe"
                placeholderTextColor="#c7c7cc" value={name} onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <Text style={styles.label}>Age *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="cake" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="25"
                placeholderTextColor="#c7c7cc" value={age} onChangeText={setAge}
                keyboardType="number-pad" maxLength={3}
              />
            </View>

            <Text style={styles.label}>Gender *</Text>
            <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowGenderPicker(true)}>
              <MaterialIcons name="wc" size={20} color="#8e8e93" style={styles.inputIcon} />
              <Text style={[styles.input, gender ? styles.pickerSelected : styles.pickerPlaceholder]}>
                {gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : 'Select gender'}
              </Text>
              <MaterialIcons name="expand-more" size={20} color="#8e8e93" />
            </TouchableOpacity>

            <Text style={styles.label}>Interested In</Text>
            <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowInterestedPicker(true)}>
              <MaterialIcons name="favorite" size={20} color="#8e8e93" style={styles.inputIcon} />
              <Text style={[styles.input, interestedIn ? styles.pickerSelected : styles.pickerPlaceholder]}>
                {interestedIn ? INTERESTED_IN_OPTIONS.find(o => o.value === interestedIn)?.label || interestedIn : 'Select preference'}
              </Text>
              <MaterialIcons name="expand-more" size={20} color="#8e8e93" />
            </TouchableOpacity>

            <Text style={styles.label}>County *</Text>
            <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowCountyPicker(true)}>
              <MaterialIcons name="location-on" size={20} color="#8e8e93" style={styles.inputIcon} />
              <Text style={[styles.input, countyId ? styles.pickerSelected : styles.pickerPlaceholder]}>
                {countyName || 'Select your county'}
              </Text>
              <MaterialIcons name="expand-more" size={20} color="#8e8e93" />
            </TouchableOpacity>

            <Text style={styles.label}>Occupation</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="work" size={20} color="#8e8e93" style={styles.inputIcon} />
              <TextInput
                style={styles.input} placeholder="Software Engineer"
                placeholderTextColor="#c7c7cc" value={occupation} onChangeText={setOccupation}
              />
            </View>

            <Text style={styles.label}>Things I Like ❤️</Text>
            <View style={styles.chipsRow}>
              {LIKES_OPTIONS.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, selectedLikes.includes(item) && styles.chipActive]}
                  onPress={() => toggleLike(item)}
                >
                  <Text style={[styles.chipText, selectedLikes.includes(item) && styles.chipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>My Hobbies ⭐</Text>
            <View style={styles.chipsRow}>
              {HOBBIES_OPTIONS.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, selectedHobbies.includes(item) && styles.chipHobbyActive]}
                  onPress={() => toggleHobby(item)}
                >
                  <Text style={[styles.chipText, selectedHobbies.includes(item) && styles.chipTextHobbyActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>My Photos 📸</Text>
            <View style={styles.photoRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => handleRemovePhoto(i)}>
                    <MaterialIcons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 6 && (
                <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickPhoto}>
                  <MaterialIcons name="add-a-photo" size={24} color="#FF2D55" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <View style={styles.buttonInner}>
                  <Text style={styles.buttonText}>Find My Match 💕</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            {error ? <Text style={{color:'red',textAlign:'center',marginTop:8}}>{error}</Text> : null}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have someone? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showInterestedPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Interested In</Text>
              <TouchableOpacity onPress={() => setShowInterestedPicker(false)}>
                <MaterialIcons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={INTERESTED_IN_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, interestedIn === item.value && styles.modalItemActive]}
                  onPress={() => { setInterestedIn(item.value); setShowInterestedPicker(false); }}
                >
                  <Text style={[styles.modalItemText, interestedIn === item.value && styles.modalItemTextActive]}>
                    {item.label}
                  </Text>
                  {interestedIn === item.value && <MaterialIcons name="check" size={20} color="#FF2D55" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showCountyPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select County</Text>
              <TouchableOpacity onPress={() => setShowCountyPicker(false)}>
                <MaterialIcons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            {countiesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF2D55" />
              </View>
            ) : (
            <FlatList
              data={counties}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, countyId === item.id && styles.modalItemActive]}
                  onPress={() => { setCountyId(item.id); setCountyName(item.name); setShowCountyPicker(false); }}
                >
                  <Text style={[styles.modalItemText, countyId === item.id && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                  {countyId === item.id && <MaterialIcons name="check" size={20} color="#FF2D55" />}
                </TouchableOpacity>
              )}
            />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showGenderPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Gender</Text>
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <MaterialIcons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={GENDERS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, gender === item && styles.modalItemActive]}
                  onPress={() => { setGender(item); setShowGenderPicker(false); }}
                >
                  <Text style={[styles.modalItemText, gender === item && styles.modalItemTextActive]}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                  {gender === item && <MaterialIcons name="check" size={20} color="#FF2D55" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

RegisterScreen.propTypes = {
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
  form: { gap: 4 },
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
  pickerSelected: { color: '#1c1c1e' },
  pickerPlaceholder: { color: '#c7c7cc' },
  eyeButton: { padding: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  chip: {
    borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: '#FFFAFB',
  },
  chipActive: { borderColor: '#FF2D55', backgroundColor: '#FFF0F3' },
  chipHobbyActive: { borderColor: '#5856D6', backgroundColor: '#F5F3FF' },
  chipText: { fontSize: 13, color: '#8e8e93' },
  chipTextActive: { color: '#FF2D55', fontWeight: '600' },
  chipTextHobbyActive: { color: '#5856D6', fontWeight: '600' },
  button: {
    backgroundColor: '#FF2D55', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  resendButton: { alignItems: 'center', marginTop: 16 },
  resendText: { color: '#FF2D55', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 30 },
  footerText: { color: '#8e8e93', fontSize: 14 },
  footerLink: { color: '#FF2D55', fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingBottom: 34 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f7',
  },
  modalItemActive: { backgroundColor: '#FFF0F3' },
  modalItemText: { fontSize: 16, color: '#1c1c1e' },
  modalItemTextActive: { color: '#FF2D55', fontWeight: '600' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  addPhotoButton: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#f0d0d8', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFAFB' },
  loadingContainer: { padding: 40, alignItems: 'center' },
});
