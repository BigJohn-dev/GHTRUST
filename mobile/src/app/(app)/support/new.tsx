import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { support } from '@/api/endpoints';
import { messageFor } from '@/api/errors';
import type { TicketCategory, TicketRelated } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Banner } from '@/components/States';
import { Text } from '@/components/Text';
import { keys } from '@/lib/queries';
import { CATEGORY, CATEGORY_ORDER } from '@/lib/support';
import { colors, font, radius, space } from '@/theme/tokens';

const MIN = 10;
const MAX = 2000;
const RELATED: Record<string, string> = {
  transaction: 'this transaction',
  loan: 'this loan',
  application: 'this application',
};

/** Report a problem. Opened from Help, or from a receipt / loan with it pre-linked. */
export default function ReportProblem() {
  const params = useLocalSearchParams<{ category?: string; related_type?: string; related_id?: string }>();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<TicketCategory | null>(
    params.category && params.category in CATEGORY ? (params.category as TicketCategory) : null,
  );
  const [message, setMessage] = useState('');
  const [related, setRelated] = useState(
    params.related_type && params.related_id && params.related_type in RELATED
      ? { type: params.related_type as TicketRelated, id: params.related_id }
      : null,
  );

  const send = useMutation({
    mutationFn: () =>
      support.create({
        category: category!,
        message: message.trim(),
        ...(related ? { related_type: related.type, related_id: related.id } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tickets }),
  });

  if (send.isSuccess) {
    return (
      <Screen
        edges={['bottom']}
        scroll={false}
        footer={
          <>
            <Button title="Done" onPress={() => router.back()} />
            <Button title="View request" variant="ghost" onPress={() => router.replace(`/support/${send.data.id}`)} />
          </>
        }>
        <View style={styles.success}>
          <Animated.View entering={ZoomIn.springify()} style={styles.tick}>
            <Ionicons name="checkmark" size={40} color={colors.white} />
          </Animated.View>
          <Text variant="title" align="center">
            We've got it
          </Text>
          <Text muted align="center">
            Your reference is {send.data.reference}. We'll reply in the app and send you a notification.
          </Text>
        </View>
      </Screen>
    );
  }

  const length = message.trim().length;
  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title="Send"
          icon="send"
          disabled={!category || length < MIN}
          loading={send.isPending}
          onPress={() => send.mutate()}
        />
      }>
      {send.error ? <Banner message={messageFor(send.error)} /> : null}
      <Text variant="bodyStrong">What's it about?</Text>
      <View style={styles.grid}>
        {CATEGORY_ORDER.map((key) => {
          const c = CATEGORY[key];
          const on = category === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${c.label}: ${c.hint}`}
              onPress={() => setCategory(key)}
              style={[styles.option, on && styles.optionOn]}>
              <Ionicons name={c.icon} size={20} color={on ? colors.white : colors.navy} />
              <Text
                variant="small"
                color={on ? colors.white : colors.text}
                style={{ fontFamily: font.semibold }}
                numberOfLines={1}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {category ? (
        <Text variant="small" muted>
          {CATEGORY[category].hint}
        </Text>
      ) : null}

      {related ? (
        <Card style={styles.related}>
          <Ionicons name="link" size={18} color={colors.cyanDeep} />
          <Text variant="small" style={{ flex: 1 }}>
            About {RELATED[related.type]}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove link"
            hitSlop={10}
            onPress={() => setRelated(null)}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>
      ) : null}

      <Field
        label="Tell us what happened"
        value={message}
        onChangeText={(t) => setMessage(t.slice(0, MAX))}
        multiline
        placeholder={
          category === 'payments'
            ? 'e.g. I sent ₦5,000 from GTBank at 2pm and my wallet hasn’t updated.'
            : 'Include what you were doing and anything you saw on screen.'
        }
        style={styles.message}
        hint={`${length}/${MAX}${length > 0 && length < MIN ? ` · at least ${MIN} characters` : ''}`}
      />
      <Text variant="small" muted>
        Never include your PINs or one-time codes. We'll never ask for them.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minHeight: 52,
  },
  optionOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  related: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  message: { minHeight: 140, textAlignVertical: 'top', paddingTop: space.sm },
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
