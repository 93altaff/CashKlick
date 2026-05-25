import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, Copy, Share2 } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';

export default function ReferScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  useEffect(() => { (async () => { try { setUser(await api('/auth/me')); } catch {} })(); }, []);

  const code = user?.referral_code || '------';
  const onShare = async () => {
    try {
      await Share.share({ message: `Join CashClick & earn ₹500+ daily! Use my code ${code} to sign up. https://cashclick.app/r/${code}` });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
        <Text style={styles.headTitle}>Refer & Earn</Text>
      </View>
      <View style={{ padding: 20 }}>
        <View style={styles.hero}>
          <View style={styles.iconBox}><Users color={COLORS.primary} size={40} /></View>
          <Text style={styles.big}>₹10 per friend</Text>
          <Text style={styles.sub}>Invite friends. When they complete a 7-day streak, you get ₹10.</Text>
        </View>

        <Text style={styles.label}>YOUR REFERRAL CODE</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{code}</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={onShare} testID="share-btn">
          <Share2 color="#000" size={20} /><Text style={styles.shareTxt}>Share with friends</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  hero: { alignItems: 'center', padding: 24, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, marginBottom: 20 },
  iconBox: { width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  big: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  sub: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, fontSize: 13 },
  label: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 8 },
  codeBox: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  code: { color: COLORS.primary, fontSize: 36, fontWeight: '900', letterSpacing: 6 },
  shareBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  shareTxt: { color: '#000', fontWeight: '800', fontSize: 15, marginLeft: 10 },
});
