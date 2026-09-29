import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { newIdempotencyKey } from '@/api/client';
import { wallet } from '@/api/endpoints';
import { ApiError, messageFor } from '@/api/errors';
import { AmountField } from '@/components/AmountField';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Banner, CardSkeleton, EmptyState, ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { TransactionPinSheet } from '@/components/TransactionPinSheet';
import { shortAccount } from '@/lib/activity';
import { dateTime, naira } from '@/lib/format';
import { keys, useWallet } from '@/lib/queries';
import { colors, font, radius, space } from '@/theme/tokens';

const MIN = 100;

/** Move money from the wallet to the customer's saved bank account. */
export default function Withdraw() {
  const queryClient = useQueryClient();
  const summary = useWallet();
  const [amount, setAmount] = useState('');
  const [askPin, setAskPin] = useState(false);
  // One key per withdrawal attempt: a retry after a timeout replays, never pays out twice.
  const key = useRef(newIdempotencyKey());

  const send = useMutation({
    mutationFn: (pin: string) => wallet.withdraw(Number(amount).toFixed(2), pin, key.current),
    onSuccess: () => {
      if (Platform.OS !== 'web')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: keys.wallet });
      queryClient.invalidateQueries({ queryKey: keys.transactions });
    },
  });

  // Changing the amount is a new action → new key.
  useEffect(() => {
    if (!send.isPending) key.current = newIdempotencyKey();
  }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const w = summary.data;

  if (send.isSuccess) {
    return (
      <Screen
        edges={['bottom']}
        scroll={false}
        footer={
          <>
            <Button title="Done" onPress={() => router.back()} />
            <Button
              title="View receipt"
              variant="ghost"
              onPress={() => router.replace(`/transactions/w_${send.data.id}`)}
            />
          </>
        }>
        <View style={styles.success}>
          <Animated.View entering={ZoomIn.springify()} style={styles.tick}>
            <Ionicons name="paper-plane" size={36} color={colors.white} />
          </Animated.View>
          <Text variant="title" align="center">
            Withdrawal on its way
          </Text>
          <Text muted align="center">
            {naira(send.data.amount)} is being sent to {w?.payout_account?.bank_name ?? 'your bank'}{' '}
            {w?.payout_account?.account_number_masked.slice(-4)
              ? `····${w.payout_account.account_number_masked.slice(-4)}`
              : ''}
            . Most transfers arrive within minutes.
          </Text>
        </View>
      </Screen>
    );
  }

  if (summary.isPending) {
    return (
      <Screen edges={['bottom']}>
        <CardSkeleton />
      </Screen>
    );
  }
  if (summary.isError || !w) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      </Screen>
    );
  }

  const payout = w.payout_account;
  if (!payout) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="business-outline"
          title="Add your bank account"
          body="Tell us where to send your money. You only need to do this once."
          action={{ title: 'Add bank account', onPress: () => router.replace('/payout-account?next=withdraw') }}
        />
      </Screen>
    );
  }

  const balance = w.available_balance;
  const value = Number(amount || 0);
  const onHold = w.withdrawals_blocked_until ? new Date(w.withdrawals_blocked_until) > new Date() : false;
  const insufficient = send.error instanceof ApiError && send.error.code === 'INSUFFICIENT_FUNDS';
  // Wrong or locked PINs are shown in the PIN sheet itself.
  const pinError = send.error instanceof ApiError && send.error.code.startsWith('TRANSACTION_PIN_');

  let error: string | null = null;
  if (amount && value < MIN) error = `The least you can withdraw is ${naira(MIN)}.`;
  else if (value > balance) error = `You have ${naira(balance, { kobo: true })} available.`;

  return (
    <Screen
      edges={['bottom']}
      onRefresh={() => summary.refetch()}
      refreshing={summary.isRefetching}
      footer={
        <Button
          title={value > 0 ? `Withdraw ${naira(value)}` : 'Withdraw'}
          disabled={onHold || !!error || value < MIN}
          loading={send.isPending}
          onPress={() => {
            send.reset();
            setAskPin(true);
          }}
        />
      }>
      <TransactionPinSheet
        visible={askPin}
        summary={`Withdraw ${naira(value)} to ${payout.bank_name ?? 'your bank'}`}
        onClose={() => setAskPin(false)}
        onPin={(pin) => send.mutateAsync(pin)}
      />

      {onHold ? (
        <Banner
          tone="warning"
          message={`For your security, withdrawals are paused until ${dateTime(w.withdrawals_blocked_until)} after signing in without your old phone.`}
        />
      ) : null}
      {send.error && !pinError && !insufficient ? <Banner message={messageFor(send.error)} /> : null}
      {insufficient ? <Banner tone="warning" message="Your balance changed. Check the amount and try again." /> : null}

      <View style={styles.balance}>
        <Text variant="small" muted>
          Available to withdraw
        </Text>
        <Text variant="heading" style={{ fontFamily: font.bold }}>
          {naira(balance, { kobo: true })}
        </Text>
      </View>

      <AmountField label="Amount" value={amount} onChange={setAmount} error={error} autoFocus={!onHold} />
      {balance >= MIN ? (
        <Button
          title="Withdraw everything"
          variant="secondary"
          size="sm"
          onPress={() => setAmount(String(Math.floor(balance)))}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}

      <Text variant="caption" muted style={{ marginTop: space.sm }}>
        TO
      </Text>
      <Card
        style={styles.account}
        onPress={() => router.push('/payout-account')}
        accessibilityLabel="Change bank account">
        <View style={styles.bankIcon}>
          <Ionicons name="business" size={20} color={colors.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {payout.account_name ?? 'Your account'}
          </Text>
          <Text variant="small" muted numberOfLines={1}>
            {shortAccount(payout.account_number_masked)} · {payout.bank_name ?? 'Bank'}
          </Text>
        </View>
        <Text variant="small" color={colors.cyanDeep} style={{ fontFamily: font.semibold }}>
          Change
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bankIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceNav,
    alignItems: 'center',
    justifyContent: 'center',
  },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  tick: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
});
