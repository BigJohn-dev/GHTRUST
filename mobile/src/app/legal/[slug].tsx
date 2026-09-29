import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Banner, CardSkeleton, ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { date } from '@/lib/format';
import { useLegalDocument } from '@/lib/queries';
import { colors, font, space } from '@/theme/tokens';

/** Terms of Use / Privacy Policy. Reachable signed in or out (e.g. from sign-up). */
export default function LegalDocumentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const doc = useLegalDocument(slug);
  const d = doc.data;

  return (
    <Screen edges={['bottom']} onRefresh={() => doc.refetch()} refreshing={doc.isRefetching}>
      <Stack.Screen options={{ title: d?.title ?? '' }} />
      {doc.isPending ? (
        <>
          <CardSkeleton lines={3} />
          <CardSkeleton lines={5} />
        </>
      ) : doc.isError || !d ? (
        <ErrorState error={doc.error} onRetry={() => doc.refetch()} />
      ) : (
        <>
          {d.draft ? <Banner tone="info" message="Draft wording, pending final legal review." /> : null}
          <View style={{ gap: space.xs }}>
            <Text variant="title">{d.title}</Text>
            <Text variant="small" muted>
              Effective {date(d.effective_date)} · Version {d.version}
            </Text>
          </View>
          <Text muted>{d.summary}</Text>
          {d.sections.map((s, i) => (
            <View key={s.heading} style={styles.section} accessibilityRole="summary">
              <Text variant="bodyStrong" style={styles.heading} accessibilityRole="header">
                {i + 1}. {s.heading}
              </Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  heading: { fontFamily: font.bold },
  body: { lineHeight: 24, color: colors.text },
});
