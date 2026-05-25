import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Mail, FileText, Shield, LogOut } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api, clearAuth } from '../../src/api';

export default function ProfileTab() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({});

  useFocusEffect(React.useCallback(() => {
    (async () => {
      try {
        const [u, c] = await Promise.all([api('/auth/me'), api('/config')]);
        setUser(u); setConfig(c);
      } catch {}
    })();
  }, []));

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    await clearAuth();
    router.replace('/');
  };

  const handle = user?.username ? `@${user.username}` : (user?.name || 'User');

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>SIGNED IN AS</Text>
            <Text style={styles.username} testID="profile-username" numberOfLines={1}>{handle}</Text>
          </View>
          <TouchableOpacity
            onPress={logout}
            onLongPress={() => router.push('/admin-login')}
            delayLongPress={800}
            style={styles.logoutBtn}
            testID="logout-btn"
          >
            <LogOut color={COLORS.danger} size={18} />
          </TouchableOpacity>
        </View>

        <Section title="As Your Needs">
          <ActionRow color="#2AABEE" icon={Send} title="Join Telegram Channel" onPress={() => config.telegram_channel && Linking.openURL(config.telegram_channel)} testID="btn-telegram-channel" />
          <ActionRow color="#2AABEE" icon={Send} title="Contact on Telegram" onPress={() => config.telegram_contact && Linking.openURL(config.telegram_contact)} testID="btn-telegram-contact" />
          <ActionRow color="#F59E0B" icon={Mail} title="Contact on E-mail" onPress={() => config.email_contact && Linking.openURL(`mailto:${config.email_contact}`)} testID="btn-email-contact" />
          <ActionRow color="#8B5CF6" icon={Shield} title="Privacy Policy" onPress={() => config.privacy_policy_url && Linking.openURL(config.privacy_policy_url)} testID="btn-privacy" />
          <ActionRow color="#10B981" icon={FileText} title="Terms & Conditions" last onPress={() => config.terms_url && Linking.openURL(config.terms_url)} testID="btn-terms" />
        </Section>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBox}>{children}</View>
    </View>
  );
}

function ActionRow({ icon: Icon, title, onPress, color, testID, last }: any) {
  return (
    <TouchableOpacity style={[styles.row, last && { borderBottomWidth: 0 }]} onPress={onPress} testID={testID}>
      <View style={[styles.rowIcon, { backgroundColor: color + '22' }]}><Icon color={color} size={18} /></View>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  label: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  username: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  logoutBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    marginLeft: 12,
  },

  sectionTitle: {
    color: COLORS.text, fontSize: 13, fontWeight: '800',
    paddingHorizontal: 20, marginBottom: 10, letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionBox: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: 12,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1 },
  arrow: { color: COLORS.textDisabled, fontSize: 22 },
});
