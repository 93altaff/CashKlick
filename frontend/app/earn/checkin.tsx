import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Flame, CircleCheck as CheckCircle2, Lock } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';

const REWARDS = [10, 20, 30, 40, 50, 60, 100];

export default function CheckinScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { (async () => { try { setUser(await api('/auth/me')); } catch {} })(); }, []);

  // IST date (UTC+5:30) — matches backend's day boundary at 00:00 IST.
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const streak = user?.streak || 0;
  const checkedToday = user?.last_checkin === today;

  const doCheckin = async () => {
    setLoading(true);
    try {
      const r = await api('/earn/checkin', { method: 'POST' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Check-in successful!', `+${r.points} points · ${r.streak}-day streak`);
      const u = await api('/auth/me'); setUser(u);
    } catch (e: any) { Alert.alert('Notice', e.message); }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
        <Text style={styles.headTitle}>Daily Check-in</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.streakCard}>
          <Flame color={COLORS.secondary} size={64} />
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>DAY STREAK</Text>
        </View>
        <Text style={styles.sub}>Check in every day. Miss a day — streak resets.</Text>

        <View style={styles.row7}>
          {REWARDS.map((pts, i) => {
            const day = i + 1;
            const achieved = streak >= day;
            const isToday = streak === day - 1 && !checkedToday;
            return (
              <View key={i} style={[styles.day, achieved && styles.dayDone, isToday && styles.dayToday]}>
                {achieved ? <CheckCircle2 color={COLORS.primary} size={18} /> : isToday ? <Flame color={COLORS.secondary} size={18} /> : <Lock color={COLORS.textDisabled} size={16} />}
                <Text style={[styles.dayNum, achieved && { color: COLORS.primary }]}>Day {day}</Text>
                <Text style={styles.dayPts}>+{pts}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.btn, checkedToday && { opacity: 0.5 }]} onPress={doCheckin} disabled={checkedToday || loading} testID="checkin-btn">
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>{checkedToday ? 'Already checked in today' : 'Check in now'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  streakCard: { alignItems: 'center', paddingVertical: 24, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },
  streakNum: { color: COLORS.text, fontSize: 64, fontWeight: '900', letterSpacing: -2, marginTop: 8 },
  streakLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  sub: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  row7: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  day: { width: 90, padding: 12, alignItems: 'center', borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  dayDone: { borderColor: COLORS.primary, backgroundColor: 'rgba(16,185,129,0.08)' },
  dayToday: { borderColor: COLORS.secondary, backgroundColor: 'rgba(245,158,11,0.08)' },
  dayNum: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginTop: 6 },
  dayPts: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  btn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 100, alignItems: 'center', marginTop: 24 },
  btnTxt: { color: '#000', fontWeight: '800', fontSize: 15 },
});
