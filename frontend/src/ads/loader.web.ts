import { Platform } from 'react-native';

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

// Web stub: AdMob's native module isn't available on web — always no-op.
export function loadAdsModule(): any | null {
  return null;
}

export async function initMobileAds(): Promise<boolean> {
  return false;
}
