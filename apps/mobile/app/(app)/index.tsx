import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { clearSession, logout, useAuthBootstrap } from '../../src/auth';
import { saveSession } from '../../src/auth/session';
import { useTheme } from '../../src/theme';

function DebugStateTester() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();

  async function forceGuest() {
    await clearSession();
    router.replace('/');
  }

  async function forcePending() {
    await saveSession({
      userId: 'debug-pending',
      email: 'pending@neu.edu.tr',
      role: 'pending',
      accountStatus: 'active',
      onboardingCompleted: false,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    router.replace('/');
  }

  async function forceAuthenticated() {
    await saveSession({
      userId: 'debug-student',
      email: 'student@std.neu.edu.tr',
      role: 'student',
      accountStatus: 'active',
      onboardingCompleted: true,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    router.replace('/');
  }

  return (
    <View style={{ marginTop: spacing['2xl'] }}>
      <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Debug state tester</Text>

      <Pressable
        onPress={() => void forceGuest()}
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
        <Text style={[typography.body, { color: colors.textPrimary }]}>Force guest route</Text>
      </Pressable>

      <Pressable
        onPress={() => void forcePending()}
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
        <Text style={[typography.body, { color: colors.textPrimary }]}>Force pending route</Text>
      </Pressable>

      <Pressable
        onPress={() => void forceAuthenticated()}
        style={({ pressed }) => [{
          backgroundColor: pressed ? colors.primaryPressed : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>Force authenticated route</Text>
      </Pressable>
    </View>
  );
}

export default function AppHomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { status, session } = useAuthBootstrap();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)');
  }

  async function handleCompleteOnboarding() {
    if (!session) {
      return;
    }

    const nextSession = {
      ...session,
      onboardingCompleted: true,
    };

    await saveSession(nextSession);
    router.replace('/');
  }

  if (status === 'pending') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing['3xl'],
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            backgroundColor: colors.surface,
            padding: spacing['3xl'],
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: `${colors.warning}1A`,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              marginBottom: spacing.lg,
            }}
          >
            <Text style={[typography.overline, { color: colors.warning }]}>Account review</Text>
          </View>

          <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.md }]}>Access pending</Text>

          <Text style={[typography.bodyLarge, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
            Your NEU account is under review. Once an admin confirms your role, you’ll get full access to your courses, timetable, and notifications.
          </Text>

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.bg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            }}
          >
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Signed in as</Text>
            <Text style={[typography.bodyLarge, { color: colors.textPrimary }]}>{session?.email ?? 'Pending verification'}</Text>
          </View>

          <View style={{ marginBottom: spacing['2xl'] }}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>You can still:</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>• review your sign-in status</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>• wait for role confirmation</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>• sign out safely</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleLogout}
            style={({ pressed }) => [{
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              borderRadius: 12,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 20,
            }]}
          >
            <Text style={[typography.bodyLarge, { color: colors.onPrimary }]}>Log out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (status === 'onboarding_required') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing['3xl'],
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            backgroundColor: colors.surface,
            padding: spacing['3xl'],
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: `${colors.info}1A`,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              marginBottom: spacing.lg,
            }}
          >
            <Text style={[typography.overline, { color: colors.info }]}>First run</Text>
          </View>

          <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.md }]}>Welcome to NEU Companion</Text>

          <Text style={[typography.bodyLarge, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
            Finish your profile setup so we can tailor your campus experience to your role and academic details.
          </Text>

          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.bg,
              padding: spacing.lg,
              marginBottom: spacing.lg,
            }}
          >
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Signed in as</Text>
            <Text style={[typography.bodyLarge, { color: colors.textPrimary }]}>{session?.email ?? 'NEU account'}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>Role: {session?.role ?? 'student'}</Text>
          </View>

          <View style={{ marginBottom: spacing['2xl'] }}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>Required next steps</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>• confirm your academic details</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>• select your role context</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>• unlock course and timetable access</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleCompleteOnboarding}
            style={({ pressed }) => [{
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              borderRadius: 12,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 20,
              marginBottom: spacing.md,
            }]}
          >
            <Text style={[typography.bodyLarge, { color: colors.onPrimary }]}>Continue setup</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleLogout}
            style={({ pressed }) => [{
              backgroundColor: pressed ? colors.primaryPressed : 'transparent',
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 20,
            }]}
          >
            <Text style={[typography.bodyLarge, { color: colors.textPrimary }]}>Log out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing['3xl'],
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 420,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          backgroundColor: colors.surface,
          padding: spacing['3xl'],
        }}
      >
        <Text style={[typography.overline, { color: colors.primary, marginBottom: spacing.md }]}>Authenticated shell</Text>
        <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.sm }]}>Home dashboard</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          This is the app entry for an active session.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          style={({ pressed }) => [{
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            borderRadius: 12,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }]}
        >
          <Text style={[typography.bodyLarge, { color: colors.onPrimary }]}>Log out</Text>
        </Pressable>

        {__DEV__ ? <DebugStateTester /> : null}
      </View>
    </View>
  );
}
