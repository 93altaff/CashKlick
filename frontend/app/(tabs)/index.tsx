import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl, Dimensions, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Flame, TrendingUp } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api, getCachedUser } from '../../src/api';

const { width } = Dimensions.get('window');
const BANNER_W = width - 32;

export default function HomeTab() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const idx = useRef(0);

  const load = async () => {
    try {
      const [u, b, t] = await Promise.all([api('/auth/me'), api('/banners'), api('/tasks')]);
      setUser(u); setBanners(b); setTasks(t);
    } catch (e) {
      const cached = await getCachedUser();
      if (cached) setUser(cached);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      idx.current = (idx.current + 1) % banners.length;
      scrollRef.current?.scrollTo({ x: idx.current * BANNER_W, animated: true });
    }, 3500);
    return () => clearInterval(id);
  }, [banners]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const statusBadge = (t: any) => {
    if (t.submission_status === 'pending') return <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}><Text style={[styles.badgeTxt, { color: COLORS.secondary }]}>Pending</Text></View>;
    if (t.submission_status === 'rejected') return <View style={[styles.badge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}><Text style={[styles.badgeTxt, { color: COLORS.danger }]}>Rejected</Text></View>;
    if (t.submission_status === 'approved') return <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.15)' }]}><Text style={[styles.badgeTxt, { color: COLORS.primary }]}>Approved</Text></View>;
    if (t.submission_status === 'payment_received') return <View style={[styles.badge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}><Text style={[styles.badgeTxt, { color: COLORS.info }]}>Paid</Text></View>;
    return null;
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>{(user?.username || user?.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.hi}>Hello,</Text>
              <Text style={styles.name} testID="home-username">{user?.username ? `@${user.username}` : (user?.name || 'User')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bellBtn} testID="notification-btn">
            <Bell color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>

        {/* Points card */}
        <View style={styles.pointsCard} testID="points-card">
          <View style={styles.pointsGlow} />
          <Text style={styles.pointsLabel}>YOUR BALANCE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={styles.pointsNum} testID="home-points">{user?.points ?? 0}</Text>
            <Text style={styles.pointsUnit}>pts</Text>
          </View>
          <Text style={styles.pointsRupees}>≈ ₹{((user?.points ?? 0) / 100).toFixed(2)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statPill}><Flame color={COLORS.secondary} size={14} /><Text style={styles.statTxt}>{user?.streak || 0} day streak</Text></View>
            <View style={styles.statPill}><TrendingUp color={COLORS.primary} size={14} /><Text style={styles.statTxt}>{user?.total_tasks_done || 0} tasks</Text></View>
          </View>
        </View>

        {/* Banners */}
        {banners.length > 0 && (
          <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.bannerScroll}>
            {banners.map((b) => (
              <TouchableOpacity key={b.id} style={styles.banner} activeOpacity={0.85} onPress={() => b.url && Linking.openURL(b.url)} testID={`banner-${b.id}`}>
                <Image source={{ uri: b.image }} style={styles.bannerImg} />
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle}>{b.title}</Text>
                  <Text style={styles.bannerSub}>{b.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* High paying section */}
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>High Paying Campaigns</Text>
            <Text style={styles.sectionSub}>Complete tasks and earn big rewards</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {tasks.map((t) => (
            <TouchableOpacity key={t.id} style={styles.taskCard} activeOpacity={0.88} onPress={() => router.push(`/task/${t.id}` as any)} testID={`task-${t.id}`}>
              <View style={styles.taskTop}>
                {t.logo ? <Image source={{ uri: t.logo }} style={styles.taskLogo} /> : <View style={styles.taskLogoPh} />}
                <View style={styles.taskPoints}>
                  <Text style={styles.taskPointsNum}>₹{(t.points / 100).toFixed(0)}</Text>
                  <Text style={styles.taskPointsLabel}>{t.points} pts</Text>
                </View>
              </View>
              <Text style={styles.taskName} numberOfLines={1}>{t.name}</Text>
              <Text style={styles.taskNote} numberOfLines={2}>{t.note}</Text>
              <View style={styles.taskBottom}>
                {statusBadge(t) || <View />}
                <Text style={styles.taskCta}>View →</Text>
              </View>
            </TouchableOpacity>
          ))}
          {tasks.length === 0 && (
            <Text style={styles.empty}>No tasks available right now. Check back soon!</Text>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  avatarWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  hi: { color: COLORS.textSecondary, fontSize: 12 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  pointsCard: { marginHorizontal: 16, backgroundColor: COLORS.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  pointsGlow: { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(16,185,129,0.12)' },
  pointsLabel: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 8 },
  pointsNum: { color: COLORS.text, fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  pointsUnit: { color: COLORS.textSecondary, fontSize: 16, marginLeft: 8, marginBottom: 10 },
  pointsRupees: { color: COLORS.primary, fontSize: 16, fontWeight: '700', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100 },
  statTxt: { color: COLORS.text, fontSize: 12, fontWeight: '600' },

  bannerScroll: { marginTop: 20, marginLeft: 16 },
  banner: { width: BANNER_W, height: 150, marginRight: 0, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.surface },
  bannerImg: { width: '100%', height: '100%', position: 'absolute' },
  bannerOverlay: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(0,0,0,0.4)' },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },

  sectionHead: { paddingHorizontal: 20, marginTop: 28, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  sectionSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },

  grid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  taskCard: { width: (width - 44) / 2, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14 },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  taskLogo: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#000' },
  taskLogoPh: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.surfaceElevated },
  taskPoints: { alignItems: 'flex-end' },
  taskPointsNum: { color: COLORS.primary, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  taskPointsLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600' },
  taskName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  taskNote: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, minHeight: 32 },
  taskBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  badgeTxt: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  taskCta: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  empty: { color: COLORS.textSecondary, padding: 24, textAlign: 'center', width: '100%' },
});
