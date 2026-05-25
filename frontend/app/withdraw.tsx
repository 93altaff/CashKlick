import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Smartphone, Landmark } from 'lucide-react-native';
import { COLORS } from '../src/theme';
import { api } from '../src/api';

export default function WithdrawScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ withdraw_amounts: [1, 100, 300, 500] });
  const [history, setHistory] = useState<any[]>([]);
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [amount, setAmount] = useState<number | null>(null);
  const [upi, setUpi] = useState(''); const [accNo, setAccNo] = useState(''); const [ifsc, setIfsc] = useState(''); const [holder, setHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try { const [u, c, h] = await Promise.all([api('/auth/me'), api('/config'), api('/withdrawals')]); setUser(u); setConfig(c); setHistory(h); } catch {}
  };
  useEffect(() => { load(); }, []);

  let amounts: number[] = config.withdraw_amounts || [1, 100, 300, 500];
  if (user?.first_withdrawal_done) amounts = amounts.filter((a: number) => a !== 1);

  const submit = async () => {
    const missing: string[] = [];
    if (!amount) missing.push('amount');
    if (method === 'upi' && !upi) missing.push('UPI ID');
    if (method === 'bank' && (!accNo || !ifsc)) missing.push('bank details');
    if (missing.length) return Alert.alert('Missing', `Please fill: ${missing.join(', ')}`);
    if ((user?.points || 0) < amount! * 100) return Alert.alert('Insufficient points', `You need ${amount! * 100} pts`);
    setSubmitting(true);
    try {
      await api('/withdrawals', { method: 'POST', body: JSON.stringify({ amount_rupees: amount, method, upi_id: upi, account_no: accNo, ifsc, account_holder: holder }) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Withdrawal submitted successfully! It will be processed within 24 hours.');
      setAmount(null); setUpi(''); setAccNo(''); setIfsc(''); setHolder('');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
          <Text style={styles.headTitle}>Withdraw</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.bal}>
            <Text style={styles.balLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.balVal}>₹{((user?.points || 0) / 100).toFixed(2)}</Text>
            <Text style={styles.balPts}>{user?.points || 0} points</Text>
          </View>

          <Text style={styles.section}>Select Method</Text>
          <View style={styles.methods}>
            <TouchableOpacity style={[styles.methodBtn, method === 'upi' && styles.methodBtnSel]} onPress={() => setMethod('upi')} testID="method-upi">
              <Smartphone color={method === 'upi' ? COLORS.primary : COLORS.textSecondary} size={20} />
              <Text style={[styles.methodTxt, method === 'upi' && { color: COLORS.primary }]}>UPI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.methodBtn, method === 'bank' && styles.methodBtnSel]} onPress={() => setMethod('bank')} testID="method-bank">
              <Landmark color={method === 'bank' ? COLORS.primary : COLORS.textSecondary} size={20} />
              <Text style={[styles.methodTxt, method === 'bank' && { color: COLORS.primary }]}>Bank Account</Text>
            </TouchableOpacity>
          </View>

          {method === 'upi' ? (
            <>
              <Text style={styles.label}>UPI ID</Text>
              <TextInput style={styles.input} value={upi} onChangeText={setUpi} placeholder="yourname@upi" placeholderTextColor={COLORS.textDisabled} autoCapitalize="none" testID="upi-input" />
            </>
          ) : (
            <>
              <Text style={styles.label}>Account Holder Name</Text>
              <TextInput style={styles.input} value={holder} onChangeText={setHolder} placeholder="As per bank" placeholderTextColor={COLORS.textDisabled} testID="holder-input" />
              <Text style={styles.label}>Account Number</Text>
              <TextInput style={styles.input} value={accNo} onChangeText={setAccNo} keyboardType="number-pad" placeholder="XXXXXXXXX" placeholderTextColor={COLORS.textDisabled} testID="acc-input" />
              <Text style={styles.label}>IFSC Code</Text>
              <TextInput style={styles.input} value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" placeholder="HDFC0001234" placeholderTextColor={COLORS.textDisabled} testID="ifsc-input" />
            </>
          )}

          <Text style={styles.section}>Amount</Text>
          <View style={styles.amts}>
            {amounts.map((a: number) => (
              <TouchableOpacity key={a} style={[styles.amt, amount === a && styles.amtSel]} onPress={() => setAmount(a)} testID={`amt-${a}`}>
                <Text style={[styles.amtTxt, amount === a && { color: '#000', fontWeight: '900' }]}>₹{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.submit, !amount && { opacity: 0.5 }]} onPress={submit} disabled={submitting} testID="wd-submit">
            {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitTxt}>Withdraw ₹{amount || 0}</Text>}
          </TouchableOpacity>

          <Text style={styles.section}>Withdrawal History</Text>
          {history.map((w: any) => (
            <View key={w.id} style={styles.wdRow} testID={`wd-${w.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wdAmt}>₹{w.amount_rupees}</Text>
                <Text style={styles.wdMeta}>{w.method.toUpperCase()} · {new Date(w.created_at).toLocaleString()}</Text>
                {w.upi_id && <Text style={styles.wdDetails}>{w.upi_id}</Text>}
                {w.account_no && <Text style={styles.wdDetails}>{w.account_no} · {w.ifsc}</Text>}
                {w.reject_note && <Text style={styles.wdNote}>Note: {w.reject_note}</Text>}
              </View>
              <View style={[styles.statusTag,
                w.status === 'success' ? { backgroundColor: 'rgba(16,185,129,0.15)' } :
                w.status === 'rejected' ? { backgroundColor: 'rgba(239,68,68,0.15)' } :
                { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                <Text style={[styles.statusTxt,
                  w.status === 'success' ? { color: COLORS.primary } :
                  w.status === 'rejected' ? { color: COLORS.danger } :
                  { color: COLORS.secondary }]}>{w.status.toUpperCase()}</Text>
              </View>
            </View>
          ))}
          {history.length === 0 && <Text style={styles.empty}>No withdrawals yet</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  bal: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 20, alignItems: 'center' },
  balLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  balVal: { color: COLORS.text, fontSize: 42, fontWeight: '900', marginTop: 6, letterSpacing: -2 },
  balPts: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  section: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  methods: { flexDirection: 'row', gap: 10 },
  methodBtn: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center', gap: 8 },
  methodBtnSel: { borderColor: COLORS.primary, backgroundColor: 'rgba(16,185,129,0.08)' },
  methodTxt: { color: COLORS.textSecondary, fontWeight: '700', marginTop: 4 },
  label: { color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, color: COLORS.text, fontSize: 15 },
  amts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amt: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 100, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, minWidth: 70, alignItems: 'center' },
  amtSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  amtTxt: { color: COLORS.text, fontWeight: '700' },
  submit: { backgroundColor: COLORS.secondary, padding: 16, borderRadius: 100, alignItems: 'center', marginTop: 20 },
  submitTxt: { color: '#000', fontWeight: '800', fontSize: 16 },
  wdRow: { flexDirection: 'row', padding: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, marginBottom: 10 },
  wdAmt: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  wdMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  wdDetails: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  wdNote: { color: COLORS.danger, fontSize: 11, marginTop: 4 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, alignSelf: 'flex-start' },
  statusTxt: { fontSize: 10, fontWeight: '800' },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 16 },
});
