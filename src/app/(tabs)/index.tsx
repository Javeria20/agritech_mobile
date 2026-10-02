import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';

type Crop = { id: string; crop_type: string; planted_date: string | null; created_at: string };
type Reminder = { id: string; title: string; crop: string; activity: string; date: string; time: string; status: string };
type Prediction = {
  id: string;
  crop_type: string;
  confidence: number;
  saved: boolean;
  created_at: string;
  disease: { name: string } | null;
};

const CROP_ICONS: Record<string, string> = { rice: '🌾', wheat: '🌿', cotton: '☁️', sugarcane: '🎋' };

export default function Home() {
  const { user, token } = useAuth();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [cropsRes, remindersRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/crops/`, { headers }),
        fetch(`${API_URL}/reminders/`, { headers }),
        fetch(`${API_URL}/history/`, { headers }),
      ]);
      setCrops(cropsRes.ok ? await cropsRes.json() : []);
      setReminders(remindersRes.ok ? await remindersRes.json() : []);
      setHistory(historyRes.ok ? await historyRes.json() : []);
    } catch (e) {
      console.log('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  function latestPredictionFor(cropType: string) {
    return history.find((h) => h.crop_type === cropType) || null;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const upcomingReminders = reminders.filter((r) => r.status === 'upcoming').slice(0, 3);
  const recentHistory = history.slice(0, 3);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.userName}>{user?.name || 'Farmer'}</Text>
        {user?.district ? <Text style={styles.location}>📍 {user.district}</Text> : null}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{crops.length}</Text>
            <Text style={styles.statLabel}>Crops</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{history.length}</Text>
            <Text style={styles.statLabel}>Scans</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{upcomingReminders.length}</Text>
            <Text style={styles.statLabel}>Reminders</Text>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#B83030' }]} onPress={() => router.push('/detect')}>
          <Text style={styles.actionTitle}>Detect Disease</Text>
          <Text style={styles.actionSubtitle}>AI powered</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#2A6245' }]} onPress={() => router.push('/kisanbot')}>
          <Text style={styles.actionTitle}>Ask KisanBot</Text>
          <Text style={styles.actionSubtitle}>Chatbot</Text>
        </TouchableOpacity>
      </View>

      {/* My Crops */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Crops</Text>
        </View>
        {crops.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Abhi tak koi crop add nahi ki.</Text>
          </View>
        ) : (
          <View style={styles.cropsGrid}>
            {crops.map((crop) => {
              const latest = latestPredictionFor(crop.crop_type);
              return (
                <View key={crop.id} style={styles.cropCard}>
                  <Text style={styles.cropIcon}>{CROP_ICONS[crop.crop_type] || '🌱'}</Text>
                  <Text style={styles.cropName}>{crop.crop_type}</Text>
                  <Text style={styles.cropStatus} numberOfLines={1}>
                    {latest ? `Last: ${latest.disease?.name || 'Healthy'}` : 'Not scanned yet'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Upcoming Reminders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Reminders</Text>
        </View>
        {upcomingReminders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Koi upcoming reminder nahi hai.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {upcomingReminders.map((rem, i) => (
              <View key={rem.id} style={[styles.listRow, i < upcomingReminders.length - 1 && styles.rowBorder]}>
                <Text style={styles.listIcon}>{CROP_ICONS[rem.crop] || '🔔'}</Text>
                <View style={styles.listRowContent}>
                  <Text style={styles.listTitle} numberOfLines={1}>{rem.title}</Text>
                  <Text style={styles.listSubtitle}>{rem.crop} · {rem.date}</Text>
                </View>
                <Text style={styles.listTime}>{rem.time}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Recent Predictions */}
      <View style={[styles.section, { marginBottom: 24 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Predictions</Text>
          <TouchableOpacity onPress={() => router.push('/history')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        {recentHistory.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Abhi tak koi scan nahi hui.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {recentHistory.map((item, i) => (
              <View key={item.id} style={[styles.listRow, i < recentHistory.length - 1 && styles.rowBorder]}>
                <Text style={styles.listIcon}>{CROP_ICONS[item.crop_type] || '🔍'}</Text>
                <View style={styles.listRowContent}>
                  <Text style={styles.listTitle} numberOfLines={1}>{item.disease?.name || 'Unknown'}</Text>
                  <Text style={styles.listSubtitle}>{item.crop_type}</Text>
                </View>
                <Text style={styles.listConfidence}>{Math.round(item.confidence)}%</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F2' },

  hero: { backgroundColor: '#1A2D60', borderRadius: 20, padding: 20, marginBottom: 16 },
  greeting: { color: '#BFD3F5', fontSize: 13 },
  userName: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  location: { color: '#BFD3F5', fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#BFD3F5', fontSize: 11, marginTop: 2 },

  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionCard: { flex: 1, borderRadius: 16, padding: 14 },
  actionTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  actionSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1C1810' },
  viewAll: { fontSize: 12, color: '#1A2D60', fontWeight: '600' },

  emptyCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#D4CBBA', padding: 20, alignItems: 'center' },
  emptyText: { color: '#6A5E4E', fontSize: 12 },

  cropsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cropCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#D4CBBA',
    padding: 12, alignItems: 'center',
  },
  cropIcon: { fontSize: 22, marginBottom: 4 },
  cropName: { fontSize: 13, fontWeight: 'bold', color: '#1C1810', textTransform: 'capitalize' },
  cropStatus: { fontSize: 10, color: '#6A5E4E', marginTop: 2, textAlign: 'center' },

  listCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#D4CBBA', overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#EDE7D9' },
  listIcon: { fontSize: 18 },
  listRowContent: { flex: 1 },
  listTitle: { fontSize: 13, fontWeight: '600', color: '#1C1810' },
  listSubtitle: { fontSize: 11, color: '#6A5E4E', marginTop: 1, textTransform: 'capitalize' },
  listTime: { fontSize: 11, fontWeight: 'bold', color: '#1A2D60' },
  listConfidence: { fontSize: 13, fontWeight: 'bold', color: '#1A2D60' },
});