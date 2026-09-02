import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiClientError } from '../../src/api';
import { completeLocalGoogleLogin, startGoogleLogin } from '../../src/auth';
import { clearSession, saveSession } from '../../src/auth/session';
import { useTheme } from '../../src/theme';

function DebugSessionTester() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();

  async function setSession(role: 'student' | 'pending' | 'authenticated') {
    if (role === 'student') {
      await saveSession({
        userId: 'debug-student',
        email: 'student@std.neu.edu.tr',
        role: 'student',
        accountStatus: 'active',
        onboardingCompleted: true,
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
    } else if (role === 'pending') {
      await saveSession({
        userId: 'debug-pending',
        email: 'pending@neu.edu.tr',
        role: 'pending',
        accountStatus: 'active',
        onboardingCompleted: false,
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
    } else {
      await saveSession({
        userId: 'debug-expired',
        email: 'expired@neu.edu.tr',
        role: 'student',
        accountStatus: 'active',
        onboardingCompleted: true,
        expiresAt: '2000-01-01T00:00:00.000Z',
      });
    }

    router.replace('/');
  }

  async function handleResetGuest() {
    await clearSession();
    router.replace('/');
  }

  return (
    <View style={{ marginTop: spacing['3xl'] }}>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Debug session tester</Text>

      <Pressable
        onPress={() => void setSession('student')}
        style={({ pressed }) => [{
          backgroundColor: pressed ? colors.primaryPressed : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: spacing.sm,
        }]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>Force authenticated session</Text>
      </Pressable>

      <Pressable
        onPress={() => void setSession('pending')}
        style={({ pressed }) => [{
          backgroundColor: pressed ? colors.primaryPressed : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: spacing.sm,
        }]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>Force pending session</Text>
      </Pressable>

      <Pressable
        onPress={() => void setSession('authenticated')}
        style={({ pressed }) => [{
          backgroundColor: pressed ? colors.primaryPressed : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: spacing.sm,
        }]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>Force expired session</Text>
      </Pressable>

      <Pressable
        onPress={() => void handleResetGuest()}
        style={({ pressed }) => [{
          backgroundColor: pressed ? colors.primaryPressed : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>Clear session (guest)</Text>
      </Pressable>
    </View>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const response = await startGoogleLogin();

      if (response.localDevFallback) {
        const session = await completeLocalGoogleLogin();
        if (session) {
          router.replace('/');
          return;
        }

        throw new Error('The local-dev Google sign-in flow did not create a valid session.');
      }

      const canOpenUrl = await Linking.canOpenURL(response.authUrl);

      if (!canOpenUrl) {
        throw new Error('The sign-in page could not be opened on this device.');
      }

      await Linking.openURL(response.authUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Google sign-in could not be started. Please try again.',
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, padding: spacing['3xl'] }]}>
      <View style={styles.content}>
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <Text style={[typography.h3, { color: colors.onPrimary }]}>NEU</Text>
        </View>

        <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing['3xl'] }]}>
          Your campus, in step.
        </Text>
        <Text style={[typography.bodyLarge, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Sign in with your university Google account to continue.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={isStarting}
          onPress={handleGoogleSignIn}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? colors.primaryPressed : colors.primary, marginTop: spacing['4xl'] },
            isStarting && styles.buttonDisabled,
          ]}
        >
          <Text style={[typography.bodyLarge, styles.buttonLabel, { color: colors.onPrimary }]}>
            {isStarting ? 'Opening Google…' : 'Continue with Google'}
          </Text>
        </Pressable>

        {errorMessage ? (
          <Text
            accessibilityRole="alert"
            style={[typography.body, styles.error, { color: colors.danger, marginTop: spacing.lg }]}
          >
            {errorMessage}
          </Text>
        ) : null}

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing['4xl'] }]}>
          Use your approved NEU account to access your courses and schedule.
        </Text>

        {__DEV__ ? <DebugSessionTester /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonLabel: {
    fontWeight: '600',
  },
  error: {
    textAlign: 'center',
  },
});
