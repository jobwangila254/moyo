import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Image, useWindowDimensions, Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import TierBadge from '../components/TierBadge';
import { auth, users, uploadApi, clearAuthToken } from '../services/api';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [age, setAge] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
      const payload = { name, bio, occupation, interestedIn };
      if (age) {payload.age = parseInt(age, 10);}
      await users.updateProfile(payload);
      Alert.alert('Updated', "Your heart's profile has been updated 💕");
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'We need camera roll access to add photos');
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
      Alert.alert('Error', error.response?.data?.error || 'Failed to upload photo');
    } finally { setUploading(false); }
  };

  const handleRemovePhoto = (url) => {
    Alert.alert('Remove Photo?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await uploadApi.deletePhoto(url);
            const currentPhotos = user?.photos || [];
            const filtered = currentPhotos.filter(p => p !== url);
            setUser(prev => ({ ...prev, photos: filtered, profilePicUrl: prev.profilePicUrl === url ? (filtered[0] || null) : prev.profilePicUrl }));
          } catch (error) {
            Alert.alert('Error', 'Failed to remove photo');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Leave Us?', 'This breaks our heart. Are you sure?', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          try {
            await users.deleteAccount();
            await clearAuthToken();
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          } catch (error) { Alert.alert('Error', 'Failed to delete account'); }
        },
      },
    ]);
  };

  const photos = user?.photos || [];
  const avatarUrl = photos.length > 0 ? photos[0] : user?.profilePicUrl || 'https://via.placeholder.com/150';
  const likes = user?.likes || [];
  const hobbies = user?.hobbies || [];

  if (loading) {
    return <View style={[styles.loadingContainer, { paddingTop: height * 0.2 }]}><ActivityIndicator size="large" color="#FF2D55" /></View>;
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
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
        {likes.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Likes ❤️</Text>
            <View style={styles.tagsRow}>
              {likes.map(l => <View key={l} style={styles.likeTag}><Text style={styles.likeTagText}>{l}</Text></View>)}
            </View>
          </View>
        )}
        {hobbies.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>Hobbies ⭐</Text>
            <View style={styles.tagsRow}>
              {hobbies.map(h => <View key={h} style={styles.hobbyTag}><Text style={styles.hobbyTagText}>{h}</Text></View>)}
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
  chipText: { fontSize: 13, color: '#8e8e93' },
  chipTextActive: { color: '#FF2D55', fontWeight: '600' },
});
