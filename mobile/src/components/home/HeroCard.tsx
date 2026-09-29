import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Loan, Wallet } from '@/api/types';
import { productName } from '@/components/loans';
import { Skeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { naira, relativeDue } from '@/lib/format';
import { colors, font, radius, space } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

const MUTED = 'rgba(255,255,255,0.72)';
const FAINT = 'rgba(255,255,255,0.14)';
const ALERT = '#FFB3B3';

type View_ = 'loan' | 'wallet';

type Props = {
  /** The loan with the soonest repayment, if any is open. */
  loan?: Loan;
  openLoans: number;
  /** Undefined while the wallet loads, or when the wallet feature is off. */
  wallet?: Wallet;
  walletEnabled: boolean;
};

/**
 * The navy card at the top of Home. With an open loan it tracks the next repayment;
 * with the wallet on it can switch to the wallet balance; otherwise it invites the
 * customer to apply.
 */
export const HeroCard = memo(function HeroCard({ loan, openLoans, wallet, walletEnabled }: Props) {
  const [view, setView] = useState<View_>('loan');
  const canSwitch = !!loan && walletEnabled;
  const showing: View_ | 'promo' = loan ? (canSwitch ? view : 'loan') : 'promo';

  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={[styles.glow, styles.glowTop]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowBottom]} />

      {canSwitch ? <Switcher value={view} onChange={setView} /> : null}

      <Animated.View key={showing} entering={FadeIn.duration(220)}>
        {showing === 'loan' && loan ? (
          <LoanView loan={loan} openLoans={openLoans} walletEnabled={walletEnabled} />
        ) : null}
        {showing === 'wallet' ? <WalletView wallet={wallet} /> : null}
        {showing === 'promo' ? (
          <PromoView wallet={walletEnabled ? wallet : undefined} walletEnabled={walletEnabled} />
        ) : null}
      </Animated.View>
    </View>
  );
});

function PromoView({ wallet, walletEnabled }: { wallet?: Wallet; walletEnabled: boolean }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" color={colors.cyan}>
        GH TRUST LOANS
      </Text>
      <Text variant="title" color={colors.white}>
        Get the funds your plans need
      </Text>
      <Text variant="small" color={MUTED}>
        Business, payday, study and asset loans. Apply in minutes and track every step here.
      </Text>
      <HeroButton title="Start an application" icon="arrow-forward" href="/apply" />
      {walletEnabled ? (
        <>
          <View style={styles.divider} />
          <View style={styles.between}>
            <View>
              <Text variant="small" color={MUTED}>
                Wallet balance
              </Text>
              <Balance value={wallet?.available_balance} size="heading" />
            </View>
            <HeroButton title="Add money" icon="add" href="/fund" compact />
          </View>
        </>
      ) : null}
    </View>
  );
}

function LoanView({ loan, openLoans, walletEnabled }: { loan: Loan; openLoans: number; walletEnabled: boolean }) {
  const overdue = loan.status === 'overdue';
  const total = Number(loan.total_repayable) || 0;
  const paid = Number(loan.amount_paid) || 0;
  const progress = total > 0 ? Math.min(1, paid / total) : 0;
  return (
    <View>
      <View style={styles.between}>
        <Text variant="caption" color={overdue ? ALERT : colors.cyan}>
          {overdue ? 'PAYMENT OVERDUE' : 'NEXT REPAYMENT'}
        </Text>
        <Text variant="small" color={MUTED} numberOfLines={1}>
          {productName(loan.product_type)}
          {openLoans > 1 ? ` · +${openLoans - 1} more` : ''}
        </Text>
      </View>
      <Text variant="display" color={colors.white} style={{ marginTop: space.xs }}>
        {naira(loan.monthly_payment)}
      </Text>
      <Text variant="small" color={overdue ? ALERT : MUTED}>
        {loan.next_due_date ? relativeDue(loan.next_due_date) : 'No payment scheduled'}
      </Text>

      <View style={{ marginTop: space.lg, gap: space.xs }}>
        <ProgressTrack value={progress} />
        <View style={styles.between}>
          <Text variant="small" color={MUTED}>
            {naira(loan.amount_paid)} repaid
          </Text>
          <Text variant="small" color={MUTED}>
            {naira(loan.outstanding)} left
          </Text>
        </View>
      </View>

      <View style={[styles.between, { marginTop: space.lg }]}>
        <HeroButton title="View loan" icon="document-text-outline" href={`/loans/${loan.id}`} compact ghost />
        <HeroButton
          title={walletEnabled ? 'Repay now' : 'How to pay'}
          icon={walletEnabled ? 'flash' : 'arrow-forward'}
          href={walletEnabled ? `/repay/${loan.id}` : `/loans/${loan.id}`}
          compact
        />
      </View>
    </View>
  );
}

function WalletView({ wallet }: { wallet?: Wallet }) {
  return (
    <View>
      <Text variant="caption" color={colors.cyan}>
        WALLET BALANCE
      </Text>
      <View style={{ marginTop: space.xs }}>
        <Balance value={wallet?.available_balance} size="display" />
      </View>
      <Text variant="small" color={MUTED}>
        {wallet?.dva_account_number
          ? `${wallet.dva_bank_name ?? 'Account'} · ${wallet.dva_account_number}`
          : 'Add money by bank transfer or card'}
      </Text>
      <View style={[styles.between, { marginTop: space.lg }]}>
        <HeroButton title="Wallet" icon="wallet-outline" href="/wallet" compact ghost />
        <HeroButton title="Add money" icon="add" href="/fund" compact />
      </View>
    </View>
  );
}

/** Amount with a show/hide eye, for when someone is looking over the customer's shoulder. */
function Balance({ value, size }: { value?: number | string; size: 'display' | 'heading' }) {
  const [hidden, setHidden] = useState(false);
  if (value === undefined)
    return <Skeleton height={size === 'display' ? 34 : 20} width={140} style={styles.skeleton} />;
  return (
    <View style={styles.balanceRow}>
      <Text variant={size} color={colors.white} numberOfLines={1} style={{ flexShrink: 1 }}>
        {hidden ? '₦ • • • • •' : naira(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
        hitSlop={12}
        onPress={() => setHidden((h) => !h)}>
        <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={size === 'display' ? 22 : 18} color={MUTED} />
      </Pressable>
    </View>
  );
}

/** Repaid share of the loan; fills in on the UI thread when the card appears. */
function ProgressTrack({ value }: { value: number }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(value, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [value, fill]);
  const style = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Animated.View style={[styles.trackFill, style]} />
    </View>
  );
}

/** Loan ⇄ Wallet pill switch with a sliding thumb. */
function Switcher({ value, onChange }: { value: View_; onChange: (v: View_) => void }) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(value === 'loan' ? 0 : width / 2, { damping: 20, stiffness: 260 }));
  }, [value, width, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const options: { key: View_; label: string }[] = [
    { key: 'loan', label: 'Loan' },
    { key: 'wallet', label: 'Wallet' },
  ];
  return (
    <View
      style={styles.switcher}
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 ? <Animated.View style={[styles.thumb, { width: width / 2 }, thumb]} /> : null}
      {options.map((o) => (
        <Pressable
          key={o.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.key }}
          onPress={() => {
            if (value === o.key) return;
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
            onChange(o.key);
          }}
          style={styles.switchOption}>
          <Text variant="small" color={value === o.key ? colors.navy : MUTED} style={{ fontFamily: font.semibold }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function HeroButton({
  title,
  icon,
  href,
  compact,
  ghost,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  compact?: boolean;
  ghost?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        router.push(href);
      }}
      style={[styles.cta, compact && styles.ctaCompact, ghost && styles.ctaGhost]}>
      <Ionicons name={icon} size={compact ? 16 : 18} color={colors.white} />
      <Text variant={compact ? 'small' : 'bodyStrong'} color={colors.white} style={{ fontFamily: font.bold }}>
        {title}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl - 4,
    padding: space.xl,
    overflow: 'hidden',
    gap: space.lg,
  },
  // Soft brand-colour glows in the corners; plain views, no image or gradient library.
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: colors.cyan },
  glowTop: { width: 220, height: 220, top: -120, right: -80, opacity: 0.16 },
  glowBottom: { width: 180, height: 180, bottom: -110, left: -60, opacity: 0.1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: space.xs },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  skeleton: { backgroundColor: FAINT, marginVertical: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: FAINT, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4, backgroundColor: colors.cyan },
  switcher: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: FAINT,
    minWidth: 180,
  },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.pill, backgroundColor: colors.white },
  switchOption: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
  ctaCompact: { minHeight: 44, paddingHorizontal: space.md, marginTop: 0 },
  ctaGhost: { backgroundColor: FAINT },
});
