import { useEffect, useRef, useState, useCallback } from 'react';
import { getAdsConfig } from './AdBanner';
import { isRunningInExpoGo } from './env';
import { loadAdsModule, initMobileAds, TEST_AD_IDS } from './loader';

type Result = {
  loaded: boolean;
  /** Show ad. Resolves to true if the user earned the reward, false if closed early. */
  show: () => Promise<boolean>;
};

/**
 * Hook for a single rewarded ad slot.
 * In Expo Go (no native module) it resolves immediately with reward=true so
 * the rest of the flow keeps working in preview; real builds gate on the
 * actual EARNED_REWARD event before counting it.
 */
export function useRewardedAd(): Result {
  const [loaded, setLoaded] = useState(false);
  const refAd = useRef<any>(null);
  const refResolve = useRef<((v: boolean) => void) | null>(null);
  const earnedRef = useRef(false);

  const isExpoGo = isRunningInExpoGo();

  const buildAndLoad = useCallback(async () => {
    if (isExpoGo) { setLoaded(true); return; }
    const mod = loadAdsModule();
    if (!mod) { setLoaded(true); return; }
    await initMobileAds();
    const cfg = await getAdsConfig();
    const unit = (cfg.rewarded && cfg.rewarded.trim()) || TEST_AD_IDS.rewarded;
    const { RewardedAd, AdEventType, RewardedAdEventType } = mod;
    const ad = RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: true });
    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => setLoaded(true));
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedRef.current = true;
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      const wasEarned = earnedRef.current;
      earnedRef.current = false;
      setLoaded(false);
      if (refResolve.current) {
        refResolve.current(wasEarned);
        refResolve.current = null;
      }
      // pre-load the next ad
      try { ad.load(); } catch {}
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      if (refResolve.current) { refResolve.current(false); refResolve.current = null; }
    });
    refAd.current = { ad, unsub: [unsubLoaded, unsubEarned, unsubClosed, unsubError] };
    try { ad.load(); } catch {}
  }, [isExpoGo]);

  useEffect(() => {
    buildAndLoad();
    return () => {
      try { (refAd.current?.unsub || []).forEach((u: any) => u && u()); } catch {}
    };
  }, [buildAndLoad]);

  const show = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (isExpoGo || !refAd.current?.ad) {
        // No native ad available — treat as auto-completed so preview flows work.
        resolve(true);
        return;
      }
      refResolve.current = resolve;
      try { refAd.current.ad.show(); } catch { resolve(false); refResolve.current = null; }
    });
  }, [isExpoGo]);

  return { loaded, show };
}
