import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck as CheckCircle2, Target, ScrollText, Globe, Video as Youtube, CircleHelp as HelpCircle, FileText, Users, Gift } from 'lucide-react-native';
import { COLORS } from '../../src/theme';

const ITEMS = [
  { key: 'checkin', title: 'Daily Check-in', sub: 'Up to 100 pts/day', icon: CheckCircle2, color: '#10B981', route: '/earn/checkin' },
  { key: 'spin', title: 'Spin & Win', sub: '10 spins daily · 50-100 pts', icon: Target, color: '#F59E0B', route: '/earn/spin' },
  { key: 'scratch', title: 'Scratch & Earn', sub: '10 cards daily · 50-100 pts', icon: ScrollText, color: '#8B5CF6', route: '/earn/scratch' },
  { key: 'visit', title: 'Visit & Earn', sub: '100 pts per site', icon: Globe, color: '#3B82F6', route: '/earn/visit' },
  { key: 'watch', title: 'Watch & Earn', sub: '100 pts per video', icon: Youtube, color: '#EF4444', route: '/earn/watch' },
  { key: 'quiz', title: 'Quiz', sub: 'Daily 100 pts', icon: HelpCircle, color: '#10B981', route: '/earn/quiz' },
  { key: 'survey', title: 'Survey', sub: 'Daily 100 pts', icon: FileText, color: '#F59E0B', route: '/earn/survey' },
  { key: 'refer', title: 'Refer & Earn', sub: '₹10 per referral', icon: Users, color: '#EC4899', route: '/earn/refer' },
];

export default function EarnTab() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={styles.iconGift}><Gift color={COLORS.secondary} size={20} /></View>
          <View>
            <Text style={styles.t1}>Earn More</Text>
            <Text style={styles.t2}>Pick your favorite way to make money</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <TouchableOpacity key={it.key} style={styles.card} activeOpacity={0.88} onPress={() => router.push(it.route as any)} testID={`earn-${it.key}`}>
                <View style={[styles.iconBox, { backgroundColor: it.color + '22' }]}>
                  <Icon color={it.color} size={26} />
                </View>
                <Text style={styles.cardTitle}>{it.title}</Text>
                <Text style={styles.cardSub}>{it.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  iconGift: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  t1: { color: COLORS.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  t2: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  card: { width: '47%', flexGrow: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 18, marginBottom: 4 },
  iconBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  cardSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
});
