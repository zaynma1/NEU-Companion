export const colors = {
  light: {
    primary: '#BB1B3A',
    primaryPressed: '#972037',
    onPrimary: '#FFFFFF',
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    border: '#E5E5E5',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textMuted: '#9B9B9B',
    success: '#15803D',
    warning: '#B45309',
    info: '#1D4ED8',
    danger: '#DC2626',
  },
  dark: {
    primary: '#BB1B3A',
    primaryPressed: '#D41137',
    onPrimary: '#FFFFFF',
    bg: '#121212',
    surface: '#1E1E1E',
    border: '#2E2E2E',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    textMuted: '#7A7A7A',
    success: '#4ADE80',
    warning: '#FBBF24',
    info: '#60A5FA',
    danger: '#F87171',
  },
} as const;

export type AppColorScheme = keyof typeof colors;
