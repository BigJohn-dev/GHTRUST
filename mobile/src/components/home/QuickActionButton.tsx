import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { colors, radius, shadow, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Small dot on the icon when something here needs the customer's attention. */
  attention?: boolean;
};

/** One tile of the Quick actions grid: icon in a soft circle, label underneath. */
export const QuickActionButton = memo(function QuickActionButton({ icon, label, onPress, attention }: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={attention ? `${label}, needs attention` : label}
      onPress={onPress}
      style={styles.tile}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={colors.navy} />
        {attention ? <View style={styles.dot} /> : null}
      </View>
      <Text variant="small" align="center" numberOfLines={2} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 100,
    backgroundColor: colors.card,
    borderRadius: radius.md + 2,
    paddingVertical: space.md,
    paddingHorizontal: space.xxs,
    alignItems: 'center',
    gap: space.xs,
    ...shadow,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceNav,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.card,
  },
  label: { fontSize: 12, lineHeight: 16, color: colors.text },
});
