import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { legal } from '@/api/endpoints';
import { messageFor } from '@/api/errors';
import type { Profile } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Banner, CardSkeleton, ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { keys, useLegalDocuments, useMe } from '@/lib/queries';
import { colors, radius, space } from '@/theme/tokens';

/**
 * Shown before anything else whenever the customer hasn't accepted the current Terms of
 * Use / Privacy Policy: right after sign-up, and again if either document is updated.
 */
export default function LegalConsent() {
  const queryClient = useQueryClient();
  const { signOut } = useSession();
  const me = useMe();
  const docs = useLegalDocuments();
  const [agreed, setAgreed] = useState(false);
  const pending = me.data?.legal_pending ?? [];
  const shown = (docs.data ?? []).filter((d) => pending.includes(d.slug));

  const accept = useMutation({
    mutationFn: () => legal.accept(Object.fromEntries(shown.map((d) => [d.slug, d.version]))),
    onSuccess: (res) => {
      queryClient.setQueryData<Profile>(keys.me, (old) => (old ? { ...old, legal_pending: res.legal_pending } : old));
    },
    // A document changed while this screen was open: load the new version.
    onError: () => docs.refetch(),
  });

  if (docs.isPending) {
    return (
      <Screen>
        <CardSkeleton lines={4} />
      </Screen>
    );
  }
  if (docs.isError) {
    return (
      <Screen>
        <ErrorState error={docs.error} onRetry={() => docs.refetch()} />
      </Screen>
    );
  }

  const names = shown.map((d) => d.title).join(' and ');
  return (
    <Screen
      footer={
        <>
          <Button
            title="Agree and continue"
            disabled={!agreed || shown.length === 0}
            loading={accept.isPending}
            onPress={() => accept.mutate()}
          />
          <Button title="Sign out" variant="ghost" onPress={() => signOut()} />
        </>
      }>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="document-text-outline" size={30} color={colors.cyanDeep} />
        </View>
        <Text variant="title">Before you continue</Text>
        <Text muted>
          Please read and accept our {names}. They explain how GH Trust works and how we look after your information.
        </Text>
      </View>

      {accept.error ? <Banner message={messageFor(accept.error)} /> : null}

      {shown.map((d) => (
        <Card key={d.slug} onPress={() => router.push(`/legal/${d.slug}`)} accessibilityLabel={`Read the ${d.title}`}>
          <View style={styles.docRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="bodyStrong">{d.title}</Text>
              <Text variant="small" muted>
                {d.summary}
              </Text>
              <Text variant="small" color={colors.cyanDeep}>
                Read the {d.title.toLowerCase()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </View>
        </Card>
      ))}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed((a) => !a)}
        style={styles.agree}>
        <View style={[styles.box, agreed && styles.boxOn]}>
          {agreed ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
        </View>
        <Text variant="small" style={{ flex: 1 }}>
          I have read and agree to the {names}.
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, marginTop: space.lg },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  agree: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingVertical: space.sm, minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.navy, borderColor: colors.navy },
});
