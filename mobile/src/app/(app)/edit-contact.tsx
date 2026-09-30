import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { auth } from '@/api/endpoints';
import { messageFor } from '@/api/errors';
import type { UpdateContact } from '@/api/types';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Banner, CardSkeleton, ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { keys, useMe } from '@/lib/queries';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ADDRESS_MIN = 5;
const ADDRESS_MAX = 300;

/** Email and home address. Name, BVN, date of birth and phone come from the BVN record. */
export default function EditContact() {
  const me = useMe();
  if (me.isPending) {
    return (
      <Screen edges={['bottom']}>
        <CardSkeleton lines={3} />
      </Screen>
    );
  }
  if (me.isError || !me.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </Screen>
    );
  }
  return <Form initialEmail={me.data.email ?? ''} initialAddress={me.data.residential_address ?? ''} />;
}

function Form({ initialEmail, initialAddress }: { initialEmail: string; initialAddress: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(initialEmail);
  const [address, setAddress] = useState(initialAddress);
  const [touched, setTouched] = useState(false);

  const cleanEmail = email.trim();
  const cleanAddress = address.trim().replace(/\s+/g, ' ');
  const emailChanged = cleanEmail !== initialEmail && cleanEmail !== '';
  const addressChanged = cleanAddress !== initialAddress.trim() && cleanAddress !== '';
  const emailError = emailChanged && !EMAIL.test(cleanEmail) ? 'Enter a valid email address.' : null;
  const addressError =
    addressChanged && cleanAddress.length < ADDRESS_MIN ? 'Enter your full home address.' : null;
  const canSave = (emailChanged || addressChanged) && !emailError && !addressError;

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateContact = {};
      if (emailChanged) body.email = cleanEmail;
      if (addressChanged) body.residential_address = cleanAddress;
      return auth.updateContact(body);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile);
      router.back();
    },
  });

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title="Save changes"
          disabled={!canSave}
          loading={save.isPending}
          onPress={() => {
            setTouched(true);
            if (canSave) save.mutate();
          }}
        />
      }>
      {save.error ? <Banner message={messageFor(save.error, "We couldn't save your details. Please try again.")} /> : null}
      <Field
        label="Email"
        optional
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        maxLength={255}
        placeholder="you@example.com"
        error={touched || email !== initialEmail ? emailError : null}
        hint="We use this for statements and important notices."
      />
      <Field
        label="Home address"
        value={address}
        onChangeText={(t) => setAddress(t.slice(0, ADDRESS_MAX))}
        multiline
        autoComplete="street-address"
        placeholder="House number, street, area, city"
        style={{ minHeight: 88, textAlignVertical: 'top' }}
        error={touched || address !== initialAddress ? addressError : null}
      />
      <Text variant="small" muted>
        Your name, BVN, date of birth and phone number come from your BVN record. To change your phone number, sign in
        on the new phone; for anything else, visit a GH Trust branch.
      </Text>
    </Screen>
  );
}
