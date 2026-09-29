import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { SupportTicket } from '@/api/types';
import { Badge } from '@/components/Badge';
import { Card, Row, SectionHeader } from '@/components/Card';
import { PressableScale } from '@/components/home/PressableScale';
import { Screen } from '@/components/Screen';
import { CardSkeleton, ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { activityWhen } from '@/lib/activity';
import { useFaqs, useFeatures, useTickets } from '@/lib/queries';
import { CATEGORY, ticketStatus } from '@/lib/support';
import { colors, font, radius, shadow, space } from '@/theme/tokens';

/** Help centre: contact options, report a problem, the customer's requests, and FAQs. */
export default function HelpCentre() {
  const { support } = useFeatures();
  const faqs = useFaqs();
  const tickets = useTickets();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const items = (faqs.data?.items ?? []).filter(
      (f) => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
    );
    return (faqs.data?.topics ?? [])
      .map((topic) => ({ topic, items: items.filter((f) => f.topic === topic) }))
      .filter((g) => g.items.length);
  }, [faqs.data, q]);

  const contacts = [
    support?.whatsapp
      ? {
          key: 'wa',
          icon: 'logo-whatsapp' as const,
          label: 'WhatsApp',
          color: '#1FA855',
          go: () => Linking.openURL(`https://wa.me/${support.whatsapp}`),
        }
      : null,
    support?.phone
      ? {
          key: 'call',
          icon: 'call' as const,
          label: 'Call us',
          color: colors.navy,
          go: () => Linking.openURL(`tel:${support.phone}`),
        }
      : null,
    support?.email
      ? {
          key: 'mail',
          icon: 'mail' as const,
          label: 'Email',
          color: colors.cyanDeep,
          go: () => Linking.openURL(`mailto:${support.email}`),
        }
      : null,
  ].filter((c) => c !== null);

  const recent = (tickets.data ?? []).slice(0, 3);

  return (
    <Screen
      edges={['bottom']}
      onRefresh={() => {
        faqs.refetch();
        tickets.refetch();
      }}
      refreshing={faqs.isRefetching || tickets.isRefetching}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search questions"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          accessibilityLabel="Search questions"
          returnKeyType="search"
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
            onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {!q ? (
        <>
          {contacts.length ? (
            <>
              <View style={styles.contacts}>
                {contacts.map((c) => (
                  <PressableScale
                    key={c.key}
                    accessibilityRole="button"
                    accessibilityLabel={c.label}
                    onPress={c.go}
                    style={styles.contact}>
                    <View style={[styles.contactIcon, { backgroundColor: `${c.color}18` }]}>
                      <Ionicons name={c.icon} size={22} color={c.color} />
                    </View>
                    <Text variant="small" style={{ fontFamily: font.semibold }}>
                      {c.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
              {support?.hours ? (
                <Text variant="small" muted align="center">
                  We're available {support.hours}.
                </Text>
              ) : null}
            </>
          ) : null}

          <Card onPress={() => router.push('/support/new')} accessibilityLabel="Report a problem" style={styles.report}>
            <View style={styles.reportIcon}>
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">Report a problem</Text>
              <Text variant="small" muted>
                Tell us what happened and we'll get back to you here.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Card>

          {recent.length ? (
            <>
              <SectionHeader title="Your requests" />
              <View style={styles.list}>
                {recent.map((t, i) => (
                  <TicketRow key={t.id} ticket={t} last={i === recent.length - 1} />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <SectionHeader title={q ? 'Results' : 'Common questions'} />
      {faqs.isPending ? (
        <CardSkeleton lines={5} />
      ) : faqs.isError ? (
        <ErrorState error={faqs.error} onRetry={() => faqs.refetch()} />
      ) : groups.length === 0 ? (
        <Card>
          <Text variant="small" muted>
            No questions match "{query}". Try other words, or report a problem and we'll help.
          </Text>
        </Card>
      ) : (
        groups.map((g) => (
          <View key={g.topic} style={{ gap: space.xs }}>
            <Text variant="small" style={styles.topic}>
              {g.topic}
            </Text>
            <View style={styles.list}>
              {g.items.map((f, i) => (
                <Faq
                  key={f.id}
                  question={f.question}
                  answer={f.answer}
                  open={open === f.id || !!q}
                  last={i === g.items.length - 1}
                  onToggle={() => setOpen((cur) => (cur === f.id ? null : f.id))}
                />
              ))}
            </View>
          </View>
        ))
      )}

      {!q ? (
        <>
          <SectionHeader title="Legal" />
          <Card style={{ paddingVertical: space.xs }}>
            <Row icon="document-text-outline" title="Terms of Use" onPress={() => router.push('/legal/terms')} />
            <Row icon="lock-closed-outline" title="Privacy Policy" onPress={() => router.push('/legal/privacy')} last />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const Faq = memo(function Faq({
  question,
  answer,
  open,
  last,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  last: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.faq, !last && styles.divider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.faqHead}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {question}
        </Text>
        <Ionicons name={open ? 'remove' : 'add'} size={20} color={colors.cyanDeep} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(180)}>
          <Text variant="small" muted style={styles.answer}>
            {answer}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

function TicketRow({ ticket, last }: { ticket: SupportTicket; last?: boolean }) {
  const s = ticketStatus(ticket.status);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/support/${ticket.id}`)}
      style={({ pressed }) => [styles.ticket, !last && styles.divider, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {CATEGORY[ticket.category]?.label ?? 'Request'} · {ticket.reference}
        </Text>
        <Text variant="small" muted numberOfLines={1}>
          {ticket.reply ? `Reply: ${ticket.reply}` : ticket.message}
        </Text>
        <Text variant="small" muted>
          {activityWhen(ticket.created_at, new Date(), true)}
        </Text>
      </View>
      <Badge label={s.label} tone={s.tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.text,
    paddingVertical: space.sm,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  contacts: { flexDirection: 'row', gap: space.sm },
  contact: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.card,
    borderRadius: radius.md + 2,
    paddingVertical: space.md,
    ...shadow,
  },
  contactIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  report: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  topic: { fontFamily: font.semibold, color: colors.textMuted, paddingHorizontal: space.xs },
  faq: { paddingHorizontal: space.md },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingVertical: space.sm },
  answer: { paddingBottom: space.md, lineHeight: 21 },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.card,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
