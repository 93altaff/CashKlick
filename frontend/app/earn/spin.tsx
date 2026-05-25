import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';

const SLICES = ['50', '60', '70', '80', '90', '100', '55', '75'];
const COLORS_W = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export default function SpinScreen() {
  const router = useRouter();
  const [state, setState] = useState<any>({ used: 0, limit: 10, remaining: 10 });
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const rot = useRef(new Animated.Value(0)).current;
  const [lastWin, setLastWin] = useState<number | null>(null);

  const load = async () => { try { setState(await api('/earn/spin/state')); } catch {} };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const spin = async () => {
    if (loading || cooldown > 0) return;
    if (state.remaining <= 0) return Alert.alert('Limit reached', 'Come back tomorrow!');
    setLoading(true);
    try {
      const res = await api('/earn/spin', { method: 'POST' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const idx = Math.floor(Math.random() * SLICES.length);
      const rounds = 5;
      const target = rounds * 360 + idx * (360 / SLICES.length);
      rot.setValue(0);
      Animated.timing(rot, { toValue: target, duration: 2500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
        setLastWin(res.points);
        Alert.alert('🎉 You won!', `+${res.points} points`);
        setState((s: any) => ({ ...s, remaining: res.remaining, used: s.used + 1 }));
        setCooldown(2);
      });
    } catch (e: any) { Alert.alert('Error', e.message); }
    setLoading(false);
  };

  const rotate = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const size = 280, r = 130, cx = size/2, cy = size/2;

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
        <Text style={styles.headTitle}>Spin & Win</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>SPINS LEFT TODAY</Text>
          <Text style={styles.infoVal}>{state.remaining} / {state.limit}</Text>
        </View>

        <View style={styles.wheelWrap}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Svg width={size} height={size}>
              <G>
                {SLICES.map((lbl, i) => {
                  const a = (360 / SLICES.length);
                  const a1 = (i * a - 90) * Math.PI / 180;
                  const a2 = ((i+1) * a - 90) * Math.PI / 180;
                  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
                  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
                  const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z`;
                  const tx = cx + (r * 0.65) * Math.cos((a1 + a2) / 2);
                  const ty = cy + (r * 0.65) * Math.sin((a1 + a2) / 2);
                  return (
                    <G key={i}>
                      <Path d={d} fill={COLORS_W[i]} stroke="#000" strokeWidth="2" />
                      <SvgText x={tx} y={ty} fill="#fff" fontSize="18" fontWeight="800" textAnchor="middle">{lbl}</SvgText>
                    </G>
                  );
                })}
              </G>
              <Circle cx={cx} cy={cy} r={24} fill="#000" stroke={COLORS.primary} strokeWidth="3" />
            </Svg>
          </Animated.View>
          <View style={styles.pointer} />
        </View>

        <TouchableOpacity style={[styles.spinBtn, (loading || cooldown > 0 || state.remaining <= 0) && { opacity: 0.5 }]} onPress={spin} disabled={loading || cooldown > 0 || state.remaining <= 0} testID="spin-btn">
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.spinBtnTxt}>{cooldown > 0 ? `Next in ${cooldown}s · Ad` : 'SPIN NOW'}</Text>}
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
  wheelWrap: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  pointer: { position: 'absolute', top: -6, width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderBottomWidth: 24, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.secondary },
  spinBtn: { backgroundColor: COLORS.secondary, paddingVertical: 16, paddingHorizontal: 60, borderRadius: 100, marginBottom: 16 },
  spinBtnTxt: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  adBox: { backgroundColor: '#111113', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, width: '90%', alignItems: 'center', marginBottom: 12 },
  nativeAd: { backgroundColor: '#111113', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, width: '90%', alignItems: 'center', marginTop: 'auto' },
  adLabel: { color: COLORS.textDisabled, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  adTxt: { color: COLORS.textDisabled, fontSize: 10, marginTop: 2 },
});
