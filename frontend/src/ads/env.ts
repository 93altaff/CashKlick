import Constants from 'expo-constants';

/**
 * Returns true when the app is running inside Expo Go. In that case the
 * react-native-google-mobile-ads native module is NOT available, so any
 * code that imports it must be skipped (otherwise we crash on load).
 */
export function isRunningInExpoGo(): boolean {
  // appOwnership === 'expo' means Expo Go; 'standalone' / 'guest' / undefined
  // (executionEnvironment === 'storeClient' also indicates Expo Go).
  const ownership = (Constants as any).appOwnership;
  const env = (Constants as any).executionEnvironment;
  if (ownership === 'expo') return true;
  if (env === 'storeClient') return true;
  return false;
}
