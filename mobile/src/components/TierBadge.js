import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { MaterialIcons } from '@expo/vector-icons';

const TIER_CONFIG = {
  FREE: {
    label: 'Free',
    icon: 'person',
    color: '#8e8e93',
    bgColor: '#f0f0f0',
  },
  PREMIUM: {
    label: 'Premium',
    icon: 'star',
    color: '#fff',
    bgColor: '#FF9500',
  },
};

const TierBadge = ({ tier, size = 'small' }) => {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.FREE;
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bgColor },
        isSmall ? styles.smallBadge : styles.largeBadge,
      ]}
      accessibilityLabel={`${config.label} account`}
      accessibilityRole="text"
    >
      <MaterialIcons
        name={config.icon}
        size={isSmall ? 12 : 16}
        color={config.color}
      />
      <Text style={[
        styles.label,
        { color: config.color },
        isSmall ? styles.smallLabel : styles.largeLabel,
      ]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 4,
  },
  smallBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  largeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {
    fontWeight: 'bold',
  },
  smallLabel: {
    fontSize: 11,
  },
  largeLabel: {
    fontSize: 14,
  },
});

TierBadge.propTypes = {
  tier: PropTypes.string,
  size: PropTypes.string,
};

export default TierBadge;
