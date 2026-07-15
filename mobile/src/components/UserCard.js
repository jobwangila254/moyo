import { useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Animated, PanResponder, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import { MaterialIcons } from '@expo/vector-icons';

const LIKES_ICONS = {
  Music: 'music-note', Travel: 'flight', Food: 'restaurant', Fitness: 'fitness-center',
  Movies: 'movie', Reading: 'library-books', Art: 'palette', Fashion: 'style',
  Tech: 'computer', Nature: 'nature', Photography: 'photo-camera', Dancing: 'accessibility',
  Animals: 'pets', Coffee: 'local-cafe',
};

const UserCard = ({ user, onSwipe, onPress, cardHeight, tier }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      tension: 50,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [user.id, entrance]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([
      null,
      { dx: pan.x, dy: pan.y },
    ], { useNativeDriver: true }),
    onPanResponderRelease: (e, gestureState) => {
      if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
        onPress && onPress(user);
        return;
      }
      if (gestureState.dx > 120) {
        triggerSwipe('like');
      } else if (gestureState.dx < -120) {
        triggerSwipe('pass');
      } else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      }
    },
  });

  const triggerSwipe = (direction) => {
    Animated.spring(pan, {
      toValue: { x: direction === 'like' ? 500 : -500, y: 0 },
      useNativeDriver: true,
    }).start();
    setTimeout(() => onSwipe(direction, user.id), 200);
  };

  const rotate = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-30deg', '0deg', '30deg'],
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
  });

  const passOpacity = pan.x.interpolate({
    inputRange: [-100, 0],
    outputRange: [1, 0],
  });

  const photos = user.photos || [];
  const photoUrl = photos.length > 0
    ? photos[0]
    : user.profilePicUrl || 'https://via.placeholder.com/400';

  const likes = user.likes || [];
  const hobbies = user.hobbies || [];

  const cardOpacity = entrance;

  return (
    <View style={styles.container}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          { height: cardHeight || 520 },
          { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }], opacity: cardOpacity },
        ]}
        accessibilityLabel={`${user.name || 'User'}, ${user.age || ''} years old from ${user.county?.name || 'unknown location'}`}
        accessibilityRole="adjustable"
        accessibilityActions={[
          { name: 'activate', label: 'View profile details' },
          { name: 'magicTap', label: 'Like profile' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'magicTap') {
            onSwipe('like', user.id);
          }
        }}
      >
        <Image
          source={{ uri: photoUrl }}
          style={styles.image}
          accessibilityLabel={`Photo of ${user.name || 'user'}`}
          accessibilityRole="image"
        />
        <View style={styles.overlay}>
          <Animated.View style={[styles.likeOverlay, { opacity: likeOpacity }]}>
            <Text style={styles.likeText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.passOverlay, { opacity: passOpacity }]}>
            <Text style={styles.passText}>NOPE</Text>
          </Animated.View>
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}</Text>
            {user.age && <Text style={styles.age}>, {user.age}</Text>}
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="location-on" size={14} color="#8e8e93" />
            <Text style={styles.detailText}>{user.county?.name || 'Unknown'}</Text>
          </View>
          {user.occupation && (
            <View style={styles.detailRow}>
              <MaterialIcons name="work" size={14} color="#8e8e93" />
              <Text style={styles.detailText}>{user.occupation}</Text>
            </View>
          )}
          {likes.length > 0 && (
            <View style={styles.tagsRow}>
              {likes.slice(0, 4).map(l => (
                <View key={l} style={[styles.tag, styles.likeTag]}>
                  <MaterialIcons name={LIKES_ICONS[l] || 'favorite'} size={12} color="#FF2D55" />
                  <Text style={styles.likeTagText}>{l}</Text>
                </View>
              ))}
            </View>
          )}
          {hobbies.length > 0 && (
            <View style={styles.tagsRow}>
              {hobbies.slice(0, 4).map(h => (
                <View key={h} style={[styles.tag, styles.hobbyTag]}>
                  <MaterialIcons name="stars" size={12} color="#5856D6" />
                  <Text style={styles.hobbyTagText}>{h}</Text>
                </View>
              ))}
            </View>
          )}
          {user.bio && <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => triggerSwipe('pass')}
            accessibilityLabel="Pass on this profile"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={36} color="#FF3B30" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.superlikeButton}
            onPress={() => triggerSwipe('superlike')}
            accessibilityLabel="Super like this profile"
            accessibilityRole="button"
          >
            <MaterialIcons name="star" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => triggerSwipe('like')}
            accessibilityLabel="Like this profile"
            accessibilityRole="button"
          >
            <MaterialIcons name="favorite" size={36} color="#34C759" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '90%', backgroundColor: 'white', borderRadius: 20,
    boxShadow: '0 10px 20px 0 rgba(0,0,0,0.1)', elevation: 5,
    alignSelf: 'center', marginVertical: 10,
  },
  image: { width: '100%', height: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, height: '60%' },
  likeOverlay: {
    position: 'absolute', top: 30, left: 20, borderWidth: 4,
    borderColor: '#34C759', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    transform: [{ rotate: '-15deg' }],
  },
  passOverlay: {
    position: 'absolute', top: 30, right: 20, borderWidth: 4,
    borderColor: '#FF3B30', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    transform: [{ rotate: '15deg' }],
  },
  likeText: { fontSize: 28, fontWeight: 'bold', color: '#34C759' },
  passText: { fontSize: 28, fontWeight: 'bold', color: '#FF3B30' },
  infoContainer: { padding: 16, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1c1c1e' },
  age: { fontSize: 20, color: '#8e8e93' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  detailText: { fontSize: 14, color: '#8e8e93' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
  likeTag: { backgroundColor: '#FFF0F3' },
  hobbyTag: { backgroundColor: '#F5F3FF' },
  likeTagText: { fontSize: 11, color: '#FF2D55', fontWeight: '500' },
  hobbyTagText: { fontSize: 11, color: '#5856D6', fontWeight: '500' },
  bio: { marginTop: 8, fontSize: 13, lineHeight: 18, color: '#3a3a3c' },
  actions: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eee',
  },
  actionButton: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#f5f5f7',
    justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 2px 4px 0 rgba(0,0,0,0.1)', elevation: 3,
  },
  superlikeButton: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF9500',
    justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 4px 8px 0 rgba(255,149,0,0.4)', elevation: 5,
  },
});

UserCard.propTypes = {
  user: PropTypes.object,
  onSwipe: PropTypes.func,
  onPress: PropTypes.func,
  cardHeight: PropTypes.number,
  tier: PropTypes.string,
};

export default UserCard;
