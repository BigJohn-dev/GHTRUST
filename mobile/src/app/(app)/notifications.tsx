import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { notifications } from '@/api/endpoints';
import type { AppNotification } from '@/api/types';
import { toneColor } from '@/components/Badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { activityWhen } from '@/lib/activity';
import { keys, useNotifications } from '@/lib/queries';
import type { Tone } from '@/lib/status';
import { colors, font, radius, shadow, space } from '@/theme/tokens';

const KIND: Record<string, { icon: keyof typeof Ionicons.glyphMap; tone: Tone }> = {
  wallet_funded: { icon: 'arrow-down', tone: 'success' },
  withdrawal_completed: { icon: 'arrow-up', tone: 'success' },
  withdrawal_failed: { icon: 'alert-circle', tone: 'danger' },
  application_approved: { icon: 'checkmark-circle', tone: 'success' },
  application_rejected: { icon: 'close-circle', tone: 'danger' },
  document_rejected: { icon: 'document-attach', tone: 'warning' },
  loan_disbursed: { icon: 'cash', tone: 'success' },
  repayment_received: { icon: 'checkmark-done', tone: 'success' },
  repayment_due: { icon: 'calendar', tone: 'info' },
  repayment_overdue: { icon: 'alert-circle', tone: 'danger' },
  sign_in_request: { icon: 'shield-checkmark', tone: 'progress' },
};

/** Everything we've told the customer: payments, decisions, reminders and security alerts. */
export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const list = useNotifications();
  const items = useMemo(() => (list.data?.pages ?? []).flatMap((p) => p.items), [list.data]);
  const unread = list.data?.pages[0]?.unread_count ?? 0;

  const read = useMutation({
    mutationFn: (ids?: string[]) => notifications.markRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.notifications }),
  });

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.read) read.mutate([n.id]);
      if (n.route?.startsWith('/')) router.push(n.route as Href);
    },
    [read],
  );
  const renderItem = useCallback<ListRenderItem<AppNotification>>(
    ({ item, index }) => <Item item={item} last={index === items.length - 1} onPress={open} />,
    [items.length, open],
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.fill}>
      <Stack.Screen
        options={{
          headerRight: () =>
            unread > 0 ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => read.mutate(undefined)}
                style={{ paddingHorizontal: space.xs }}>
                <Text variant="small" color={colors.cyanDeep} style={{ fontFamily: font.semibold }}>
                  Mark all read
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      {list.isPending ? (
        <View style={[styles.card, styles.list]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.row, i < 3 && styles.divider]}>
              <Skeleton height={40} width={40} style={{ borderRadius: 20 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton height={14} width="50%" />
                <Skeleton height={12} width="85%" />
              </View>
            </View>
          ))}
        </View>
      ) : list.isError ? (
        <View style={styles.list}>
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.list}>
          <EmptyState
            icon="notifications-outline"
            title="You're all caught up"
            body="Payments, loan updates and reminders will show up here."
          />
        </View>
      ) : (
        <View style={[styles.card, styles.list, styles.shrink]}>
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            renderItem={renderItem}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={list.isRefetching && !list.isFetchingNextPage}
                onRefresh={() => list.refetch()}
                tintColor={colors.navy}
                colors={[colors.navy]}
              />
            }
            ListFooterComponent={
              list.isFetchingNextPage ? <ActivityIndicator color={colors.navy} style={{ padding: space.md }} /> : null
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const Item = memo(function Item({
  item,
  last,
  onPress,
}: {
  item: AppNotification;
  last: boolean;
  onPress: (n: AppNotification) => void;
}) {
  const kind = KIND[item.kind] ?? { icon: 'notifications' as const, tone: 'neutral' as Tone };
  const tint = toneColor(kind.tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, !last && styles.divider, !item.read && styles.unread, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={kind.icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {item.title}
          </Text>
          <Text variant="small" muted>
            {activityWhen(item.created_at, new Date(), true)}
          </Text>
        </View>
        <Text variant="small" muted numberOfLines={3}>
          {item.body}
        </Text>
      </View>
      {!item.read ? <View style={styles.dot} accessibilityElementsHidden /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface },
  list: { margin: space.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, backgroundColor: colors.card },
  unread: { backgroundColor: '#F4F9FD' },
  pressed: { opacity: 0.85 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan, marginTop: 6 },
});
