import { Easing } from 'react-native';

export const duration = {
  instant: 100,
  fast: 150,
  base: 250,
  slow: 350,
  deliberate: 500,
} as const;

export const easing = {
  standard: Easing.bezier(0.22, 1, 0.36, 1),
  entrance: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
} as const;

export const spring = {
  damping: 18,
  stiffness: 180,
  mass: 0.9,
} as const;
