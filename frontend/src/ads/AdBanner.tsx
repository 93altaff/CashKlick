import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { api } from '../api';
import { COLORS } from '../theme';
import { isRunningInExpoGo } from './env';
import { loadAdsModule, initMobileAds, TEST_AD_IDS } from './loader';

type AdsConfig = {
  app_id?: string;
  banner?: string;
  native?: string;
  rewarded?: string;
  interstitial?: string;
};

let cached: AdsConfig | null = null;
export async function getAdsConfig(): Promise<AdsConfig> {
  if (cached) return cached;
  try {
    const cfg = await api('/config');
    cached = (cfg?.admob || {}) as AdsConfig;
  } catch {
    cached = {};
  }
  return cached;
}

function unitId(kind: 'banner' | 'native' | 'rewarded' | 'interstitial', cfg: AdsConfig): string {
  const fromCfg = cfg[kind];
  if (fromCfg && fromCfg.trim()) return fromCfg.trim();
  return TEST_AD_IDS[kind];
}

/**
 * AdBanner — small in-flow banner used as the "native ad" placement
 * (react-native-google-mobile-ads doesn't expose true native ads).
 * Renders a styled "Sponsored" placeholder card in Expo Go.
 */
export function AdBanner({ kind = 'native', style }: { kind?: 'banner' | 'native'; style?: any }) {
  const [cfg, setCfg] = useState<AdsConfig | null>(null);
  const [ready, setReady] = useState(false);
  const inExpoGo = isRunningInExpoGo();

  useEffect(() => {
    getAdsConfig().then(setCfg);
    if (!inExpoGo) initMobileAds().then(setReady);
  }, [inExpoGo]);

  const mod = !inExpoGo ? loadAdsModule() : null;
  const BannerAd = mod?.BannerAd;
  const BannerAdSize = mod?.BannerAdSize;

  // Real ad path — dev build only.
  if (BannerAd && ready && cfg) {
    const id = unitId(kind === 'native' ? 'native' : 'banner', cfg);
    return (
      <View style={[styles.wrap, style]} testID={`ad-${kind}`}>
        <Text style={styles.label}>SPONSORED</Text>
        <BannerAd
          unitId={id}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER || BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    );
  }

  // Placeholder (Expo Go / pre-init).
  return (
    <View style={[styles.wrap, style]} testID={`ad-${kind}-placeholder`}>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderLabel}>SPONSORED</Text>
        <Text style={styles.placeholderText}>
          {kind === 'native' ? 'Native Ad' : 'Banner Ad'} · ads load in dev build
        </Text>
        <Text style={styles.placeholderId} numberOfLines={1}>
          {unitId(kind === 'native' ? 'native' : 'banner', cfg || {})}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  label: {
    color: COLORS.textDisabled,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  placeholder: {
    width: '100%',
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  placeholderLabel: {
    color: COLORS.textDisabled,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  placeholderText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  placeholderId: { color: COLORS.textDisabled, fontSize: 10, marginTop: 4 },
});
