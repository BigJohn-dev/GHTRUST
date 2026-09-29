import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { CardSkeleton, ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { dateTime } from '@/lib/format';
import { useTicket } from '@/lib/queries';
import { CATEGORY, ticketStatus } from '@/lib/support';
import { colors, radius, space } from '@/theme/tokens';

/** One support request: what the customer wrote and the team's reply. */
export default function SupportRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useTicket(id);
  const t = ticket.data;

  if (ticket.isPending) {
    return (
      <Screen edges={['bottom']}>
        <CardSkeleton lines={4} />
      </Screen>
    );
  }
  if (ticket.isError || !t) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} />
      </Screen>
    );
  }

  const s = ticketStatus(t.status);
  return (
    <Screen
      edges={['bottom']}
      onRefresh={() => ticket.refetch()}
      refreshing={ticket.isRefetching}
      footer={
        t.status === 'resolved' ? (
          <Button title="Still need help?" variant="secondary" onPress={() => router.push('/support/new')} />
        ) : null
      }>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{CATEGORY[t.category]?.label ?? 'Request'}</Text>
          <Text variant="small" muted>
            {t.reference} · {dateTime(t.created_at)}
          </Text>
        </View>
        <Badge label={s.label} tone={s.tone} />
      </View>

      <View style={[styles.bubble, styles.mine]}>
        <Text variant="small" style={{ lineHeight: 21 }}>
          {t.message}
        </Text>
      </View>

      {t.reply ? (
        <View style={styles.replyRow}>
          <View style={styles.avatar}>
            <Ionicons name="headset" size={16} color={colors.white} />
          </View>
          <View style={[styles.bubble, styles.theirs]}>
            <Text variant="small" style={{ lineHeight: 21 }}>
              {t.reply}
            </Text>
            <Text variant="small" muted>
              GH Trust support · {dateTime(t.replied_at)}
            </Text>
          </View>
        </View>
      ) : (
        <Card>
          <Text variant="small" muted>
            We've received your request and will reply here. You'll get a notification when we do.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bubble: { padding: space.md, borderRadius: radius.lg, gap: space.xs, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: '#E4F3FA', borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.card, borderBottomLeftRadius: 6, flexShrink: 1 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
