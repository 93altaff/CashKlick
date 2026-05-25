import Constants from 'expo-constants';

export const API_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || '') + '/api';

export const COLORS = {
  bg: '#09090B',
  surface: '#18181B',
  surfaceElevated: '#27272A',
  glass: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.1)',
  primary: '#10B981',
  primaryHover: '#059669',
  secondary: '#F59E0B',
  secondaryHover: '#D97706',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textDisabled: '#52525B',
  danger: '#EF4444',
  info: '#3B82F6',
};

export const POINTS_PER_RUPEE = 100;
