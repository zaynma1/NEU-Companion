import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuthBootstrap } from '../src/auth';
import { ThemeProvider, useTheme } from '../src/theme';

function AppShell() {
  const { colors, typography, spacing } = useTheme();
  const { status } = useAuthBootstrap();

  if (status === 'loading') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
          <StatusBar style={colors.bg === '#121212' ? 'light' : 'dark'} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
              Loading session…
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const initialRouteName = status === 'authenticated' || status === 'pending' || status === 'onboarding_required' ? '(app)' : '(auth)';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
        <StatusBar style={colors.bg === '#121212' ? 'light' : 'dark'} />
        <Stack
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
