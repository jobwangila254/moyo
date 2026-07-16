import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Image, Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { users, uploadApi } from '../services/api';

const LIKES_OPTIONS = ['Music', 'Travel', 'Food', 'Fitness', 'Movies', 'Reading', 'Art', 'Fashion', 'Tech', 'Nature', 'Photography', 'Dancing', 'Animals', 'Coffee'];
const HOBBIES_OPTIONS = ['Hiking', 'Cooking', 'Gaming', 'Sports', 'Yoga', 'Painting', 'Writing', 'Gardening', 'Cycling', 'Swimming', 'Running', 'Singing', 'Dancing', 'Camping'];
const TOTAL_STEPS = 4;

export default function OnboardingSetupScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [bio, setBio] = useState('');
  const [likes, setLikes] = useState([]);
  const [hobbies, setHobbies] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!feedback.message) return;
    const timer = setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [feedback.message]);

  const toggleLike = (item) => {
    setLikes(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  };

  const toggleHobby = (item) => {
    setHobbies(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  };

  const handleAddPhoto = async () => {
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

    if (result.canceled) return;

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
      const url = res.data.data.url || (res.data.data.photos && res.data.data.photos[0]);
      if (url) setPhotos(prev => [...prev, url]);
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || 'Failed to upload photo' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await users.updateProfile({ bio, likes, hobbies, photos });
      await users.completeOnboarding();
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || 'Failed to save profile' });
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return photos.length > 0;
    if (step === 2) return bio.trim().length > 0;
    if (step === 3) return likes.length > 0 || hobbies.length > 0;
    return true;
  };

  const renderProgress = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View key={i} style={styles.progressDotWrapper}>
          <View style={[styles.progressDot, i + 1 <= step && styles.progressDotActive]} />
          {i < TOTAL_STEPS - 1 && <View style={[styles.progressLine, i + 1 < step && styles.progressLineActive]} />}
        </View>
      ))}
    </View>
  );

  const renderStepPhotos = () => (
    <View style={styles.stepContent}>
      <MaterialIcons name="add-a-photo" size={48} color="#FF2D55" style={styles.stepIcon} />
      <Text style={styles.stepTitle}>Add Your Photos</Text>
      <Text style={styles.stepSubtitle}>Upload at least 1 photo so others can see you</Text>
      <View style={styles.photoGrid}>
        {photos.map((url, i) => (
          <View key={i} style={styles.photoThumb}>
            <Image source={{ uri: url }} style={styles.photoImage} resizeMode="cover" />
            <TouchableOpacity style={styles.photoRemove} onPress={() => handleRemovePhoto(i)}>
              <MaterialIcons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < 3 && (
          <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhoto} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FF2D55" />
            ) : (
              <MaterialIcons name="add" size={32} color="#FF2D55" />
            )}
          </TouchableOpacity>
        )}
      </View>
      {photos.length > 0 && (
        <Text style={styles.photoHint}>{photos.length}/3 photos added</Text>
      )}
    </View>
  );

  const renderStepBio = () => (
    <View style={styles.stepContent}>
      <MaterialIcons name="edit" size={48} color="#FF2D55" style={styles.stepIcon} />
      <Text style={styles.stepTitle}>Write Your Bio</Text>
      <Text style={styles.stepSubtitle}>Tell others what makes you unique</Text>
      <TextInput
        style={styles.bioInput}
        value={bio}
        onChangeText={(t) => { if (t.length <= 300) setBio(t); }}
        multiline
        placeholder="Tell the world about you..."
        placeholderTextColor="#c7c7cc"
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{bio.length}/300</Text>
    </View>
  );

  const renderStepInterests = () => (
    <View style={styles.stepContent}>
      <MaterialIcons name="favorite" size={48} color="#FF2D55" style={styles.stepIcon} />
      <Text style={styles.stepTitle}>Select Your Interests</Text>
      <Text style={styles.stepSubtitle}>Pick things you enjoy</Text>
      <Text style={styles.chipSectionLabel}>Likes</Text>
      <View style={styles.chipsRow}>
        {LIKES_OPTIONS.map(item => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, likes.includes(item) && styles.chipActive]}
            onPress={() => toggleLike(item)}
          >
            <Text style={[styles.chipText, likes.includes(item) && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.chipSectionLabel}>Hobbies</Text>
      <View style={styles.chipsRow}>
        {HOBBIES_OPTIONS.map(item => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, hobbies.includes(item) && styles.chipHobbyActive]}
            onPress={() => toggleHobby(item)}
          >
            <Text style={[styles.chipText, hobbies.includes(item) && styles.chipTextHobbyActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStepComplete = () => (
    <View style={styles.stepContent}>
      <MaterialIcons name="check-circle" size={64} color="#34C759" style={styles.stepIcon} />
      <Text style={styles.stepTitle}>You're All Set!</Text>
      <Text style={styles.stepSubtitle}>Here's a summary of your profile</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <MaterialIcons name="photo" size={20} color="#FF2D55" />
          <Text style={styles.summaryText}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.summaryRow}>
          <MaterialIcons name="edit" size={20} color="#FF2D55" />
          <Text style={styles.summaryText} numberOfLines={2}>{bio || 'No bio yet'}</Text>
        </View>
        {likes.length > 0 && (
          <View style={styles.summaryRow}>
            <MaterialIcons name="favorite" size={20} color="#FF2D55" />
            <Text style={styles.summaryText}>{likes.join(', ')}</Text>
          </View>
        )}
        {hobbies.length > 0 && (
          <View style={styles.summaryRow}>
            <MaterialIcons name="star" size={20} color="#5856D6" />
            <Text style={styles.summaryText}>{hobbies.join(', ')}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStepPhotos();
      case 2: return renderStepBio();
      case 3: return renderStepInterests();
      case 4: return renderStepComplete();
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {feedback.message ? (
        <View style={[styles.feedbackBanner, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={[styles.feedbackText, feedback.type === 'error' ? styles.feedbackTextError : styles.feedbackTextSuccess]}>{feedback.message}</Text>
        </View>
      ) : null}
      {renderProgress()}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {renderCurrentStep()}
      </ScrollView>
      <View style={[styles.buttonRow, { paddingBottom: insets.bottom + 10 }]}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(step - 1)}>
            <MaterialIcons name="arrow-back" size={20} color="#FF2D55" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled, step === 1 && styles.nextButtonFull]}
          onPress={() => {
            if (step < TOTAL_STEPS) setStep(step + 1);
            else handleComplete();
          }}
          disabled={!canProceed() || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonInner}>
              <Text style={styles.nextButtonText}>{step === TOTAL_STEPS ? 'Start Exploring' : 'Next'}</Text>
              <MaterialIcons name={step === TOTAL_STEPS ? 'favorite' : 'arrow-forward'} size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

OnboardingSetupScreen.propTypes = {
  navigation: PropTypes.object,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 20 },
  progressContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingVertical: 20, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0d0d8',
  },
  progressDotWrapper: { flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f0d0d8' },
  progressDotActive: { backgroundColor: '#FF2D55' },
  progressLine: { width: 30, height: 2, backgroundColor: '#f0d0d8', marginHorizontal: 4 },
  progressLineActive: { backgroundColor: '#FF2D55' },
  stepContent: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 30 },
  stepIcon: { marginBottom: 16 },
  stepTitle: { fontSize: 24, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#8e8e93', textAlign: 'center', marginBottom: 24 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  photoThumb: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  addPhotoButton: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderColor: '#f0d0d8', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFAFB' },
  photoHint: { fontSize: 13, color: '#8e8e93', marginTop: 12 },
  bioInput: {
    width: '100%', height: 120, borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 12,
    backgroundColor: '#FFFAFB', paddingHorizontal: 16, paddingTop: 14, fontSize: 16,
    color: '#1c1c1e', textAlignVertical: 'top',
  },
  charCount: { alignSelf: 'flex-end', color: '#8e8e93', fontSize: 12, marginTop: 6 },
  chipSectionLabel: {
    alignSelf: 'flex-start', fontSize: 13, fontWeight: '600', color: '#3a3a3c',
    marginTop: 8, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  chip: {
    borderWidth: 1, borderColor: '#f0d0d8', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#FFFAFB',
  },
  chipActive: { borderColor: '#FF2D55', backgroundColor: '#FFF0F3' },
  chipHobbyActive: { borderColor: '#5856D6', backgroundColor: '#F5F3FF' },
  chipText: { fontSize: 13, color: '#8e8e93' },
  chipTextActive: { color: '#FF2D55', fontWeight: '600' },
  chipTextHobbyActive: { color: '#5856D6', fontWeight: '600' },
  summaryCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16,
    gap: 12, borderWidth: 1, borderColor: '#f0d0d8',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { flex: 1, fontSize: 14, color: '#1c1c1e' },
  buttonRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingTop: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0d0d8',
    gap: 10,
  },
  backButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: '#FF2D55', backgroundColor: '#fff', gap: 6,
  },
  backButtonText: { color: '#FF2D55', fontSize: 16, fontWeight: '600' },
  nextButton: {
    flex: 1, backgroundColor: '#FF2D55', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
  },
  nextButtonFull: { flex: undefined, width: '100%' },
  nextButtonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  feedbackBanner: { paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 15, marginTop: 10, borderRadius: 10 },
  feedbackSuccess: { backgroundColor: '#E8F5E9' },
  feedbackError: { backgroundColor: '#FFEBEE' },
  feedbackText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  feedbackTextSuccess: { color: '#2E7D32' },
  feedbackTextError: { color: '#C62828' },
});
