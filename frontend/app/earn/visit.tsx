import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Linking, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CircleCheck as CheckCircle2, Globe, Clock, AlertTriangle } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';
import { AdBanner } from '../../src/ads/AdBanner';

const STAY_SECONDS = 15;

type Site = { id: string; name: string; url: string; completed_today?: boolean };

export default function VisitScreen() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [active, setActive] = useState<Site | null>(null);
  const [deadline, setDeadline] = useState<number>(0); // ms epoch when stay is fulfilled
  const [now, setNow] = useState<number>(Date.now());
  const [earlyReturn, setEarlyReturn] = useState(false);
  const tickRef = useRef<any>(null);
  const leftAtRef = useRef<number>(0);

  const load = async () => {
    try { setSites(await api('/visits')); } catch {}
  };
  useEffect(() => { load(); }, []);

  // Timer tick.
  useEffect(() => {
    if (!deadline) return;
    tickRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tickRef.current);
  }, [deadline]);

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));

  // AppState — detect when user comes back from external browser.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        leftAtRef.current = Date.now();
      }
      if (state === 'active' && active) {
        const tNow = Date.now();
        if (tNow >= deadline) {
          // Timer fulfilled — credit and clear.
          try {
            const r = await api(`/visits/${active.id}/complete`, { method: 'POST' });
            Alert.alert('Reward earned', `You earned +${r.points} points!`);
          } catch (e: any) {
            Alert.alert('Already done', e.message || 'This site is already completed today.');
          }
          setActive(null);
          setDeadline(0);
          setEarlyReturn(false);
          load();
        } else {
          // User returned before timer ended.
          setEarlyReturn(true);
          setNow(Date.now());
        }
      }
    });
    return () => sub.remove();
  }, [active, deadline]);

  const start = async (s: Site) => {
    setActive(s);
    setDeadline(Date.now() + STAY_SECONDS * 1000);
    setEarlyReturn(false);
    setNow(Date.now());
    try { await Linking.openURL(s.url); } catch { Alert.alert('Error', 'Could not open URL'); }
  };

  const cancelActive = () => {
    setActive(null);
    setDeadline(0);
    setEarlyReturn(false);
  };

  const reopen = () => {
    if (active) Linking.openURL(active.url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn"><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headTitle}>Visit & Earn</Text>
          <Text style={styles.headSub}>Stay {STAY_SECONDS}s on site · 50–100 pts</Text>
        </View>
      </View>

      <FlatList
        data={sites}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            <AdBanner kind="native" style={{ marginBottom: 16 }} />
            {active && earlyReturn && remaining > 0 && (
              <View style={styles.warnCard} testID="visit-early-return">
                <View style={styles.warnIcon}><AlertTriangle color={COLORS.secondary} size={22} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.warnTitle}>You came back too early</Text>
                  <Text style={styles.warnSub}>Stay on <Text style={{ fontWeight: '800', color: COLORS.text }}>{active.name}</Text> for {remaining}s more to earn points.</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={styles.warnPrimary} onPress={reopen} testID="visit-reopen-btn"><Text style={styles.warnPrimaryTxt}>Reopen site</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.warnSecondary} onPress={cancelActive} testID="visit-cancel-btn"><Text style={styles.warnSecondaryTxt}>Cancel</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            {active && !earlyReturn && remaining > 0 && (
              <View style={styles.timerCard}>
                <Clock color={COLORS.primary} size={18} />
                <Text style={styles.timerTxt}>Stay on page · {remaining}s</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row} testID={`visit-card-${item.id}`}>
            <View style={styles.icon}><Globe color={COLORS.info} size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.url} numberOfLines={1}>{item.url}</Text>
            </View>
            {item.completed_today ? (
              <View style={styles.done}><CheckCircle2 color={COLORS.primary} size={20} /></View>
            ) : (
              <TouchableOpacity
                style={[styles.btn, !!active && active.id !== item.id && { opacity: 0.4 }]}
                onPress={() => start(item)}
                disabled={!!active && active.id !== item.id}
                testID={`visit-start-${item.id}`}
              >
                <Text style={styles.btnTxt}>Visit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No sites yet — check back later</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  headSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  warnCard: {
    flexDirection: 'row', gap: 14, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    marginBottom: 16,
  },
  warnIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.18)', alignItems: 'center', justifyContent: 'center' },
  warnTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  warnSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  warnPrimary: { backgroundColor: COLORS.secondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  warnPrimaryTxt: { color: '#000', fontWeight: '800', fontSize: 13 },
  warnSecondary: { backgroundColor: COLORS.surfaceElevated, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  warnSecondaryTxt: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  timerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', padding: 14, borderRadius: 14, marginBottom: 16 },
  timerTxt: { color: COLORS.primary, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center' },
  name: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  url: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  btn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 100 },
  btnTxt: { color: '#000', fontWeight: '800', fontSize: 13 },
  done: { padding: 10 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 24 },
});
