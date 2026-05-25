// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Platform,
  ActivityIndicator, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Zap, ShieldCheck, Wallet, Gift, CircleCheck as CheckCircle2, CircleX as XCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../src/theme';
import { api, setToken, setCachedUser, getToken, getDeviceId } from '../src/api';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [continueLoading, setContinueLoading] = useState(false);

  // Username creation modal
  const [showName, setShowName] = useState(false);
  const [username, setUsername] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  const [nameMsg, setNameMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [takenBanner, setTakenBanner] = useState('');
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    (async () => {
      // 1) Try existing session_token first.
      const t = await getToken();
      if (t) {
        try {
          const u = await api('/auth/me');
          await setCachedUser(u);
          router.replace(u.is_admin ? '/admin' : '/(tabs)');
          return;
        } catch {
          // Token expired/invalid — fall through to silent device-login.
        }
      }
      // 2) Silent device-login: if this device already has an account, log in automatically.
      try {
        const device_id = await getDeviceId();
        const res = await api('/auth/device-login', {
          method: 'POST',
          body: JSON.stringify({ device_id }),
        });
        await setToken(res.session_token);
        await setCachedUser(res.user);
        router.replace('/(tabs)');
        return;
      } catch {
        // No account on this device yet — show splash so the user can register.
      }
      setLoading(false);
    })();
  }, []);

  const handleContinue = async () => {
    setGeneralError('');
    setContinueLoading(true);
    try {
      const device_id = await getDeviceId();
      try {
        const res = await api('/auth/device-login', {
          method: 'POST',
          body: JSON.stringify({ device_id }),
        });
        await setToken(res.session_token);
        await setCachedUser(res.user);
        router.replace('/(tabs)');
      } catch (e: any) {
        // No account on this device — open username creation modal.
        setShowName(true);
        setContinueLoading(false);
      }
    } catch (e: any) {
      setGeneralError('Could not read device id. Please try again.');
      setContinueLoading(false);
    }
  };

  // Live username availability check (debounced).
  useEffect(() => {
    if (!showName) return;
    const u = username.trim().toLowerCase();
    // Reset banner whenever user edits the name.
    setTakenBanner('');
    if (!u) { setNameStatus('idle'); setNameMsg(''); return; }
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(u)) {
      setNameStatus('bad');
      setNameMsg('3-20 letters, numbers, dot or underscore. No spaces.');
      return;
    }
    setNameStatus('checking');
    setNameMsg('Checking…');
    const t = setTimeout(async () => {
      try {
        const r = await api(`/auth/username-available?u=${encodeURIComponent(u)}`);
        if (r.available) { setNameStatus('ok'); setNameMsg('Available'); }
        else { setNameStatus('bad'); setNameMsg(r.reason || 'Username already taken'); }
      } catch {
        setNameStatus('bad'); setNameMsg('Could not check, try again');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, showName]);

  const handleCreate = async () => {
    const u = username.trim().toLowerCase();
    if (nameStatus !== 'ok') return;
    setSubmitting(true);
    setTakenBanner('');
    try {
      const device_id = await getDeviceId();
      const res = await api('/auth/device-register', {
        method: 'POST',
        body: JSON.stringify({ device_id, username: u, platform: Platform.OS }),
      });
      await setToken(res.session_token);
      await setCachedUser(res.user);
      setShowName(false);
      router.replace('/(tabs)');
    } catch (e: any) {
      // 409 race-condition: someone grabbed the name between our live-check and submit.
      // Force the user back into "bad" state so they MUST pick a different username
      // before they can proceed. NEVER navigate to home tab on failure.
      const msg = e?.message || 'Could not create account';
      setTakenBanner(msg);
      setNameStatus('bad');
      setNameMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.splash}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.c} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['rgba(16,185,129,0.15)', 'transparent']} style={styles.glow} />

        <View style={styles.logoWrap} testID="app-logo">
          <LinearGradient colors={['#10B981', '#059669']} style={styles.logoBox}>
            <Text style={styles.logoSymbol}>₹</Text>
          </LinearGradient>
          <Text style={styles.brand}>CashClick</Text>
          <Text style={styles.tagline}>Earn real cash. Click smart. Live free.</Text>
        </View>

        <View style={styles.features}>
          <Feature icon={<Zap color={COLORS.secondary} size={20} />} title="High-paying tasks" sub="Up to ₹100/task" />
          <Feature icon={<Gift color={COLORS.primary} size={20} />} title="Daily rewards" sub="Spin, scratch, check-in" />
          <Feature icon={<Wallet color={COLORS.info} size={20} />} title="Instant UPI" sub="Withdraw anytime" />
          <Feature icon={<ShieldCheck color={COLORS.secondary} size={20} />} title="100% secure" sub="One device, one account" />
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, continueLoading && { opacity: 0.7 }]}
          onPress={handleContinue}
          disabled={continueLoading}
          testID="continue-btn"
        >
          {continueLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.continueTxt}>Continue</Text>}
        </TouchableOpacity>

        {!!generalError && <Text style={styles.errBig}>{generalError}</Text>}

        <Text style={styles.legal}>By continuing, you agree to our Terms & Privacy Policy</Text>
      </ScrollView>

      {showName && (
        <View style={styles.modalOverlay} testID="username-modal">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
            <View style={styles.modal}>
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>Pick a username</Text>
              </View>
              <Text style={styles.helper}>One device, one account. Pick a unique name — no spaces.</Text>

              {!!takenBanner && (
                <View style={styles.banner} testID="username-taken-banner">
                  <XCircle color={COLORS.danger} size={18} />
                  <Text style={styles.bannerTxt} numberOfLines={2}>{takenBanner} — please choose another.</Text>
                </View>
              )}

              <View style={styles.inputWrap}>
                <Text style={styles.atPrefix}>@</Text>
                <TextInput
                  style={styles.inputName}
                  value={username}
                  onChangeText={(s) => setUsername(s.replace(/\s/g, '').toLowerCase())}
                  placeholder="altaf93"
                  placeholderTextColor={COLORS.textDisabled}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  testID="username-input"
                />
                {nameStatus === 'ok' && <CheckCircle2 color={COLORS.primary} size={20} />}
                {nameStatus === 'bad' && <XCircle color={COLORS.danger} size={20} />}
                {nameStatus === 'checking' && <ActivityIndicator color={COLORS.textSecondary} />}
              </View>
              {!!nameMsg && (
                <Text style={[styles.nameMsg, nameStatus === 'ok' ? { color: COLORS.primary } : nameStatus === 'bad' ? { color: COLORS.danger } : { color: COLORS.textSecondary }]}>
                  {nameMsg}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.submit, (nameStatus !== 'ok' || submitting) && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={nameStatus !== 'ok' || submitting}
                testID="username-submit-btn"
              >
                {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitTxt}>Create Account</Text>}
              </TouchableOpacity>
              <Text style={styles.modalFoot}>You can't continue until your username is unique.</Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Feature({ icon, title, sub }: any) {
  return (
    <View style={styles.feat}>
      <View style={styles.featIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featTitle}>{title}</Text>
        <Text style={styles.featSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  splash: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, padding: 28, paddingTop: 80, paddingBottom: 40 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 400 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoBox: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18, shadowColor: '#10B981', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  logoSymbol: { fontSize: 44, fontWeight: '900', color: '#000' },
  brand: { color: COLORS.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  tagline: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6 },
  features: { marginBottom: 36 },
  feat: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: 14, borderRadius: 16, marginBottom: 10 },
  featIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  featTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  featSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  continueBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  continueTxt: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  errBig: { color: COLORS.danger, textAlign: 'center', marginBottom: 12, fontSize: 13 },
  legal: { color: COLORS.textDisabled, fontSize: 11, textAlign: 'center' },

  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', maxWidth: 420, backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  helper: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', padding: 12, borderRadius: 12, marginBottom: 14 },
  bannerTxt: { color: COLORS.danger, fontSize: 13, fontWeight: '600', flex: 1 },
  modalFoot: { color: COLORS.textDisabled, fontSize: 11, textAlign: 'center', marginTop: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 14, gap: 6 },
  atPrefix: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '700' },
  inputName: { flex: 1, color: COLORS.text, fontSize: 16, paddingVertical: 14 },
  nameMsg: { fontSize: 12, marginTop: 8, marginLeft: 4 },
  submit: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 100, alignItems: 'center', marginTop: 22 },
  submitTxt: { color: '#000', fontSize: 16, fontWeight: '800' },
});
