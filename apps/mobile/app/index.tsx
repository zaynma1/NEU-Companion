import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuthBootstrap } from '../src/auth';
import { useTheme } from '../src/theme';

export default function RootRoute() {
  const { colors, spacing } = useTheme();
  const { status } = useAuthBootstrap();

  if (status === 'loading') {
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
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (status === 'guest') {
    return <Redirect href="/(auth)" />;
  }

  return <Redirect href="/(app)" />;
}
