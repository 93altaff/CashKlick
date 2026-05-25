import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Linking, Alert, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Video as Youtube, Send, CircleCheck as CheckCircle2 } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try { const t = await api(`/tasks/${id}`); setTask(t); } catch (e: any) { Alert.alert('Error', e.message); }
  };
  useEffect(() => { load(); }, [id]);

  if (!task) return <View style={styles.c}><ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} /></View>;

  const status = task.submission?.status;
  const isPending = status === 'pending';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const isPaid = status === 'payment_received';

  const openYT = () => task.youtube_url && Linking.openURL(task.youtube_url);
  const openTG = () => task.telegram_url && Linking.openURL(task.telegram_url);
  const openStart = () => {
    if (task.task_url) Linking.openURL(task.task_url);
    setShowForm(true);
  };

  const submit = async () => {
    if (task.require_mobile && !mobile) return Alert.alert('Missing', 'Please enter mobile number');
    if (task.require_email && !email) return Alert.alert('Missing', 'Please enter email');
    setSubmitting(true);
    try {
      await api(`/tasks/${task.id}/submit`, { method: 'POST', body: JSON.stringify({ mobile, email }) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Submitted', 'Your task is pending admin approval.');
      setShowForm(false);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSubmitting(false);
  };

  const paymentReceived = async () => {
    setSubmitting(true);
    try {
      await api(`/tasks/${task.id}/payment-received`, { method: 'POST' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Recorded', 'Payment recorded in your withdrawal history.');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSubmitting(false);
  };

  // Tasks with screenshot=true now use mobile+email only.
  const needsForm = !!(task.require_mobile || task.require_email);

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn"><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
          <Text style={styles.headTitle} numberOfLines={1}>{task.name}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            {task.logo ? <Image source={{ uri: task.logo }} style={styles.logo} /> : <View style={[styles.logo, { backgroundColor: COLORS.surfaceElevated }]} />}
            <Text style={styles.name}>{task.name}</Text>
            <Text style={styles.note}>{task.note}</Text>
            <View style={styles.pointsBox}>
              <Text style={styles.pointsRupees}>₹{(task.points / 100).toFixed(0)}</Text>
              <Text style={styles.pointsPts}>{task.points} points</Text>
            </View>
          </View>

          {(isPending || isApproved || isRejected || isPaid) && (
            <View style={[styles.statusCard, isRejected && { borderColor: COLORS.danger }, isApproved && { borderColor: COLORS.primary }]}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusVal, isRejected ? { color: COLORS.danger } : isApproved ? { color: COLORS.primary } : isPaid ? { color: COLORS.info } : { color: COLORS.secondary }]}>
                {isPending ? 'PENDING APPROVAL' : isApproved ? 'APPROVED — POINTS CREDITED' : isRejected ? 'REJECTED' : 'PAYMENT RECEIVED'}
              </Text>
              {!!task.submission?.reject_note && <Text style={styles.rejNote}>{task.submission.reject_note}</Text>}
            </View>
          )}

          <Text style={styles.section}>Rules & Instructions</Text>
          <View style={styles.box}><Text style={styles.rules}>{task.rules}</Text></View>

          {!!task.youtube_url && (
            <TouchableOpacity style={styles.ytBtn} onPress={openYT} testID="yt-btn">
              <Youtube color="#EF4444" size={20} /><Text style={styles.ytTxt}>Watch tutorial video</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.tgBtn} onPress={openTG} testID="tg-btn">
            <Send color="#2AABEE" size={20} /><Text style={styles.tgTxt}>Contact on Telegram</Text>
          </TouchableOpacity>

          {!isPending && !isApproved && !isPaid && !showForm && (
            <TouchableOpacity style={[styles.startBtn, isRejected && { backgroundColor: COLORS.danger }]} onPress={() => isRejected ? Alert.alert('Rejected', task.submission?.reject_note || 'Contact support') : openStart()} testID="start-btn">
              <Text style={styles.startBtnTxt}>{isRejected ? 'REJECTED' : 'Start Task'}</Text>
            </TouchableOpacity>
          )}

          {showForm && !isPending && !isApproved && !isPaid && (
            <View style={styles.form}>
              <Text style={styles.section}>Submit Details</Text>
              {task.require_mobile && (
                <>
                  <Text style={styles.label}>Mobile Number</Text>
                  <TextInput style={styles.input} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="10-digit mobile" placeholderTextColor={COLORS.textDisabled} testID="mobile-input" />
                </>
              )}
              {task.require_email && (
                <>
                  <Text style={styles.label}>Email ID</Text>
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@email.com" placeholderTextColor={COLORS.textDisabled} testID="email-input" />
                </>
              )}

              {needsForm ? (
                <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting} testID="submit-btn">
                  {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitTxt}>Submit for Approval</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: COLORS.info }]} onPress={paymentReceived} disabled={submitting} testID="payment-received-btn">
                  {submitting ? <ActivityIndicator color="#000" /> : (
                    <><CheckCircle2 color="#000" size={20} /><Text style={styles.submitTxt}>Payment Received</Text></>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', flex: 1 },
  heroCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 22, alignItems: 'center' },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 14 },
  name: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  note: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  pointsBox: { marginTop: 16, alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 16 },
  pointsRupees: { color: COLORS.primary, fontSize: 32, fontWeight: '900' },
  pointsPts: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  statusCard: { marginTop: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 16, padding: 16 },
  statusLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  statusVal: { fontSize: 15, fontWeight: '800', marginTop: 6, letterSpacing: 0.5 },
  rejNote: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  section: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 24, marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  box: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16 },
  rules: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  ytBtn: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  ytTxt: { color: COLORS.text, fontWeight: '700', marginLeft: 10 },
  tgBtn: { marginTop: 10, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  tgTxt: { color: COLORS.text, fontWeight: '700', marginLeft: 10 },
  startBtn: { marginTop: 20, backgroundColor: COLORS.primary, borderRadius: 100, padding: 16, alignItems: 'center' },
  startBtnTxt: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  form: { marginTop: 16 },
  label: { color: COLORS.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, color: COLORS.text, fontSize: 15 },
  submitBtn: { marginTop: 20, backgroundColor: COLORS.primary, borderRadius: 100, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  submitTxt: { color: '#000', fontSize: 16, fontWeight: '800', marginLeft: 8 },
});
