import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';

export default function WalletTab() {
  const router = useRouter();
  const [data, setData] = useState<any>({ points: 0, rupees: 0, transactions: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const d = await api('/wallet'); setData(d); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <WalletIcon color={COLORS.primary} size={28} />
          <Text style={styles.t1}>Wallet</Text>
        </View>

        <View style={styles.bal} testID="wallet-balance-card">
          <Text style={styles.balLabel}>AVAILABLE BALANCE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={styles.balRupees}>₹{data.rupees.toFixed(2)}</Text>
          </View>
          <Text style={styles.balPts} testID="wallet-points">{data.points} points · 100 pts = ₹1</Text>
          <TouchableOpacity style={styles.wdBtn} onPress={() => router.push('/withdraw' as any)} testID="wallet-withdraw-btn">
            <Text style={styles.wdBtnTxt}>Withdraw to Cash</Text>
            <ArrowUpRight color="#000" size={18} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Transaction History</Text>
        <View style={{ paddingHorizontal: 16 }}>
          {data.transactions.map((t: any) => (
            <View key={t.id} style={styles.row} testID={`tx-${t.id}`}>
              <View style={[styles.rowIcon, { backgroundColor: t.points >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                {t.points >= 0 ? <ArrowDownLeft color={COLORS.primary} size={18} /> : <ArrowUpRight color={COLORS.danger} size={18} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t.note || t.source}</Text>
                <Text style={styles.rowSub}>{new Date(t.created_at).toLocaleString()}</Text>
              </View>
              <Text style={[styles.rowPts, { color: t.points >= 0 ? COLORS.primary : COLORS.danger }]}>{t.points > 0 ? '+' : ''}{t.points}</Text>
            </View>
          ))}
          {data.transactions.length === 0 && <Text style={styles.empty}>No transactions yet. Start earning!</Text>}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  t1: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginLeft: 12 },
  bal: { marginHorizontal: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 24, padding: 24, overflow: 'hidden' },
  balLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  balRupees: { color: COLORS.text, fontSize: 46, fontWeight: '900', marginTop: 8, letterSpacing: -2 },
  balPts: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  wdBtn: { marginTop: 20, backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  wdBtnTxt: { color: '#000', fontWeight: '800', fontSize: 15, marginRight: 6 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  rowPts: { fontSize: 15, fontWeight: '800' },
  empty: { color: COLORS.textSecondary, padding: 24, textAlign: 'center' },
});
