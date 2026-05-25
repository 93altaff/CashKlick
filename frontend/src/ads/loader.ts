import { Platform } from 'react-native';
import { isRunningInExpoGo } from './env';

// Google's official test ad unit IDs (per-platform).
export const TEST_AD_IDS = {
  banner: Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/2934735716'
    : 'ca-app-pub-3940256099942544/6300978111',
  rewarded: Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/1712485313'
    : 'ca-app-pub-3940256099942544/5224354917',
  native: Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/3986624511'
    : 'ca-app-pub-3940256099942544/2247696110',
  interstitial: Platform.OS === 'ios'
    ? 'ca-app-pub-3940256099942544/4411468910'
    : 'ca-app-pub-3940256099942544/1033173712',
};

let _module: any = null;
let _initPromise: Promise<boolean> | null = null;

/**
 * Lazily load react-native-google-mobile-ads. Returns null when running in
 * Expo Go (the native module is not present) — callers must render a
 * placeholder in that case.
 */
export function loadAdsModule(): any | null {
  if (isRunningInExpoGo()) return null;
  if (_module) return _module;
  try {
    // require() so Metro / Hermes only resolves it at first call.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _module = require('react-native-google-mobile-ads');
    return _module;
  } catch {
    return null;
  }
}

export async function initMobileAds(): Promise<boolean> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const mod = loadAdsModule();
    if (!mod) return false;
    try {
      const mobileAds = mod.default;
      await mobileAds().initialize();
      return true;
    } catch {
      return false;
    }
  })();
  return _initPromise;
}
