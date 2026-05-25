import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../src/theme';

export default function AdBanner({ label = 'Banner Ad' }: { label?: string }) {
  return (
    <View style={styles.container} testID="ad-banner">
      <Text style={styles.txt}>{label} · ca-app-pub-7744865309171344/7215240687</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 54,
    backgroundColor: '#111113',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { color: COLORS.textDisabled, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
});
