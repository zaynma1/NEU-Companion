import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_500Medium,
  useFonts as useJetBrainsFonts,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts as useSpaceGroteskFonts,
} from '@expo-google-fonts/space-grotesk';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';

import { ThemeProvider, useTheme } from './src/theme';

function AppContent() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}> 
        <StatusBar style="light" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.textSecondary }]}>NEU Companion</Text>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Mobile foundation ready</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Dark-first academic app shell with shared theme tokens and safe-area layout.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [spaceGroteskLoaded] = useSpaceGroteskFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [jetBrainsLoaded] = useJetBrainsFonts({
    JetBrainsMono_500Medium,
  });

  if (!(spaceGroteskLoaded && interLoaded && jetBrainsLoaded)) {
    return null;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  label: {
    marginBottom: 12,
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
});
