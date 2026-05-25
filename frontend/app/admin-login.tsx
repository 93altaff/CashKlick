import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShieldCheck } from 'lucide-react-native';
import { COLORS } from '../src/theme';
import { api, setToken, setCachedUser } from '../src/api';

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('93altaff@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setToken(res.session_token);
      await setCachedUser(res.user);
      router.replace('/admin');
    } catch (e: any) {
      setError(e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} testID="admin-back-btn">
            <X color={COLORS.text} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <ShieldCheck color={COLORS.primary} size={36} />
          </View>
          <Text style={styles.title}>Admin Login</Text>
          <Text style={styles.sub}>Restricted access — administrators only.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="admin-email-input"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={COLORS.textDisabled}
            testID="admin-password-input"
          />

          {!!error && <Text style={styles.err}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submit, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
            testID="admin-submit-btn"
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitTxt}>Login as Admin</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  body: { flex: 1, paddingHorizontal: 28, paddingTop: 24 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800' },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 6, marginBottom: 28 },
  label: { color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 12, fontWeight: '700' },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, color: COLORS.text, fontSize: 15 },
  err: { color: COLORS.danger, marginTop: 12, fontSize: 13 },
  submit: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 100, alignItems: 'center', marginTop: 28 },
  submitTxt: { color: '#000', fontSize: 16, fontWeight: '800' },
});
