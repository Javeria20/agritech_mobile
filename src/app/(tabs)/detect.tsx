import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';

type Step = 'select-crop' | 'upload-image' | 'analyzing' | 'results';
type Tab = 'symptoms' | 'pesticide' | 'fertilizer' | 'prevention';

const CROP_LIST = ['rice', 'wheat', 'cotton', 'sugarcane'] as const;
const CROP_ICONS: Record<string, string> = { rice: '🌾', wheat: '🌿', cotton: '☁️', sugarcane: '🎋' };

type DiseaseResult = {
  id: string;
  name: string;
  scientificName: string | null;
  confidence: number;
  severity: string;
  symptoms: string[];
  treatment: string;
  pesticide: { name: string | null; dose: string | null; timing: string | null; manufacturer: string | null };
  fertilizer: { name: string | null; recommendation: string | null; timing: string | null };
  prevention: string[];
};

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  none: { bg: '#EAF4EE', text: '#2A6245' },
  low: { bg: '#EAF4EE', text: '#2A6245' },
  medium: { bg: '#FEF8E6', text: '#C08A00' },
  high: { bg: '#FAEAEA', text: '#B83030' },
};

export default function DetectDisease() {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>('select-crop');
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<DiseaseResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('symptoms');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('07:00');
  const [reminderSaved, setReminderSaved] = useState(false);

  function reset() {
    setStep('select-crop');
    setSelectedCrop(null);
    setImageUri(null);
    setResult(null);
    setReminderSaved(false);
  }

  async function pickImage(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera/Gallery access ki zaroorat hai.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function analyze() {
    if (!selectedCrop || !imageUri) return;
    setStep('analyzing');

    try {
      const response = await FileSystem.uploadAsync(`${API_URL}/detect/`, imageUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'image',
        mimeType: 'image/jpeg',
        parameters: { crop_type: selectedCrop },
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = JSON.parse(response.body);

      if (response.status < 200 || response.status >= 300) {
        Alert.alert('Detection Failed', data.detail || 'Kuch masla hua, dobara try karo.');
        setStep('upload-image');
        return;
      }

      setResult(data);
      setStep('results');
      setActiveTab('symptoms');
      setReminderSaved(false);
    } catch (e: any) {
      console.log('DETECT ERROR:', e);
      Alert.alert('Detect Error (debug)', String(e?.message || e));
      setStep('upload-image');
    }
  }

  async function saveReminder() {
    if (!result || !selectedCrop || !reminderDate) return;
    try {
      const response = await fetch(`${API_URL}/reminders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: `Apply treatment: ${result.name}`,
          crop: selectedCrop,
          activity: 'treatment',
          date: reminderDate,
          time: reminderTime,
          repeat: 'once',
          notes: `From detection: ${result.name} — ${result.pesticide.name || ''}`,
        }),
      });
      if (!response.ok) {
        Alert.alert('Error', 'Reminder save nahi ho saka.');
        return;
      }
      setShowReminderModal(false);
      setReminderSaved(true);
    } catch (e) {
      Alert.alert('Network Error', 'Reminder save nahi ho saka.');
    }
  }

  function askKisanBot() {
    if (!result || !selectedCrop) return;
    router.push({
      pathname: '/kisanbot',
      params: {
        prefill: `I detected ${result.name} in my ${selectedCrop} crop with ${Math.round(result.confidence)}% confidence. The severity is ${result.severity}. What additional advice can you give me?`,
      },
    });
  }

  // ---------- STEP 1: Select Crop ----------
  if (step === 'select-crop') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Detect Disease</Text>
        <Text style={styles.subtitle}>Apni crop select karo</Text>
        <View style={styles.cropGrid}>
          {CROP_LIST.map((crop) => {
            const selected = selectedCrop === crop;
            return (
              <TouchableOpacity
                key={crop}
                onPress={() => setSelectedCrop(crop)}
                style={[styles.cropOption, selected && styles.cropOptionSelected]}
              >
                <Text style={styles.cropOptionIcon}>{CROP_ICONS[crop]}</Text>
                <Text style={styles.cropOptionLabel}>{crop}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, !selectedCrop && styles.disabledButton]}
          disabled={!selectedCrop}
          onPress={() => setStep('upload-image')}
        >
          <Text style={styles.primaryButtonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------- STEP 2: Upload Image ----------
  if (step === 'upload-image') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Upload Image</Text>
        <Text style={styles.subtitle}>{selectedCrop} ki leaf ki photo lo ya gallery se select karo</Text>

        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={{ fontSize: 40 }}>📷</Text>
          </View>
        )}

        <View style={styles.imageButtonsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => pickImage(true)}>
            <Text style={styles.secondaryButtonText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => pickImage(false)}>
            <Text style={styles.secondaryButtonText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !imageUri && styles.disabledButton]}
          disabled={!imageUri}
          onPress={analyze}
        >
          <Text style={styles.primaryButtonText}>Analyze</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => setStep('select-crop')}>
          <Text style={styles.linkButtonText}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------- STEP 3: Analyzing ----------
  if (step === 'analyzing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.analyzingText}>Analyzing image...</Text>
      </View>
    );
  }

  // ---------- STEP 4: Results ----------
  if (step === 'results' && result) {
    const sev = SEVERITY_STYLE[result.severity] || SEVERITY_STYLE.medium;
    return (
      <>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.resultImage} />}

          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName}>{result.name}</Text>
              {result.scientificName ? <Text style={styles.resultScientific}>{result.scientificName}</Text> : null}
            </View>
            <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
              <Text style={[styles.severityText, { color: sev.text }]}>{result.severity}</Text>
            </View>
          </View>

          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>AI Confidence</Text>
            <Text style={styles.confidenceValue}>{Math.round(result.confidence)}%</Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {(['symptoms', 'pesticide', 'fertilizer', 'prevention'] as Tab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              >
                <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'symptoms' &&
              (result.symptoms.length ? (
                result.symptoms.map((s, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{s}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.bulletText}>Koi symptom record nahi.</Text>
              ))}

            {activeTab === 'pesticide' && (
              <View>
                <Text style={styles.infoLabel}>Treatment</Text>
                <Text style={styles.infoValue}>{result.treatment}</Text>
                {result.pesticide.name ? (
                  <>
                    <Text style={styles.infoLabel}>Pesticide</Text>
                    <Text style={styles.infoValue}>{result.pesticide.name}</Text>
                    <Text style={styles.infoLabel}>Dose</Text>
                    <Text style={styles.infoValue}>{result.pesticide.dose}</Text>
                    <Text style={styles.infoLabel}>Timing</Text>
                    <Text style={styles.infoValue}>{result.pesticide.timing}</Text>
                  </>
                ) : (
                  <Text style={styles.infoValue}>Koi pesticide zaroori nahi.</Text>
                )}
              </View>
            )}

            {activeTab === 'fertilizer' && (
              <View>
                <Text style={styles.infoLabel}>Fertilizer</Text>
                <Text style={styles.infoValue}>{result.fertilizer.name || 'N/A'}</Text>
                <Text style={styles.infoLabel}>Recommendation</Text>
                <Text style={styles.infoValue}>{result.fertilizer.recommendation}</Text>
                <Text style={styles.infoLabel}>Timing</Text>
                <Text style={styles.infoValue}>{result.fertilizer.timing}</Text>
              </View>
            )}

            {activeTab === 'prevention' &&
              result.prevention.map((p, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletNumber}>
                    <Text style={styles.bulletNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.bulletText}>{p}</Text>
                </View>
              ))}
          </View>

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#2A6245' }]} onPress={askKisanBot}>
            <Text style={styles.primaryButtonText}>Ask KisanBot About This</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: reminderSaved ? '#FEF8E6' : '#C08A00', marginTop: 10 }]}
            disabled={reminderSaved}
            onPress={() => setShowReminderModal(true)}
          >
            <Text style={[styles.primaryButtonText, reminderSaved && { color: '#C08A00' }]}>
              {reminderSaved ? '✓ Reminder Set' : 'Set Reminder'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={reset}>
            <Text style={styles.linkButtonText}>Scan Another Crop</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Reminder Modal */}
        <Modal visible={showReminderModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Set Reminder</Text>
              <Text style={styles.infoLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-10-05"
                value={reminderDate}
                onChangeText={setReminderDate}
              />
              <Text style={styles.infoLabel}>Time (HH:MM)</Text>
              <TextInput style={styles.input} placeholder="07:00" value={reminderTime} onChangeText={setReminderTime} />

              <TouchableOpacity
                style={[styles.primaryButton, !reminderDate && styles.disabledButton]}
                disabled={!reminderDate}
                onPress={saveReminder}
              >
                <Text style={styles.primaryButtonText}>Save Reminder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={() => setShowReminderModal(false)}>
                <Text style={styles.linkButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F2' },

  title: { fontSize: 22, fontWeight: 'bold', color: '#1C1810' },
  subtitle: { fontSize: 13, color: '#6A5E4E', marginTop: 4, marginBottom: 20 },

  cropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  cropOption: {
    width: '47%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#D4CBBA',
    padding: 18, alignItems: 'center',
  },
  cropOptionSelected: { borderColor: '#1A2D60', backgroundColor: '#EEF1F9' },
  cropOptionIcon: { fontSize: 32, marginBottom: 6 },
  cropOptionLabel: { fontSize: 14, fontWeight: '600', color: '#1C1810', textTransform: 'capitalize' },

  primaryButton: { backgroundColor: '#16A34A', borderRadius: 12, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  disabledButton: { backgroundColor: '#D4CBBA' },

  secondaryButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4CBBA', borderRadius: 12, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#1A2D60', fontWeight: '600' },
  imageButtonsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },

  placeholderBox: { height: 200, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#D4CBBA', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  previewImage: { height: 220, borderRadius: 16, marginBottom: 20 },

  linkButton: { padding: 12, alignItems: 'center', marginTop: 6 },
  linkButtonText: { color: '#1A2D60', fontWeight: '600' },

  analyzingText: { marginTop: 12, color: '#6A5E4E' },

  resultImage: { height: 180, borderRadius: 16, marginBottom: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  resultName: { fontSize: 18, fontWeight: 'bold', color: '#1C1810' },
  resultScientific: { fontSize: 12, fontStyle: 'italic', color: '#6A5E4E', marginTop: 2 },
  severityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  severityText: { fontWeight: 'bold', fontSize: 12, textTransform: 'capitalize' },

  confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  confidenceLabel: { color: '#6A5E4E', fontSize: 12 },
  confidenceValue: { fontWeight: 'bold', color: '#1A2D60' },

  tabsRow: { flexDirection: 'row', backgroundColor: '#EDE7D9', borderRadius: 12, padding: 4, marginBottom: 14 },
  tabButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#fff' },
  tabButtonText: { fontSize: 11, color: '#6A5E4E', fontWeight: '600' },
  tabButtonTextActive: { color: '#1A2D60' },

  tabContent: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#D4CBBA', padding: 14, marginBottom: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  bulletDot: { color: '#2A6245', fontWeight: 'bold' },
  bulletText: { flex: 1, fontSize: 13, color: '#1C1810', lineHeight: 18 },
  bulletNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EAF4EE', justifyContent: 'center', alignItems: 'center' },
  bulletNumberText: { fontSize: 11, fontWeight: 'bold', color: '#2A6245' },

  infoLabel: { fontSize: 10, color: '#9A8E7E', textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  infoValue: { fontSize: 13, color: '#1C1810', lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1810', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#D4CBBA', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
});