import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Gift } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';

export default function ScratchScreen() {
  const router = useRouter();
  const [state, setState] = useState<any>({ used: 0, limit: 10, remaining: 10 });
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const load = async () => { try { setState(await api('/earn/scratch/state')); } catch {} };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (cooldown > 0) { const t = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(t); }}, [cooldown]);

  const scratch = async () => {
    if (loading || cooldown > 0) return;
    if (state.remaining <= 0) return Alert.alert('Limit reached');
    setLoading(true);
    try {
      const r = await api('/earn/scratch', { method: 'POST' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRevealed(r.points);
      setState((s: any) => ({ ...s, remaining: r.remaining, used: s.used + 1 }));
      setCooldown(2);
      setTimeout(() => setRevealed(null), 2500);
    } catch (e: any) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
        <Text style={styles.headTitle}>Scratch & Earn</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>CARDS LEFT TODAY</Text>
          <Text style={styles.infoVal}>{state.remaining} / {state.limit}</Text>
        </View>

        <View style={styles.card}>
          {revealed ? (
            <>
              <Text style={styles.won}>🎉 YOU WON</Text>
              <Text style={styles.pts}>+{revealed}</Text>
              <Text style={styles.sub}>points</Text>
            </>
          ) : (
            <>
              <Gift color={COLORS.secondary} size={64} />
              <Text style={styles.tapTxt}>Tap to scratch</Text>
            </>
          )}
        </View>

        <TouchableOpacity style={[styles.btn, (loading || cooldown > 0 || state.remaining <= 0) && { opacity: 0.5 }]} onPress={scratch} disabled={loading || cooldown > 0 || state.remaining <= 0} testID="scratch-btn">
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>{cooldown > 0 ? `Next in ${cooldown}s · Ad` : 'SCRATCH CARD'}</Text>}
        </TouchableOpacity>

        {cooldown > 0 && (
          <View style={styles.adBox}>
            <Text style={styles.adLabel}>REWARDED AD</Text>
            <Text style={styles.adTxt}>ca-app-pub-7744865309171344/8895153865</Text>
          </View>
        )}

        <View style={styles.nativeAd}>
          <Text style={styles.adLabel}>NATIVE AD</Text>
          <Text style={styles.adTxt}>ca-app-pub-7744865309171344/5951555040</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', padding: 20 },
  infoCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, alignItems: 'center', marginBottom: 24 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  infoVal: { color: COLORS.primary, fontSize: 28, fontWeight: '900', marginTop: 4 },
  card: { width: 260, height: 260, borderRadius: 24, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  won: { color: COLORS.secondary, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  pts: { color: COLORS.primary, fontSize: 72, fontWeight: '900', letterSpacing: -3 },
  sub: { color: COLORS.textSecondary, fontSize: 14 },
  tapTxt: { color: COLORS.textSecondary, fontSize: 15, marginTop: 16 },
  btn: { backgroundColor: COLORS.secondary, paddingVertical: 16, paddingHorizontal: 60, borderRadius: 100, marginBottom: 16 },
  btnTxt: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  adBox: { backgroundColor: '#111113', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, width: '90%', alignItems: 'center', marginBottom: 12 },
  nativeAd: { backgroundColor: '#111113', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, width: '90%', alignItems: 'center', marginTop: 'auto' },
  adLabel: { color: COLORS.textDisabled, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  adTxt: { color: COLORS.textDisabled, fontSize: 10, marginTop: 2 },
});
