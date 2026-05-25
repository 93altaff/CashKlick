import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Network from 'expo-network';
import { COLORS } from '../src/theme';
import { WifiOff } from 'lucide-react-native';

export default function OfflineGate({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const s = await Network.getNetworkStateAsync();
      setOnline(!!s.isConnected && !!s.isInternetReachable);
    } catch { setOnline(true); }
    setChecking(false);
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  if (!online) {
    return (
      <View style={styles.c} testID="no-internet-screen">
        <View style={styles.glow}>
          <WifiOff color={COLORS.danger} size={72} />
        </View>
        <Text style={styles.t1}>No Internet</Text>
        <Text style={styles.t2}>Please check your connection and try again.</Text>
        <TouchableOpacity style={styles.btn} onPress={check} testID="retry-internet-btn">
          <Text style={styles.btnTxt}>{checking ? 'Checking…' : 'Retry'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  glow: { padding: 32, borderRadius: 200, backgroundColor: 'rgba(239,68,68,0.1)', marginBottom: 24 },
  t1: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  t2: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 32 },
  btn: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 48, borderRadius: 100 },
  btnTxt: { color: '#000', fontWeight: '800', fontSize: 15 },
});
