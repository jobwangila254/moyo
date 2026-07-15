import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Image, useWindowDimensions, Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import TierBadge from '../components/TierBadge';
import { auth, users, uploadApi, clearAuthToken } from '../services/api';

const LIKES_OPTIONS = ['Music', 'Travel', 'Food', 'Fitness', 'Movies', 'Reading', 'Art', 'Fashion', 'Tech', 'Nature', 'Photography', 'Dancing', 'Animals', 'Coffee'];
const HOBBIES_OPTIONS = ['Hiking', 'Cooking', 'Gaming', 'Sports', 'Yoga', 'Painting', 'Writing', 'Gardening', 'Cycling', 'Swimming', 'Running', 'Singing', 'Dancing', 'Camping'];

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v || '[]'); } catch { return []; }
};

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [age, setAge] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [likes, setLikes] = useState([]);
  const [hobbies, setHobbies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPhotoRemove, setPendingPhotoRemove] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!feedback.message) return;
    const timer = setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [feedback.message]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await auth.getMe();
      const data = response.data.data;
      setUser(data);
      setName(data.name || '');
      setBio(data.bio || '');
      setOccupation(data.occupation || '');
      setAge(data.age?.toString() || '');
      setInterestedIn(data.interestedIn || 'both');
      setLikes(toArray(data.likes));
      setHobbies(toArray(data.hobbies));
    } catch (error) {
      if (error.response?.status === 401) {
        await clearAuthToken();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    } finally { setLoading(false); }
  }, [navigation]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { name, bio, occupation, interestedIn, likes, hobbies };
      if (age) {payload.age = parseInt(age, 10);}
      await users.updateProfile(payload);
      setFeedback({ type: 'success', message: "Your heart's profile has been updated 💕" });
      fetchProfile();
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || 'Failed to update profile' });
    } finally { setSaving(false); }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setFeedback({ type: 'error', message: 'We need camera roll access to add photos' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) {return;}

    const asset = result.assets[0];
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = asset.fileName || `photo_${Date.now()}.jpg`;

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('photo', blob, filename);
      } else {
        formData.append('photo', { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: filename });
      }

      const res = await uploadApi.uploadPhoto(formData);
      const { photos } = res.data.data;
      setUser(prev => ({ ...prev, photos, profilePicUrl: prev.profilePicUrl || photos[0] }));
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || 'Failed to upload photo' });
    } finally { setUploading(false); }
  };

  const handleRemovePhoto = (url) => {
    setPendingPhotoRemove(url);
  };

  const confirmRemovePhoto = async () => {
    const url = pendingPhotoRemove;
    setPendingPhotoRemove(null);
    try {
      await uploadApi.deletePhoto(url);
      const currentPhotos = user?.photos || [];
      const filtered = currentPhotos.filter(p => p !== url);
      setUser(prev => ({ ...prev, photos: filtered, profilePicUrl: prev.profilePicUrl === url ? (filtered[0] || null) : prev.profilePicUrl }));
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to remove photo' });
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      await users.deleteAccount();
      await clearAuthToken();
      navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to delete account' });
    }
  };

  const photos = user?.photos || [];
  const avatarUrl = photos.length > 0 ? photos[0] : user?.profilePicUrl || 'https://via.placeholder.com/150';
  const userLikes = user?.likes || [];
  const userHobbies = user?.hobbies || [];

  if (loading) {
    return <View style={[styles.loadingContainer, { paddingTop: height * 0.2 }]}><ActivityIndicator size="large" color="#FF2D55" /></View>;
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      {feedback.message ? (
        <View style={[styles.feedbackBanner, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={[styles.feedbackText, feedback.type === 'error' ? styles.feedbackTextError : styles.feedbackTextSuccess]}>{feedback.message}</Text>
        </View>
      ) : null}
      {pendingPhotoRemove !== null && (
        <View style={styles.confirmBanner}>
          <Text style={styles.confirmText}>Remove this photo?</Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.confirmBtnCancel} onPress={() => setPendingPhotoRemove(null)}>
              <Text style={styles.confirmBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtnRemove} onPress={confirmRemovePhoto}>
              <Text style={styles.confirmBtnRemoveText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={styles.profileHeader}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            {photos.map((url, idx) => (
              <TouchableOpacity key={idx} onLongPress={() => handleRemovePhoto(url)}>
                <Image source={{ uri: url }} style={[styles.thumbPhoto, idx === 0 && styles.thumbPhotoActive]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View style={styles.photoAddRow}>
          {uploading ? (
            <ActivityIndicator size="small" color="#FF2D55" />
          ) : (
            <TouchableOpacity style={styles.photoAddBtn} onPress={handlePickPhoto}>
              <MaterialIcons name="add-a-photo" size={20} color="#fff" />
              <Text style={styles.photoAddBtnText}>Add Photo</Text>
            </TouchableOpacity>
          )}
          {(user?.photos?.length || 0) > 0 && (
            <Text style={styles.photoHint}>Long-press a photo to remove</Text>
          )}
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user?.name}</Text>
          {user && <TierBadge tier={user.tier} />}
        </View>
        <View style={styles.infoRow}><MaterialIcons name="location-on" size={16} color="#8e8e93" /><Text style={styles.infoText}>{user?.county?.name || 'Unknown'}</Text></View>
        {user?.age && <View style={styles.infoRow}><MaterialIcons name="cake" size={16} color="#8e8e93" /><Text style={styles.infoText}>{user.age} years young</Text></View>}
        {user?.occupation && <View style={styles.infoRow}><MaterialIcons name="work" size={16} color="#8e8e93" /><Text style={styles.infoText}>{user.occupation}</Text></View>}
        {user?.interestedIn && <View style={styles.infoRow}><MaterialIcons name="favorite" size={16} color="#FF2D55" /><Text style={styles.infoText}>Interested in {user.interestedIn === 'both' ? 'Everyone' : user.interestedIn === 'male' ? 'Men' : 'Women'}</Text></View>}
        {userLikes.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Likes ❤️</Text>
            <View style={styles.tagsRow}>
              {userLikes.map(l => <View key={l} style={styles.likeTag}><Text style={styles.likeTagText}>{l}</Text></View>)}
            </View>
          </View>
        )}
        {userHobbies.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Hobbies ⭐</Text>
            <View style={styles.tagsRow}>
              {userHobbies.map(h => <View key={h} style={styles.hobbyTag}><Text style={styles.hobbyTagText}>{h}</Text></View>)}
            </View>
          </View>
        )}
        {!user?.isVerified && (
          <View style={styles.unverifiedBadge}>
            <MaterialIcons name="warning" size={16} color="#FF9500" />
            <Text style={styles.unverifiedText}>Phone not verified</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Edit Your Spark</Text>
        <Text style={styles.label}>Name</Text>
        <View style={styles.inputWrapper}><MaterialIcons name="person" size={18} color="#FF2D55" style={styles.inputIcon} /><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#c7c7cc" /></View>
        <Text style={styles.label}>Age</Text>
        <View style={styles.inputWrapper}><MaterialIcons name="cake" size={18} color="#FF2D55" style={styles.inputIcon} /><TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} placeholder="25" placeholderTextColor="#c7c7cc" /></View>
        <Text style={styles.label}>Occupation</Text>
        <View style={styles.inputWrapper}><MaterialIcons name="work" size={18} color="#FF2D55" style={styles.inputIcon} /><TextInput style={styles.input} value={occupation} onChangeText={setOccupation} placeholder="Software Engineer" placeholderTextColor="#c7c7cc" /></View>
        <Text style={styles.label}>Interested In</Text>
        <View style={styles.chipsRow}>
          {['male', 'female', 'both'].map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.chip, interestedIn === val && styles.chipActive]}
              onPress={() => setInterestedIn(val)}
            >
              <Text style={[styles.chipText, interestedIn === val && styles.chipTextActive]}>
                {val === 'male' ? 'Men' : val === 'female' ? 'Women' : 'Everyone'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Likes ❤️</Text>
        <View style={styles.chipsRow}>
          {LIKES_OPTIONS.map(l => (
            <TouchableOpacity
              key={l}
              style={[styles.chip, likes.includes(l) && styles.chipActive]}
              onPress={() => setLikes(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])}
            >
              <Text style={[styles.chipText, likes.includes(l) && styles.chipTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Hobbies ⭐</Text>
        <View style={styles.chipsRow}>
          {HOBBIES_OPTIONS.map(h => (
            <TouchableOpacity
              key={h}
              style={[styles.chip, hobbies.includes(h) && styles.chipHobbyActive]}
              onPress={() => setHobbies(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h])}
            >
              <Text style={[styles.chipText, hobbies.includes(h) && styles.chipTextHobbyActive]}>{h}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Bio</Text>
        <View style={styles.inputWrapper}><MaterialIcons name="edit" size={18} color="#FF2D55" style={styles.inputIcon} /><TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} multiline maxLength={500} placeholder="Tell the world about you..." placeholderTextColor="#c7c7cc" /></View>
        <Text style={styles.charCount}>{bio.length}/500</Text>
        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <View style={styles.buttonInner}><MaterialIcons name="check" size={20} color="#fff" /><Text style={styles.saveButtonText}>Save My Spark</Text></View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {user?.tier === 'PREMIUM' ? (
          <View style={styles.menuItem}>
            <MaterialIcons name="stars" size={22} color="#FF9500" />
            <Text style={[styles.menuText, styles.premiumText]}>Premium Active</Text>
            <MaterialIcons name="check-circle" size={22} color="#34C759" />
          </View>
        ) : (
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Payment')}>
            <MaterialIcons name="stars" size={22} color="#5856D6" />
            <Text style={styles.menuText}>Go Premium</Text>
            <MaterialIcons name="chevron-right" size={22} color="#8e8e93" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Safety')}>
          <MaterialIcons name="security" size={22} color="#34C759" />
          <Text style={styles.menuText}>Safety Tips</Text>
          <MaterialIcons name="chevron-right" size={22} color="#8e8e93" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
          <MaterialIcons name="delete-forever" size={22} color="#FF3B30" />
          <Text style={[styles.menuText, styles.deleteText]}>Delete Account</Text>
        </TouchableOpacity>
        {showDeleteConfirm && (
          <View style={styles.deleteConfirmBox}>
            <Text style={styles.deleteConfirmText}>Are you sure you want to delete your account? This cannot be undone.</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmBtnCancel} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.confirmBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtnDelete} onPress={confirmDeleteAccount}>
                <Text style={styles.confirmBtnDeleteText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

ProfileScreen.propTypes = {
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  loadingContainer: { alignItems: 'center' },
  profileHeader: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0d0d8' },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  photoStrip: { flexGrow: 0, marginBottom: 8, maxHeight: 66 },
  thumbPhoto: { width: 60, height: 60, borderRadius: 8, marginHorizontal: 3, backgroundColor: '#f0f0f0' },
  thumbPhotoActive: { borderWidth: 2, borderColor: '#FF2D55' },
  photoAddRow: { flexDirection: 'column', alignItems: 'center', marginBottom: 10, gap: 6, paddingHorizontal: 20 },
  photoAddBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF2D55', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 6 },
  photoAddBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  photoHint: { fontSize: 11, color: '#8e8e93' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1c1c1e' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  infoText: { fontSize: 14, color: '#8e8e93' },
  tagsSection: { marginTop: 10, alignItems: 'center' },
  tagsLabel: { fontSize: 12, fontWeight: '600', color: '#8e8e93', marginBottom: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  likeTag: { backgroundColor: '#FFF0F3', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  likeTagText: { fontSize: 12, color: '#FF2D55', fontWeight: '500' },
  hobbyTag: { backgroundColor: '#F5F3FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  hobbyTagText: { fontSize: 12, color: '#5856D6', fontWeight: '500' },
  unverifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginTop: 10, gap: 6 },
  unverifiedText: { color: '#FF9500', fontSize: 13, fontWeight: '600' },
  section: { backgroundColor: '#fff', marginTop: 15, paddingHorizontal: 20, paddingVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FF2D55', marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#3a3a3c', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 10, backgroundColor: '#FFFAFB', paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1c1c1e' },
  bioInput: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { textAlign: 'right', color: '#8e8e93', fontSize: 12, marginTop: 4 },
  saveButton: { backgroundColor: '#FF2D55', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12 },
  menuText: { flex: 1, fontSize: 16, color: '#1c1c1e' },
  premiumText: { color: '#FF9500' },
  deleteText: { color: '#FF3B30' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#FFFAFB',
  },
  chipActive: { borderColor: '#FF2D55', backgroundColor: '#FFF0F3' },
  chipHobbyActive: { borderColor: '#5856D6', backgroundColor: '#F5F3FF' },
  chipText: { fontSize: 13, color: '#8e8e93' },
  chipTextActive: { color: '#FF2D55', fontWeight: '600' },
  chipTextHobbyActive: { color: '#5856D6', fontWeight: '600' },
  feedbackBanner: { paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 15, marginTop: 10, borderRadius: 10 },
  feedbackSuccess: { backgroundColor: '#E8F5E9' },
  feedbackError: { backgroundColor: '#FFEBEE' },
  feedbackText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  feedbackTextSuccess: { color: '#2E7D32' },
  feedbackTextError: { color: '#C62828' },
  confirmBanner: { backgroundColor: '#FFF3E0', marginHorizontal: 15, marginTop: 10, padding: 14, borderRadius: 10, alignItems: 'center' },
  confirmText: { fontSize: 14, fontWeight: '600', color: '#3a3a3c', marginBottom: 10 },
  confirmButtons: { flexDirection: 'row', gap: 10 },
  confirmBtnCancel: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  confirmBtnCancelText: { fontSize: 14, fontWeight: '500', color: '#3a3a3c' },
  confirmBtnRemove: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FF3B30' },
  confirmBtnRemoveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  deleteConfirmBox: { backgroundColor: '#FFF5F5', padding: 14, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#FFD0D0' },
  deleteConfirmText: { fontSize: 14, color: '#3a3a3c', marginBottom: 10, lineHeight: 20 },
  confirmBtnDelete: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FF3B30' },
  confirmBtnDeleteText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
