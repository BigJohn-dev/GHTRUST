/**
 * Asks for the 4-digit transaction PIN before money leaves the account. A customer who
 * skipped creating one at sign-up creates it here, and the payment goes straight on.
 */
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { security } from "@/api/endpoints";
import { ApiError, messageFor } from "@/api/errors";
import { keys, useMe } from "@/lib/queries";
import { colors, radius, space } from "@/theme/tokens";

import { Button } from "./Button";
import { PinFlow } from "./PinFlow";
import { PinPad } from "./PinPad";
import { Text } from "./Text";

/** Errors this sheet deals with itself; anything else closes it for the screen to show. */
const PIN_ERRORS = new Set([
  "TRANSACTION_PIN_INVALID",
  "TRANSACTION_PIN_LOCKED",
  "TRANSACTION_PIN_NOT_SET",
]);

type Props = {
  visible: boolean;
  /** e.g. "Pay ₦15,000 to your loan" */
  summary: string;
  onClose: () => void;
  /** Runs the payment with the PIN. Rejects with the API error if it fails. */
  onPin: (pin: string) => Promise<unknown>;
};

export function TransactionPinSheet({
  visible,
  summary,
  onClose,
  onPin,
}: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      onRequestClose={onClose}
    >
      {/* Mounted fresh each time it opens, so no PIN or error carries over. */}
      {visible ? (
        <SheetBody summary={summary} onClose={onClose} onPin={onPin} />
      ) : null}
    </Modal>
  );
}

function SheetBody({ summary, onClose, onPin }: Omit<Props, "visible">) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(
    me.data?.transaction_pin_set === false,
  );

  const run = async (value: string) => {
    setBusy(true);
    try {
      await onPin(value);
      onClose();
    } catch (err) {
      setPin("");
      setTries((n) => n + 1);
      if (!(err instanceof ApiError) || !PIN_ERRORS.has(err.code)) {
        onClose(); // the screen shows what went wrong
        return;
      }
      if (err.code === "TRANSACTION_PIN_NOT_SET") setCreating(true);
      if (err.code === "TRANSACTION_PIN_LOCKED") setLocked(true);
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" muted>
            {summary.toUpperCase()}
          </Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text variant="bodyStrong" color={colors.cyanDeep}>
            Cancel
          </Text>
        </Pressable>
      </View>

      {creating ? (
        <PinFlow
          steps={[
            {
              key: "pin",
              title: "Create your transaction PIN",
              subtitle:
                "You need one before money can leave your account. 4 digits, different from your sign-in PIN.",
              length: 4,
              isNew: true,
            },
            {
              key: "confirm",
              title: "Enter it again",
              length: 4,
              confirms: "pin",
            },
          ]}
          restartAt={() => "pin"}
          onDone={async ({ pin: chosen }) => {
            queryClient.setQueryData(
              keys.me,
              await security.setTransactionPin(chosen),
            );
            setCreating(false);
            await run(chosen); // they just typed it: carry straight on with the payment
          }}
        />
      ) : locked ? (
        <View style={styles.locked}>
          <Text variant="title" align="center">
            Transaction PIN locked
          </Text>
          <Text muted align="center">
            {error}
          </Text>
          <Button
            title="Reset transaction PIN"
            onPress={() => {
              onClose();
              router.push("/pin/reset-transaction");
            }}
          />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.head}>
            <Text variant="title" align="center">
              Enter transaction PIN
            </Text>
            <Text muted align="center">
              Your 4-digit PIN for payments.
            </Text>
          </View>
          <PinPad
            length={4}
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (error && v) setError(null);
            }}
            onComplete={run}
            error={error}
            shakeKey={tries}
            disabled={busy}
          />
          <Button
            title="Forgot transaction PIN?"
            variant="ghost"
            size="sm"
            onPress={() => {
              onClose();
              router.push("/pin/reset-transaction");
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: space.xl,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    gap: space.md,
  },
  body: { flex: 1, justifyContent: "center", gap: space.lg },
  head: { gap: space.xs },
  locked: {
    flex: 1,
    justifyContent: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
});
