import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { TransactionDirection } from '@/api/types';
import { TRANSACTION_ROW_HEIGHT, TransactionItem } from '@/components/home/TransactionItem';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { fromTransaction, type Activity } from '@/lib/activity';
import { useTransactions } from '@/lib/queries';
import { colors, font, radius, shadow, space } from '@/theme/tokens';

const FILTERS: { key: TransactionDirection | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'Money in' },
  { key: 'out', label: 'Money out' },
];

const EMPTY: Record<TransactionDirection | 'all', { title: string; body: string }> = {
  all: { title: 'No transactions yet', body: 'Money you add, repay or withdraw will show up here.' },
  in: { title: 'No money in yet', body: 'Transfers into your wallet will show up here.' },
  out: { title: 'No money out yet', body: 'Repayments from your wallet and withdrawals will show up here.' },
};

const getItemLayout = (_: unknown, index: number) => ({
  length: TRANSACTION_ROW_HEIGHT,
  offset: TRANSACTION_ROW_HEIGHT * index,
  index,
});

/** Wallet history: newest first, filtered by direction, loading older pages as you scroll. */
export default function Transactions() {
  const [filter, setFilter] = useState<TransactionDirection | 'all'>('all');
  const list = useTransactions(filter === 'all' ? undefined : filter);
  const items = useMemo(() => (list.data?.pages ?? []).flatMap((p) => p.items).map(fromTransaction), [list.data]);

  const renderItem = useCallback<ListRenderItem<Activity>>(
    ({ item, index }) => <TransactionItem item={item} last={index === items.length - 1} withTime />,
    [items.length],
  );
  const loadMore = () => {
    if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.fill}>
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text variant="small" color={on ? colors.white : colors.navy} style={{ fontFamily: font.semibold }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {list.isPending ? (
        <View style={[styles.card, styles.list]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.skeletonRow, i < 4 && styles.divider]}>
              <Skeleton height={42} width={42} style={{ borderRadius: radius.md }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton height={14} width="55%" />
                <Skeleton height={12} width="40%" />
              </View>
              <Skeleton height={14} width={70} />
            </View>
          ))}
        </View>
      ) : list.isError ? (
        <View style={styles.list}>
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.list}>
          <EmptyState icon="receipt-outline" title={EMPTY[filter].title} body={EMPTY[filter].body} />
        </View>
      ) : (
        <View style={[styles.card, styles.list, styles.shrink]}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews
            onEndReached={loadMore}
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
              list.isFetchingNextPage ? (
                <View style={styles.more}>
                  <ActivityIndicator color={colors.navy} />
                </View>
              ) : null
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface },
  filters: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.lg, paddingVertical: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  list: { marginHorizontal: space.lg, marginBottom: space.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  // Shrinks to its rows when there are few; fills the screen and scrolls when there are many.
  shrink: { flexShrink: 1 },
  skeletonRow: {
    height: TRANSACTION_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  more: { paddingVertical: space.md },
});
