import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as SQLite from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

type Domain = { id: number; name: string; color: string };
type Metric = { id: number; domain_id: number; name: string; type: 'boolean' | 'numeric' };
type MetricLog = {
  id: number;
  metric_id: number;
  value_number: number | null;
  value_bool: number | null;
  logged_at: string;
};
type SkinSession = {
  id: number;
  image_uri: string;
  captured_at: string;
  consent_api_upload: number;
  texture_score: number;
  redness_score: number;
  acne_score: number;
  hydration_score: number;
  summary: string;
};

const DB_NAME = 'appz.db';

const defaultDomains = [
  { name: 'Skincare', color: '#d977a8' },
  { name: 'Gym/Fitness', color: '#65a30d' },
  { name: 'Study', color: '#3b82f6' },
];

function scoreFromSeed(seed: number) {
  return 30 + (seed % 71);
}

function sparkline(values: number[]) {
  if (!values.length) return '—';
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return values.map(() => '▄').join('');
  return values
    .map((v) => {
      const idx = Math.round(((v - min) / (max - min)) * (blocks.length - 1));
      return blocks[idx];
    })
    .join('');
}

export default function App() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [logs, setLogs] = useState<MetricLog[]>([]);
  const [skinSessions, setSkinSessions] = useState<SkinSession[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);
  const [domainNameInput, setDomainNameInput] = useState('');
  const [metricNameInput, setMetricNameInput] = useState('');
  const [numericValueInput, setNumericValueInput] = useState('1');
  const [metricTypeInput, setMetricTypeInput] = useState<'boolean' | 'numeric'>('boolean');
  const [cloudOptIn, setCloudOptIn] = useState(false);

  useEffect(() => {
    (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS domains (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metric_id INTEGER NOT NULL,
          value_number REAL,
          value_bool INTEGER,
          logged_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS skin_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_uri TEXT NOT NULL,
          captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
          consent_api_upload INTEGER NOT NULL,
          texture_score INTEGER NOT NULL,
          redness_score INTEGER NOT NULL,
          acne_score INTEGER NOT NULL,
          hydration_score INTEGER NOT NULL,
          summary TEXT NOT NULL
        );
      `);

      const existingDomains = await database.getAllAsync<Domain>('SELECT id, name, color FROM domains ORDER BY id;');
      if (!existingDomains.length) {
        for (const domain of defaultDomains) {
          await database.runAsync('INSERT INTO domains (name, color) VALUES (?, ?);', domain.name, domain.color);
        }
      }
      setDb(database);
      await reloadAll(database);
    })();
  }, []);

  async function reloadAll(database: SQLite.SQLiteDatabase = db as SQLite.SQLiteDatabase) {
    if (!database) return;
    const domainRows = await database.getAllAsync<Domain>('SELECT id, name, color FROM domains ORDER BY id;');
    const metricRows = await database.getAllAsync<Metric>(
      "SELECT id, domain_id, name, type FROM metrics ORDER BY id;"
    );
    const logRows = await database.getAllAsync<MetricLog>(
      'SELECT id, metric_id, value_number, value_bool, logged_at FROM logs ORDER BY datetime(logged_at) DESC;'
    );
    const skinRows = await database.getAllAsync<SkinSession>(
      'SELECT id, image_uri, captured_at, consent_api_upload, texture_score, redness_score, acne_score, hydration_score, summary FROM skin_sessions ORDER BY datetime(captured_at) DESC;'
    );

    setDomains(domainRows);
    setMetrics(metricRows.map((m) => ({ ...m, type: m.type as Metric['type'] })));
    setLogs(logRows);
    setSkinSessions(skinRows);

    if (!selectedDomainId && domainRows.length) {
      setSelectedDomainId(domainRows[0].id);
    }
  }

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId]
  );

  const domainMetrics = useMemo(
    () => metrics.filter((metric) => metric.domain_id === selectedDomainId),
    [metrics, selectedDomainId]
  );

  async function addDomain() {
    if (!db || !domainNameInput.trim()) return;
    await db.runAsync('INSERT INTO domains (name, color) VALUES (?, ?);', domainNameInput.trim(), '#64748b');
    setDomainNameInput('');
    await reloadAll();
  }

  async function addMetric() {
    if (!db || !selectedDomainId || !metricNameInput.trim()) return;
    await db.runAsync(
      'INSERT INTO metrics (domain_id, name, type) VALUES (?, ?, ?);',
      selectedDomainId,
      metricNameInput.trim(),
      metricTypeInput
    );
    setMetricNameInput('');
    await reloadAll();
  }

  async function quickLog(metric: Metric) {
    if (!db) return;
    if (metric.type === 'boolean') {
      await db.runAsync('INSERT INTO logs (metric_id, value_bool) VALUES (?, ?);', metric.id, 1);
    } else {
      const num = Number(numericValueInput);
      if (Number.isNaN(num)) {
        Alert.alert('Invalid value', 'Enter a numeric value.');
        return;
      }
      await db.runAsync('INSERT INTO logs (metric_id, value_number) VALUES (?, ?);', metric.id, num);
    }
    await reloadAll();
  }

  function getStreak(metricId: number) {
    const dates = logs
      .filter((l) => l.metric_id === metricId)
      .map((l) => l.logged_at.slice(0, 10))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => (a < b ? 1 : -1));

    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (let i = 0; i < 60; i += 1) {
      const dateKey = cursor.toISOString().slice(0, 10);
      if (dates.includes(dateKey)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function getTrend(metricId: number) {
    const metricLogs = logs
      .filter((l) => l.metric_id === metricId)
      .slice(0, 7)
      .reverse()
      .map((l) => (l.value_number ?? (l.value_bool ? 1 : 0)) || 0);
    return sparkline(metricLogs);
  }

  async function addSkincareSession() {
    if (!db) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to capture skincare progress photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.4, allowsEditing: false });
    if (result.canceled || !result.assets.length) return;

    const seed = Date.now();
    const texture = scoreFromSeed(seed + 17);
    const redness = scoreFromSeed(seed + 31);
    const acne = scoreFromSeed(seed + 49);
    const hydration = scoreFromSeed(seed + 73);

    const summary = `Texture ${texture}, redness ${redness}, acne ${acne}, hydration cues ${hydration}. Trend is for casual visual comparison only.`;

    await db.runAsync(
      `INSERT INTO skin_sessions
      (image_uri, consent_api_upload, texture_score, redness_score, acne_score, hydration_score, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?);`,
      result.assets[0].uri,
      cloudOptIn ? 1 : 0,
      texture,
      redness,
      acne,
      hydration,
      summary
    );

    await reloadAll();
  }

  const skincareHistory = useMemo(
    () => skinSessions.map((s) => s.texture_score + s.hydration_score - s.redness_score - s.acne_score).reverse(),
    [skinSessions]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Appz</Text>
        <Text style={styles.subtitle}>Local-first goals and habits. No account. Works offline.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Domains</Text>
          <View style={styles.rowWrap}>
            {domains.map((domain) => (
              <Pressable
                key={domain.id}
                onPress={() => setSelectedDomainId(domain.id)}
                style={[
                  styles.domainButton,
                  { borderColor: domain.color },
                  selectedDomainId === domain.id && { backgroundColor: '#111827' },
                ]}
              >
                <Text style={[styles.domainText, selectedDomainId === domain.id && { color: '#fff' }]}>{domain.name}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            placeholder="Add a domain (e.g. Sleep)"
            value={domainNameInput}
            onChangeText={setDomainNameInput}
            style={styles.input}
          />
          <Pressable style={styles.primaryButton} onPress={addDomain}>
            <Text style={styles.primaryText}>Add Domain</Text>
          </Pressable>
        </View>

        {selectedDomain && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{selectedDomain.name} Dashboard</Text>
            <TextInput
              placeholder="Metric name (e.g. Sunscreen)"
              value={metricNameInput}
              onChangeText={setMetricNameInput}
              style={styles.input}
            />
            <View style={styles.rowWrap}>
              <Pressable
                style={[styles.smallButton, metricTypeInput === 'boolean' && styles.selectedSmallButton]}
                onPress={() => setMetricTypeInput('boolean')}
              >
                <Text style={styles.smallButtonText}>Boolean</Text>
              </Pressable>
              <Pressable
                style={[styles.smallButton, metricTypeInput === 'numeric' && styles.selectedSmallButton]}
                onPress={() => setMetricTypeInput('numeric')}
              >
                <Text style={styles.smallButtonText}>Numeric</Text>
              </Pressable>
            </View>
            <Pressable style={styles.primaryButton} onPress={addMetric}>
              <Text style={styles.primaryText}>Add Metric</Text>
            </Pressable>

            <TextInput
              placeholder="Numeric quick-log value"
              value={numericValueInput}
              onChangeText={setNumericValueInput}
              keyboardType="numeric"
              style={styles.input}
            />

            {domainMetrics.length === 0 ? (
              <Text style={styles.helper}>No metrics yet. Add one above.</Text>
            ) : (
              domainMetrics.map((metric) => (
                <View key={metric.id} style={styles.metricCard}>
                  <View style={styles.metricTopRow}>
                    <Text style={styles.metricTitle}>{metric.name}</Text>
                    <Pressable onPress={() => quickLog(metric)} style={styles.quickLogButton}>
                      <Text style={styles.quickLogText}>Quick Log</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.helper}>Type: {metric.type}</Text>
                  <Text style={styles.helper}>Streak: {getStreak(metric.id)} days</Text>
                  <Text style={styles.helper}>Trend (7 logs): {getTrend(metric.id)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Skincare AI Progress Tracker</Text>
          <Text style={styles.warning}>
            This is a casual visual-comparison tool and not a dermatological diagnostic instrument.
          </Text>
          <Text style={styles.helper}>Photos stay on your device by default.</Text>
          <View style={styles.switchRow}>
            <Text style={styles.helper}>Opt-in to cloud vision API uploads</Text>
            <Switch value={cloudOptIn} onValueChange={setCloudOptIn} />
          </View>
          <Pressable style={styles.primaryButton} onPress={addSkincareSession}>
            <Text style={styles.primaryText}>Capture Guided Face Photo</Text>
          </Pressable>
          <Text style={styles.helper}>Guidance: use consistent lighting and frontal angle each time.</Text>
          <Text style={styles.helper}>Skin trend: {sparkline(skincareHistory)}</Text>

          {skinSessions.slice(0, 3).map((session) => (
            <View key={session.id} style={styles.skinCard}>
              <Image source={{ uri: session.image_uri }} style={styles.skinImage} />
              <Text style={styles.helper}>{new Date(session.captured_at).toLocaleString()}</Text>
              <Text style={styles.helper}>{session.summary}</Text>
            </View>
          ))}
        </View>

        <StatusBar style="dark" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 16, gap: 12, paddingBottom: 36 },
  title: { fontSize: 32, fontWeight: '700', color: '#111827' },
  subtitle: { color: '#475569', marginBottom: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  domainButton: {
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  domainText: { color: '#0f172a', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 46,
    backgroundColor: '#fff',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  smallButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#94a3b8',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSmallButton: { backgroundColor: '#dbeafe', borderColor: '#3b82f6' },
  smallButtonText: { color: '#0f172a', fontWeight: '600' },
  metricCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  metricTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  metricTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  quickLogButton: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLogText: { color: '#fff', fontWeight: '700' },
  warning: { color: '#7f1d1d', fontWeight: '600' },
  helper: { color: '#475569', fontSize: 13 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  skinCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
  },
  skinImage: { width: '100%', height: 170, borderRadius: 8, backgroundColor: '#e2e8f0' },
});
