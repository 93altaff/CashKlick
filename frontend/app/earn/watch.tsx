import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Video as Youtube, CircleCheck as CheckCircle2 } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';

export default function WatchScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const load = async () => { try { setVideos(await api('/watch')); } catch {} };
  useEffect(() => { load(); }, []);

  const complete = async (v: any) => {
    Linking.openURL(v.youtube_url);
    setTimeout(async () => {
      try { await api(`/watch/${v.id}/complete`, { method: 'POST' }); Alert.alert('+100 points!'); load(); } catch (e: any) { Alert.alert('Error', e.message); }
    }, 10000);
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
        <Text style={styles.headTitle}>Watch & Earn</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {videos.map((v) => (
          <View key={v.id} style={styles.card}>
            <View style={styles.icon}><Youtube color="#EF4444" size={32} /></View>
            <Text style={styles.title} numberOfLines={2}>{v.title}</Text>
            {v.completed ? (
              <View style={styles.doneTag}><CheckCircle2 color={COLORS.primary} size={16} /><Text style={styles.doneTxt}>Earned 100 pts</Text></View>
            ) : (
              <TouchableOpacity style={styles.btn} onPress={() => complete(v)} testID={`watch-${v.id}`}>
                <Text style={styles.btnTxt}>Watch & Earn ₹1</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <View style={styles.nativeAd}>
          <Text style={styles.adLabel}>NATIVE AD</Text>
          <Text style={styles.adTxt}>ca-app-pub-7744865309171344/5951555040</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 18, marginBottom: 12, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  btn: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 100 },
  btnTxt: { color: '#000', fontWeight: '800' },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  doneTxt: { color: COLORS.primary, fontWeight: '700', marginLeft: 6 },
  nativeAd: { backgroundColor: '#111113', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 },
  adLabel: { color: COLORS.textDisabled, fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  adTxt: { color: COLORS.textDisabled, fontSize: 10, marginTop: 2 },
});
