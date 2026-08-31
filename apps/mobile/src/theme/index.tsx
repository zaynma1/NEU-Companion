import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { colors, type AppColorScheme } from './colors';
import { duration, easing, spring } from './motion';
import { spacing } from './spacing';
import { typography } from './typography';

type ThemeValue = {
  scheme: AppColorScheme;
  colors: (typeof colors)[AppColorScheme];
  spacing: typeof spacing;
  typography: typeof typography;
  motion: {
    duration: typeof duration;
    easing: typeof easing;
    spring: typeof spring;
  };
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const scheme: AppColorScheme = colorScheme === 'light' ? 'light' : 'dark';

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: colors[scheme],
      spacing,
      typography,
      motion: { duration, easing, spring },
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}

export { colors, spacing, typography, duration, easing, spring };
