import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const HeartParticle = ({ delay, left, size }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H * 0.6, -100] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.8, 0.4, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.2, 0.8] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: left,
        top: 0,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
    >
      <MaterialIcons name="favorite" size={size} color="rgba(255,45,85,0.3)" />
    </Animated.View>
  );
};

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.spring(pulseAnim, { toValue: 1.15, tension: 100, friction: 3, useNativeDriver: true }),
        Animated.spring(pulseAnim, { toValue: 1, tension: 100, friction: 3, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const hearts = [
    { delay: 0, left: '10%', size: 18 },
    { delay: 800, left: '30%', size: 14 },
    { delay: 1600, left: '55%', size: 22 },
    { delay: 400, left: '75%', size: 16 },
    { delay: 1200, left: '20%', size: 12 },
    { delay: 2000, left: '65%', size: 20 },
    { delay: 600, left: '45%', size: 15 },
    { delay: 2400, left: '85%', size: 13 },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
    >
      {hearts.map((h, i) => (
        <HeartParticle key={i} delay={h.delay} left={h.left} size={h.size} />
      ))}

      <Animated.View style={[styles.header, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialIcons name="favorite" size={80} color="#FF2D55" />
        </Animated.View>
        <Text style={styles.title}>Moyo</Text>
        <Text style={styles.subtitle}>Love is just a swipe away ❤️</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeIn }}>
        <View style={styles.features}>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MaterialIcons name="phone-android" size={22} color="#34C759" />
            </View>
            <Text style={styles.featureText}>Verify with your Safaricom number</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MaterialIcons name="location-on" size={22} color="#007AFF" />
            </View>
            <Text style={styles.featureText}>Meet people in your county</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MaterialIcons name="chat" size={22} color="#FF9500" />
            </View>
            <Text style={styles.featureText}>5 free messages to start the conversation</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MaterialIcons name="stars" size={22} color="#5856D6" />
            </View>
            <Text style={styles.featureText}>Go Premium and find love anywhere in Kenya</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.buttons, { paddingHorizontal: width * 0.06, opacity: fadeIn }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.primaryButtonText}>Find Love 💕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.secondaryButtonText}>I already have a spark</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFF5F7' },
  container: { alignItems: 'center', paddingHorizontal: 30, minHeight: SCREEN_H },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  title: { fontSize: 42, fontWeight: 'bold', color: '#FF2D55', marginTop: 16, letterSpacing: 2 },
  subtitle: { fontSize: 16, color: '#8e8e93', textAlign: 'center', marginTop: 10, lineHeight: 22, paddingHorizontal: 10 },
  features: { marginBottom: 30 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, paddingHorizontal: 10 },
  featureIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0F3', justifyContent: 'center', alignItems: 'center' },
  featureText: { fontSize: 15, color: '#3a3a3c', marginLeft: 12, flexShrink: 1 },
  buttons: { width: '100%', gap: 12 },
  primaryButton: { backgroundColor: '#FF2D55', padding: 16, borderRadius: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  secondaryButton: { padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FF2D55' },
  secondaryButtonText: { color: '#FF2D55', fontSize: 16, fontWeight: '600' },
});
