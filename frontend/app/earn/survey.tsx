import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CircleCheck as CheckCircle2, ChevronRight } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api } from '../../src/api';
import { AdBanner } from '../../src/ads/AdBanner';
import { useRewardedAd } from '../../src/ads/useRewardedAd';

export default function SurveyScreen() {
  const router = useRouter();
  const [questions, setQuestions] = useState<any[]>([]);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { show: showRewardedAd } = useRewardedAd();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api('/survey/today');
      setQuestions(r.questions || []);
      setCompleted(!!r.completed);
    } catch (e: any) { Alert.alert('Error', e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const total = questions.length;
  const current = questions[step];
  const progress = total ? Math.round(((step + (answers[step] != null ? 1 : 0)) / total) * 100) : 0;

  const onPick = (j: number) => setAnswers((a) => ({ ...a, [step]: j }));

  const next = () => {
    if (answers[step] == null) return;
    if (step < total - 1) setStep(step + 1);
  };

  const submit = async () => {
    if (Object.keys(answers).length < total) {
      Alert.alert('Incomplete', `Please answer all ${total} questions`);
      return;
    }
    setSubmitting(true);
    Alert.alert('Watch ad', 'Watch a short ad to claim your reward', [
      { text: 'Cancel', style: 'cancel', onPress: () => setSubmitting(false) },
      {
        text: 'Watch',
        onPress: async () => {
          const earned = await showRewardedAd();
          if (!earned) {
            Alert.alert('Ad incomplete', 'You must finish watching the ad. Start the survey again to claim your reward.');
            setAnswers({}); setStep(0); setSubmitting(false); return;
          }
          try {
            const r = await api('/survey/submit', { method: 'POST', body: JSON.stringify({ answers, ad_watched: true }) });
            Alert.alert('Reward earned', `You earned +${r.points} points!`);
            setCompleted(true);
          } catch (e: any) { Alert.alert('Error', e.message); }
          setSubmitting(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn"><ArrowLeft color={COLORS.text} size={22} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headTitle}>Daily Survey</Text>
          <Text style={styles.headSub}>50–200 points · {total} questions</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={COLORS.primary} /></View>
      ) : completed ? (
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}><CheckCircle2 color={COLORS.primary} size={42} /></View>
          <Text style={styles.doneTitle}>Survey complete!</Text>
          <Text style={styles.doneSub}>Come back tomorrow for new questions.</Text>
          <AdBanner kind="native" style={{ marginTop: 32 }} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.progressOuter}><View style={[styles.progressInner, { width: `${progress}%` }]} /></View>
          <Text style={styles.stepCount}>Question {step + 1} / {total}</Text>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {current && (
              <View style={styles.qBox} testID={`survey-q-${step}`}>
                <Text style={styles.q}>{current.q}</Text>
                {current.options.map((opt: string, j: number) => (
                  <TouchableOpacity
                    key={j}
                    style={[styles.opt, answers[step] === j && styles.optSel]}
                    onPress={() => onPick(j)}
                    testID={`survey-opt-${step}-${j}`}
                  >
                    <View style={[styles.radio, answers[step] === j && styles.radioSel]}>
                      {answers[step] === j && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.optTxt, answers[step] === j && { color: COLORS.primary, fontWeight: '700' }]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {step < total - 1 ? (
              <TouchableOpacity
                style={[styles.nextBtn, answers[step] == null && { opacity: 0.4 }]}
                onPress={next}
                disabled={answers[step] == null}
                testID="survey-next"
              >
                <Text style={styles.nextTxt}>Next Question</Text>
                <ChevronRight color="#000" size={18} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitBtn, (submitting || answers[step] == null) && { opacity: 0.4 }]}
                onPress={submit}
                disabled={submitting || answers[step] == null}
                testID="survey-submit"
              >
                {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitTxt}>Watch Ad & Claim Reward</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.bottomAd}>
            <AdBanner kind="native" />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, marginRight: 12 },
  headTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  headSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneWrap: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 48 },
  doneIcon: { width: 90, height: 90, borderRadius: 28, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  doneTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  doneSub: { color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' },
  progressOuter: { height: 4, backgroundColor: COLORS.surface, marginHorizontal: 16, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  progressInner: { height: 4, backgroundColor: COLORS.primary, borderRadius: 4 },
  stepCount: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginLeft: 16, marginTop: 8, textTransform: 'uppercase' },
  qBox: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 18, marginBottom: 18 },
  q: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 18, lineHeight: 24 },
  opt: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, gap: 12, backgroundColor: 'rgba(255,255,255,0.02)' },
  optSel: { borderColor: COLORS.primary, backgroundColor: 'rgba(16,185,129,0.08)' },
  optTxt: { color: COLORS.text, fontSize: 14, flex: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioSel: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, padding: 16, borderRadius: 100, marginTop: 4 },
  nextTxt: { color: '#000', fontWeight: '800', fontSize: 15 },
  submitBtn: { backgroundColor: COLORS.secondary, padding: 16, borderRadius: 100, alignItems: 'center', marginTop: 4 },
  submitTxt: { color: '#000', fontWeight: '800', fontSize: 15 },
  bottomAd: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg },
});
