import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Users, Wallet, TrendingUp, Search, Check, X as XIcon, RotateCcw, Trophy } from 'lucide-react-native';
import { COLORS } from '../../src/theme';
import { api, clearAuth } from '../../src/api';

type Tab = 'stats' | 'users' | 'withdrawals' | 'submissions' | 'leaderboard' | 'visits' | 'quiz' | 'survey' | 'ads';

export default function AdminPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [wds, setWds] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [lb, setLb] = useState<any[]>([]);
  const [lbPeriod, setLbPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'total'>('total');
  const [visits, setVisits] = useState<any[]>([]);
  const [newVisit, setNewVisit] = useState<{ name: string; url: string }>({ name: '', url: '' });
  const [quizBank, setQuizBank] = useState<any[]>([]);
  const [newQuiz, setNewQuiz] = useState({ q: '', options: ['', '', '', ''], answer: 0 });
  const [surveyBank, setSurveyBank] = useState<any[]>([]);
  const [newSurvey, setNewSurvey] = useState({ q: '', options: ['', '', '', ''] });
  const [ads, setAds] = useState<any>({ app_id: '', banner: '', interstitial: '', native: '', rewarded: '' });

  useEffect(() => {
    if (tab === 'stats') loadStats();
    if (tab === 'users') loadUsers();
    if (tab === 'withdrawals') loadWds();
    if (tab === 'submissions') loadSubs();
    if (tab === 'leaderboard') loadLb();
    if (tab === 'visits') loadVisits();
    if (tab === 'quiz') loadQuizBank();
    if (tab === 'survey') loadSurveyBank();
    if (tab === 'ads') loadAds();
  }, [tab, lbPeriod]);

  const loadStats = async () => { try { setStats(await api('/admin/stats')); } catch (e: any) { Alert.alert('Error', e.message); } };
  const loadUsers = async () => { try { setUsers(await api(`/admin/users?search=${encodeURIComponent(search)}`)); } catch (e: any) { Alert.alert('Error', e.message); } };
  const loadWds = async () => { try { setWds(await api('/admin/withdrawals?status=pending')); } catch (e: any) { Alert.alert('Error', e.message); } };
  const loadSubs = async () => { try { setSubs(await api('/admin/submissions?status=pending')); } catch (e: any) { Alert.alert('Error', e.message); } };
  const loadLb = async () => { try { setLb(await api(`/admin/leaderboard?period=${lbPeriod}`)); } catch (e: any) { Alert.alert('Error', e.message); } };

  const loadVisits = async () => { try { setVisits(await api('/admin/visits')); } catch (e: any) { Alert.alert('Error', e.message); } };
  const addVisit = async () => {
    if (!newVisit.name || !newVisit.url) return Alert.alert('Missing', 'Name and URL required');
    try { await api('/admin/visits', { method: 'POST', body: JSON.stringify(newVisit) }); setNewVisit({ name: '', url: '' }); loadVisits(); } catch (e: any) { Alert.alert('Error', e.message); }
  };
  const deleteVisit = async (id: string) => { await api(`/admin/visits/${id}`, { method: 'DELETE' }); loadVisits(); };

  const loadQuizBank = async () => { try { setQuizBank(await api('/admin/quiz-bank')); } catch (e: any) { Alert.alert('Error', e.message); } };
  const addQuiz = async () => {
    const opts = newQuiz.options.map((o) => o.trim()).filter(Boolean);
    if (!newQuiz.q.trim() || opts.length < 2) return Alert.alert('Missing', 'Question and at least 2 options required');
    try { await api('/admin/quiz-bank', { method: 'POST', body: JSON.stringify({ q: newQuiz.q, options: opts, answer: newQuiz.answer }) }); setNewQuiz({ q: '', options: ['', '', '', ''], answer: 0 }); loadQuizBank(); } catch (e: any) { Alert.alert('Error', e.message); }
  };
  const deleteQuiz = async (id: string) => { await api(`/admin/quiz-bank/${id}`, { method: 'DELETE' }); loadQuizBank(); };

  const loadSurveyBank = async () => { try { setSurveyBank(await api('/admin/survey-bank')); } catch (e: any) { Alert.alert('Error', e.message); } };
  const addSurvey = async () => {
    const opts = newSurvey.options.map((o) => o.trim()).filter(Boolean);
    if (!newSurvey.q.trim() || opts.length < 2) return Alert.alert('Missing', 'Question and at least 2 options required');
    try { await api('/admin/survey-bank', { method: 'POST', body: JSON.stringify({ q: newSurvey.q, options: opts }) }); setNewSurvey({ q: '', options: ['', '', '', ''] }); loadSurveyBank(); } catch (e: any) { Alert.alert('Error', e.message); }
  };
  const deleteSurvey = async (id: string) => { await api(`/admin/survey-bank/${id}`, { method: 'DELETE' }); loadSurveyBank(); };

  const loadAds = async () => {
    try { const c = await api('/config'); setAds(c.admob || {}); } catch (e: any) { Alert.alert('Error', e.message); }
  };
  const saveAds = async () => {
    try { await api('/admin/ads', { method: 'PUT', body: JSON.stringify(ads) }); Alert.alert('Saved', 'Ad settings updated'); loadAds(); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const logout = async () => { await clearAuth(); router.replace('/'); };

  const approveWd = async (id: string) => { await api(`/admin/withdrawals/${id}/approve`, { method: 'POST' }); loadWds(); };
  const rejectWd = async (id: string) => { await api(`/admin/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ note: 'Rejected by admin' }) }); loadWds(); };
  const approveSub = async (id: string) => { await api(`/admin/submissions/${id}/approve`, { method: 'POST' }); loadSubs(); };
  const rejectSub = async (id: string) => { await api(`/admin/submissions/${id}/reject`, { method: 'POST', body: JSON.stringify({ note: 'Invalid proof' }) }); loadSubs(); };
  const resetSub = async (id: string) => { await api(`/admin/submissions/${id}/reset`, { method: 'POST' }); loadSubs(); };

  const viewUser = async (u: any) => {
    try { const d = await api(`/admin/users/${u.user_id}/details`); setSelectedUser(d); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.sub}>CashClick Control</Text>
        </View>
        <TouchableOpacity style={styles.logout} onPress={logout} testID="admin-logout"><LogOut color={COLORS.danger} size={18} /></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <TabBtn label="Stats" active={tab === 'stats'} onPress={() => setTab('stats')} />
        <TabBtn label="Users" active={tab === 'users'} onPress={() => setTab('users')} />
        <TabBtn label="Withdrawals" active={tab === 'withdrawals'} onPress={() => setTab('withdrawals')} />
        <TabBtn label="Tasks" active={tab === 'submissions'} onPress={() => setTab('submissions')} />
        <TabBtn label="Visit Sites" active={tab === 'visits'} onPress={() => setTab('visits')} />
        <TabBtn label="Quiz Bank" active={tab === 'quiz'} onPress={() => setTab('quiz')} />
        <TabBtn label="Survey Bank" active={tab === 'survey'} onPress={() => setTab('survey')} />
        <TabBtn label="Ads" active={tab === 'ads'} onPress={() => setTab('ads')} />
        <TabBtn label="Leaderboard" active={tab === 'leaderboard'} onPress={() => setTab('leaderboard')} />
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === 'stats' && (
          <View style={styles.statsGrid}>
            <StatCard icon={<Users color={COLORS.primary} />} label="Total Users" value={stats.total_users || 0} />
            <StatCard icon={<TrendingUp color={COLORS.secondary} />} label="DAU Today" value={stats.dau_today || 0} />
            <StatCard icon={<Wallet color={COLORS.info} />} label="Pending WD Amount" value={`₹${stats.pending_withdrawal_amount || 0}`} />
            <StatCard icon={<Check color={COLORS.primary} />} label="Approved Today" value={`₹${stats.approved_today_amount || 0}`} />
          </View>
        )}

        {tab === 'users' && (
          <>
            <View style={styles.searchBox}>
              <Search color={COLORS.textSecondary} size={18} />
              <TextInput style={styles.searchInput} placeholder="Search by email or name" placeholderTextColor={COLORS.textDisabled} value={search} onChangeText={setSearch} onSubmitEditing={loadUsers} testID="user-search" />
              <TouchableOpacity onPress={loadUsers}><Text style={{ color: COLORS.primary, fontWeight: '700' }}>Go</Text></TouchableOpacity>
            </View>
            {users.map((u) => (
              <TouchableOpacity key={u.user_id} style={styles.userRow} onPress={() => viewUser(u)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <Text style={styles.userPts}>{u.points} pts</Text>
              </TouchableOpacity>
            ))}
            {selectedUser && (
              <View style={styles.userDetail}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.section}>{selectedUser.user.email}</Text>
                  <TouchableOpacity onPress={() => setSelectedUser(null)}><XIcon color={COLORS.textSecondary} size={18} /></TouchableOpacity>
                </View>
                <Text style={styles.sub}>Points: {selectedUser.user.points} · Earned: {selectedUser.user.total_earned} · Streak: {selectedUser.user.streak}</Text>
                <AdjustPoints uid={selectedUser.user.user_id} onDone={() => viewUser({ user_id: selectedUser.user.user_id })} />
                <Text style={styles.section}>Withdrawals ({selectedUser.withdrawals.length})</Text>
                {selectedUser.withdrawals.slice(0, 5).map((w: any) => (
                  <Text key={w.id} style={styles.miniRow}>₹{w.amount_rupees} · {w.method} · {w.status} · {new Date(w.created_at).toLocaleDateString()}</Text>
                ))}
                <Text style={styles.section}>Transactions ({selectedUser.transactions.length})</Text>
                {selectedUser.transactions.slice(0, 10).map((t: any) => (
                  <Text key={t.id} style={styles.miniRow}>{t.points > 0 ? '+' : ''}{t.points} · {t.source}</Text>
                ))}
                <Text style={styles.section}>Last Tasks ({selectedUser.submissions.length})</Text>
                {selectedUser.submissions.slice(0, 5).map((s: any) => (
                  <Text key={s.id} style={styles.miniRow}>{s.task_name} · {s.status}</Text>
                ))}
              </View>
            )}
          </>
        )}

        {tab === 'withdrawals' && (
          <>
            {wds.map((w) => (
              <View key={w.id} style={styles.card}>
                <Text style={styles.cardTitle}>₹{w.amount_rupees} · {w.method}</Text>
                <Text style={styles.cardMeta}>{w.user_email}</Text>
                {w.upi_id && <Text style={styles.cardMeta}>UPI: {w.upi_id}</Text>}
                {w.account_no && <Text style={styles.cardMeta}>{w.account_holder} · {w.account_no} · {w.ifsc}</Text>}
                <Text style={styles.cardMeta}>{new Date(w.created_at).toLocaleString()}</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveWd(w.id)}><Check color="#000" size={16} /><Text style={styles.btnTxt}>Approve</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectWd(w.id)}><XIcon color="#fff" size={16} /><Text style={[styles.btnTxt, { color: '#fff' }]}>Reject</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            {wds.length === 0 && <Text style={styles.empty}>No pending withdrawals</Text>}
          </>
        )}

        {tab === 'submissions' && (
          <>
            {subs.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.cardTitle}>{s.task_name} · {s.points} pts</Text>
                <Text style={styles.cardMeta}>{s.user_email}</Text>
                {s.mobile && <Text style={styles.cardMeta}>Mobile: {s.mobile}</Text>}
                {s.email && <Text style={styles.cardMeta}>Email: {s.email}</Text>}
                {s.screenshot && <Image source={{ uri: s.screenshot }} style={styles.ss} />}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveSub(s.id)}><Check color="#000" size={16} /><Text style={styles.btnTxt}>Approve</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectSub(s.id)}><XIcon color="#fff" size={16} /><Text style={[styles.btnTxt, { color: '#fff' }]}>Reject</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.resetBtn} onPress={() => resetSub(s.id)}><RotateCcw color={COLORS.text} size={16} /><Text style={[styles.btnTxt, { color: COLORS.text }]}>Reset</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            {subs.length === 0 && <Text style={styles.empty}>No pending task submissions</Text>}
          </>
        )}

        {tab === 'visits' && (
          <>
            <Text style={styles.section}>Add New Site</Text>
            <TextInput style={styles.input} placeholder="Display name (e.g. Tech News)" placeholderTextColor={COLORS.textDisabled} value={newVisit.name} onChangeText={(t) => setNewVisit({ ...newVisit, name: t })} testID="new-visit-name" />
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="https://..." placeholderTextColor={COLORS.textDisabled} value={newVisit.url} onChangeText={(t) => setNewVisit({ ...newVisit, url: t })} autoCapitalize="none" testID="new-visit-url" />
            <TouchableOpacity style={[styles.applyBtn, { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 22, paddingVertical: 12 }]} onPress={addVisit} testID="add-visit-btn"><Text style={{ color: '#000', fontWeight: '800' }}>+ Add Site</Text></TouchableOpacity>

            <Text style={[styles.section, { marginTop: 22 }]}>Existing Sites ({visits.length})</Text>
            {visits.map((v) => (
              <View key={v.id} style={styles.card}>
                <Text style={styles.cardTitle}>{v.name}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{v.url}</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => deleteVisit(v.id)}><XIcon color="#fff" size={16} /><Text style={[styles.btnTxt, { color: '#fff' }]}>Delete</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            {visits.length === 0 && <Text style={styles.empty}>No sites yet</Text>}
          </>
        )}

        {tab === 'quiz' && (
          <>
            <Text style={styles.section}>Add Quiz Question</Text>
            <TextInput style={styles.input} placeholder="Question" placeholderTextColor={COLORS.textDisabled} value={newQuiz.q} onChangeText={(t) => setNewQuiz({ ...newQuiz, q: t })} testID="new-quiz-q" />
            {newQuiz.options.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                <TouchableOpacity onPress={() => setNewQuiz({ ...newQuiz, answer: i })} style={[styles.checkbox, newQuiz.answer === i && styles.checkboxSel]}>
                  {newQuiz.answer === i && <Check color="#000" size={14} />}
                </TouchableOpacity>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder={`Option ${i + 1}${i === 0 ? ' (mark ✓ as correct)' : ''}`} placeholderTextColor={COLORS.textDisabled} value={o} onChangeText={(t) => { const opts = [...newQuiz.options]; opts[i] = t; setNewQuiz({ ...newQuiz, options: opts }); }} testID={`new-quiz-opt-${i}`} />
              </View>
            ))}
            <TouchableOpacity style={[styles.applyBtn, { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 22, paddingVertical: 12 }]} onPress={addQuiz} testID="add-quiz-btn"><Text style={{ color: '#000', fontWeight: '800' }}>+ Add Question</Text></TouchableOpacity>

            <Text style={[styles.section, { marginTop: 22 }]}>Question Bank ({quizBank.length})</Text>
            {quizBank.map((q, idx) => (
              <View key={q.id || idx} style={styles.card}>
                <Text style={styles.cardTitle}>{idx + 1}. {q.q}</Text>
                {(q.options || []).map((o: string, j: number) => (
                  <Text key={j} style={[styles.cardMeta, j === q.answer && { color: COLORS.primary, fontWeight: '700' }]}>{j === q.answer ? '✓ ' : '· '}{o}</Text>
                ))}
                {q.id && (
                  <TouchableOpacity style={[styles.rejectBtn, { alignSelf: 'flex-start', marginTop: 10 }]} onPress={() => deleteQuiz(q.id)}><XIcon color="#fff" size={14} /><Text style={[styles.btnTxt, { color: '#fff' }]}>Delete</Text></TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {tab === 'survey' && (
          <>
            <Text style={styles.section}>Add Survey Question</Text>
            <TextInput style={styles.input} placeholder="Question" placeholderTextColor={COLORS.textDisabled} value={newSurvey.q} onChangeText={(t) => setNewSurvey({ ...newSurvey, q: t })} testID="new-survey-q" />
            {newSurvey.options.map((o, i) => (
              <TextInput key={i} style={[styles.input, { marginTop: 6 }]} placeholder={`Option ${i + 1}`} placeholderTextColor={COLORS.textDisabled} value={o} onChangeText={(t) => { const opts = [...newSurvey.options]; opts[i] = t; setNewSurvey({ ...newSurvey, options: opts }); }} testID={`new-survey-opt-${i}`} />
            ))}
            <TouchableOpacity style={[styles.applyBtn, { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 22, paddingVertical: 12 }]} onPress={addSurvey} testID="add-survey-btn"><Text style={{ color: '#000', fontWeight: '800' }}>+ Add Question</Text></TouchableOpacity>

            <Text style={[styles.section, { marginTop: 22 }]}>Question Bank ({surveyBank.length})</Text>
            {surveyBank.map((q, idx) => (
              <View key={q.id || idx} style={styles.card}>
                <Text style={styles.cardTitle}>{idx + 1}. {q.q}</Text>
                {(q.options || []).map((o: string, j: number) => (
                  <Text key={j} style={styles.cardMeta}>· {o}</Text>
                ))}
                {q.id && (
                  <TouchableOpacity style={[styles.rejectBtn, { alignSelf: 'flex-start', marginTop: 10 }]} onPress={() => deleteSurvey(q.id)}><XIcon color="#fff" size={14} /><Text style={[styles.btnTxt, { color: '#fff' }]}>Delete</Text></TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {tab === 'ads' && (
          <>
            <Text style={styles.section}>AdMob Configuration</Text>
            <Text style={styles.cardMeta}>Default uses Google test ad IDs. Replace with your AdMob unit IDs for production. App ID change requires a new native build.</Text>
            <Text style={styles.label}>App ID</Text>
            <TextInput style={styles.input} value={ads.app_id || ''} onChangeText={(t) => setAds({ ...ads, app_id: t })} placeholder="ca-app-pub-xxx~xxx" placeholderTextColor={COLORS.textDisabled} autoCapitalize="none" testID="ads-app-id" />
            <Text style={styles.label}>Banner Ad Unit ID</Text>
            <TextInput style={styles.input} value={ads.banner || ''} onChangeText={(t) => setAds({ ...ads, banner: t })} placeholder="ca-app-pub-xxx/xxx" placeholderTextColor={COLORS.textDisabled} autoCapitalize="none" testID="ads-banner" />
            <Text style={styles.label}>Native Ad Unit ID</Text>
            <TextInput style={styles.input} value={ads.native || ''} onChangeText={(t) => setAds({ ...ads, native: t })} placeholder="ca-app-pub-xxx/xxx" placeholderTextColor={COLORS.textDisabled} autoCapitalize="none" testID="ads-native" />
            <Text style={styles.label}>Rewarded Ad Unit ID</Text>
            <TextInput style={styles.input} value={ads.rewarded || ''} onChangeText={(t) => setAds({ ...ads, rewarded: t })} placeholder="ca-app-pub-xxx/xxx" placeholderTextColor={COLORS.textDisabled} autoCapitalize="none" testID="ads-rewarded" />
            <Text style={styles.label}>Interstitial Ad Unit ID</Text>
            <TextInput style={styles.input} value={ads.interstitial || ''} onChangeText={(t) => setAds({ ...ads, interstitial: t })} placeholder="ca-app-pub-xxx/xxx" placeholderTextColor={COLORS.textDisabled} autoCapitalize="none" testID="ads-interstitial" />
            <TouchableOpacity style={[styles.applyBtn, { marginTop: 18, paddingHorizontal: 22, paddingVertical: 14 }]} onPress={saveAds} testID="save-ads-btn"><Text style={{ color: '#000', fontWeight: '800', textAlign: 'center' }}>Save Ad Settings</Text></TouchableOpacity>
          </>
        )}

        {tab === 'leaderboard' && (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['daily', 'weekly', 'monthly', 'total'] as const).map(p => (
                <TouchableOpacity key={p} style={[styles.pill, lbPeriod === p && styles.pillSel]} onPress={() => setLbPeriod(p)}>
                  <Text style={[styles.pillTxt, lbPeriod === p && { color: '#000' }]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {lb.map((u, i) => (
              <View key={u.user_id} style={styles.lbRow}>
                <View style={[styles.rank, i < 3 && { backgroundColor: COLORS.secondary }]}>
                  {i < 3 ? <Trophy color="#000" size={14} /> : <Text style={styles.rankTxt}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lbName}>{u.name}</Text>
                  <Text style={styles.lbEmail}>{u.email}</Text>
                </View>
                <Text style={styles.lbPts}>{u.total_earned}</Text>
              </View>
            ))}
            {lb.length === 0 && <Text style={styles.empty}>No data yet</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnSel]} onPress={onPress}>
      <Text style={[styles.tabBtnTxt, active && { color: '#000' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ icon, label, value }: any) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIc}>{icon}</View>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AdjustPoints({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const submit = async () => {
    const n = parseInt(val); if (!n) return Alert.alert('Enter a number');
    try { await api(`/admin/users/${uid}/adjust`, { method: 'POST', body: JSON.stringify({ points: n, note: note || 'Admin adjustment' }) }); setVal(''); setNote(''); onDone(); Alert.alert('Done'); } catch (e: any) { Alert.alert('Error', e.message); }
  };
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>Adjust Points (+/-)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={val} onChangeText={setVal} keyboardType="numbers-and-punctuation" placeholder="e.g. 100 or -50" placeholderTextColor={COLORS.textDisabled} />
        <TouchableOpacity style={styles.applyBtn} onPress={submit}><Text style={{ color: '#000', fontWeight: '800' }}>Apply</Text></TouchableOpacity>
      </View>
      <TextInput style={[styles.input, { marginTop: 8 }]} value={note} onChangeText={setNote} placeholder="Note" placeholderTextColor={COLORS.textDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  sub: { color: COLORS.textSecondary, fontSize: 12 },
  logout: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  tabs: { maxHeight: 50, marginBottom: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  tabBtnSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabBtnTxt: { color: COLORS.text, fontWeight: '700', fontSize: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', flexGrow: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16 },
  statIc: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statVal: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 12 },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 10, marginLeft: 10 },
  userRow: { flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  userName: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  userEmail: { color: COLORS.textSecondary, fontSize: 12 },
  userPts: { color: COLORS.primary, fontWeight: '800' },
  userDetail: { marginTop: 16, padding: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14 },
  section: { color: COLORS.text, fontWeight: '800', marginTop: 12, marginBottom: 6, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniRow: { color: COLORS.textSecondary, fontSize: 12, paddingVertical: 3 },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  cardMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  ss: { width: '100%', height: 140, borderRadius: 10, marginTop: 10, backgroundColor: '#000' },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100 },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.danger, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceElevated, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100 },
  btnTxt: { color: '#000', fontWeight: '800', fontSize: 13, marginLeft: 4 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 24 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  pillSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillTxt: { color: COLORS.text, fontWeight: '700', fontSize: 11 },
  lbRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  rank: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  rankTxt: { color: COLORS.text, fontWeight: '800' },
  lbName: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  lbEmail: { color: COLORS.textSecondary, fontSize: 11 },
  lbPts: { color: COLORS.primary, fontWeight: '800' },
  label: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, color: COLORS.text, fontSize: 13 },
  applyBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  checkboxSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
