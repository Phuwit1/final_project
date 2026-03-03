// app/trip/ai-create.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, FlatList, Modal, Pressable,
  Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '@/api.js'
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import ApproveAnimation from '@/components/ui/Alert/ApproveAnimation'; // แก้ path ให้ตรงกับที่คุณเซฟไว้
import WrongAnimation from '@/components/ui/Alert/WrongAnimation';
import { LinearGradient } from 'expo-linear-gradient';


type LLMResponse = {
  itinerary: Array<{
    date: string; // 'YYYY-MM-DD'
    day: string;
    schedule: Array<{ time: string; activity: string; lat?: number; lng?: number }>;
  }>;
  comments?: string;
};

type TripScheduleIn = {
  plan_id: number;
  date: string;     // 'YYYY-MM-DD'
  time: string;     // 'HH:mm:ss'
  activity: string;
  description: string;
};

const CLOUD_NAME = "dqghrasqe"; 
const UPLOAD_PRESET = "TabiGo";

type City = {
  id: number;
  name: string;
};


const toDDMMYYYY_fromDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // e.g. "2025-08-14"
};

export default function AICreateTrip() {
  const router = useRouter();

  const [tripName, setTripName] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [triprequest, setTripRequest] = useState('');

  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [citySearch, setCitySearch] = useState(''); 
  const [loadingCities, setLoadingCities] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const today = new Date(); today.setHours(0,0,0,0);
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [picker, setPicker] = useState<{ show: boolean; mode: 'start' | 'end' }>({ show: false, mode: 'start' });

  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    isSuccess: false,
    onConfirm: () => {}, 
  });

  const showCustomAlert = (title: string, message: string, isSuccess = false, onConfirm = () => {}) => {
    setAlertConfig({ visible: true, title, message, isSuccess, onConfirm });
  };

  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
    alertConfig.onConfirm();
  };

  const openPicker = (mode: 'start' | 'end') => setPicker({ show: true, mode });


  const onChangeDate = (_: any, selected?: Date) => {
    setPicker(p => ({ ...p, show: false }));
    if (!selected) return;
    const picked = new Date(selected); picked.setHours(0,0,0,0);

    if (picked < today) {
      Alert.alert('Cannot select a past date');
      return;
    }
    if (picker.mode === 'start') {
      setStartDate(picked);
      if (picked > endDate) setEndDate(picked);
    } else {
      if (picked < startDate) {
        Alert.alert('End date cannot be before start date');
        return;
      }
      setEndDate(picked);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadToCloudinary = async (uri: string) => {
    const data = new FormData();
    let filename = uri.split('/').pop();
    let match = /\.(\w+)$/.exec(filename || '');
    let type = match ? `image/${match[1]}` : `image`;

    // @ts-ignore
    data.append('file', { uri: uri, name: filename, type });
    data.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: data,
      headers: { 'content-type': 'multipart/form-data' },
    });
    
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.secure_url;
  };


  const toggleCity = (name: string) => {
    setSelectedCities(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(c => c.name.toLowerCase().includes(q));
  }, [cities, citySearch]);


  const CITIES_ENDPOINT = `${API_URL}/cities`;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCities(true);
        const token = await AsyncStorage.getItem('access_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await axios.get(CITIES_ENDPOINT, { headers, timeout: 15000 });
        
        const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
        const normalized: City[] = rows.map((c: any) => ({
          id: Number(c.id),
          name: String(c.name),
        })).filter((x: City) => Number.isFinite(x.id) && x.name);

        if (mounted) setCities(normalized);
      } catch (e) {
        console.error('Load cities error:', e);
        if (mounted) Alert.alert('Load cities error', 'Try again');
      } finally {
        if (mounted) setLoadingCities(false);
      }
    })();
    return () => { mounted = false; };
  }, []);


const onCreateWithAI = async () => {
  try {
    if (!tripName.trim()) {
      showCustomAlert('Oops!', 'Please enter trip name', false);
      return;
    }

    setLoading(true);
    const token = await AsyncStorage.getItem('access_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let coverImageUrl = null;
      if (imageUri) {
        try {
          setUploadingImage(true);
          coverImageUrl = await uploadToCloudinary(imageUri);
          console.log("Uploaded cover:", coverImageUrl);
        } catch (imgErr) {
          console.error("Image upload failed:", imgErr);
          Alert.alert("Warning", "Image upload failed. Trip will be created without cover.");
        } finally {
          setUploadingImage(false);
        }
      }

    const createPayload = {
      name_group: tripName.trim(),
      start_plan_date: toYMD(startDate),
      end_plan_date: toYMD(endDate),
      image: coverImageUrl,
    };
    console.log("SENDING PAYLOAD:", createPayload);

    const llmBody = {
      start_date: toDDMMYYYY_fromDate(startDate),
      end_date: toDDMMYYYY_fromDate(endDate),
      cities : selectedCities,
      text: triprequest,
    };

    console.log("LLM request body:", llmBody);

    const llm = await axios.post(`${API_URL}/llm/`, llmBody, {
      headers,
    });

    const data: any = typeof llm.data === 'string'
      ? JSON.parse(llm.data)
      : llm.data;

    const created = await axios.post(
      `${API_URL}/trip_plan`,createPayload,{ headers }
    );

    console.log("Created response:", created.data);
    

    const planId: number = Number(created.data?.plan_id);
    const tripIdForRoute: string = String(
      created.data?.trip_id ?? created.data?.plan_id
    );

    if (!Number.isFinite(planId)) {
      Alert.alert('Create Trip error', 'Not Found plan_id in response');
      setLoading(false);
      return;
    }

    await axios.post(
      `${API_URL}/trip_schedule`,
      {
        plan_id: planId,
        payload: data, 
      },
      { headers } 
    );

    showCustomAlert('Success!', 'Your trip is ready! Please check the details and make sure everything looks good.', true, () => {
      router.push({
        pathname: "/trip/scheduledetail",
        params: { 
          planId: planId,
          cities: JSON.stringify(selectedCities) 
        }
      });
    });
  } catch (e: any) {
    console.error(
      'AI create trip error:',
      e?.response?.data ?? e?.message ?? e
    );
    showCustomAlert('Create trip error', 'Please try again', false);
  } finally {
    setLoading(false);
  }
};


  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.container}>
        <Text style={styles.title}> Create New Trip </Text>

        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                 <Ionicons name="camera-outline" size={32} color="#888" />
                 <Text style={styles.imagePlaceholderText}>Add Cover Photo</Text>
              </View>
            )}
            {/* ปุ่มเปลี่ยนรูปเล็กๆ มุมขวา */}
            {imageUri && (
                <View style={styles.editIconBadge}>
                    <Ionicons name="pencil" size={14} color="#fff" />
                </View>
            )}
          </TouchableOpacity>

        <View style={styles.field}>
          <Text style={styles.label}>Trip Name</Text>
          <TextInput value={tripName} onChangeText={setTripName} placeholder="e.g. Tokyo Autumn" style={styles.input} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Choose City</Text>

          {/* ปุ่มเปิด Modal */}
          <TouchableOpacity style={styles.selectBtn} onPress={() => setCityModalVisible(true)}>
            <Text style={styles.selectBtnText}>
              {selectedCities.length > 0 ? selectedCities.join(', ') : 'Select your cities'}
            </Text>
          </TouchableOpacity>

          {/* แสดง chips เมืองที่เลือก */}
          {selectedCities.length > 0 && (
            <View style={styles.chipsRow}>
              {selectedCities.map(name => (
                <View key={name} style={styles.chip}>
                  <Text style={styles.chipText}>{name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>


        <Modal visible={cityModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>City</Text>

              {/* ช่องค้นหา */}
              <TextInput
                placeholder="Find city..."
                value={citySearch}
                onChangeText={setCitySearch}
                style={styles.searchInput}
              />

              {/* รายการเมือง + เช็คบ็อกซ์ */}
              {loadingCities ? (
                <ActivityIndicator style={{ marginVertical: 16 }} />
              ) : (
                <FlatList
                  data={filteredCities}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 320 }}
                  ListEmptyComponent={
                    <Text style={{ textAlign: 'center', paddingVertical: 16, color: '#666' }}>
                      City not found
                    </Text>
                  }
                  renderItem={({ item }) => {
                    const checked = selectedCities.includes(item.name);
                    return (
                      <Pressable onPress={() => toggleCity(item.name)} style={styles.cityRow}>
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked && <Text style={styles.checkboxTick}>✓</Text>}
                        </View>
                        <Text style={styles.cityName}>{item.name}</Text>
                      </Pressable>
                    );
                  }}
                />
              )}

              {/* ปุ่มปิด/ยืนยัน */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setCityModalVisible(false)}>
                  <Text style={styles.modalBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalApply]} onPress={() => setCityModalVisible(false)}>
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.field}>
          <Text style={styles.label}>Interests</Text>
          <TextInput value={triprequest} onChangeText={setTripRequest} placeholder="e.g. Cherry blossoms, local food, temples" style={styles.input} />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('start')}>
              <Text style={styles.dateText}>{startDate.toDateString()}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('end')}>
              <Text style={styles.dateText}>{endDate.toDateString()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {picker.show && (
          <DateTimePicker
            value={picker.mode === 'start' ? startDate : endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onChangeDate}
            minimumDate={today}
          />
        )}

        <TouchableOpacity style={styles.submitBtnWrapper} onPress={onCreateWithAI} disabled={loading || !tripName} activeOpacity={0.8}>
            <LinearGradient 
              // เปลี่ยนจากสีชมพู เป็นโทนสีน้ำตาลไม้ (Light Oak -> Dark Walnut)
              colors={['#a7855b', '#b66214']} 
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
              style={styles.submitBtnGradient}
            >
                {loading ? <ActivityIndicator color="#fff" /> : (
                    <>
                        <Text style={styles.btnPrimaryText}>Create Your Trip</Text>
                    </>
                )}
            </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => router.back()} disabled={loading}>
          <Text style={styles.btnGhostText}>Back</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={loading} transparent animationType="fade">
        {/* ใส่ Overlay ทำพื้นหลังสีดำโปร่งแสง และจัดให้อยู่ตรงกลางจอ */}
        <View style={styles.loadingOverlay}>
          
          {/* ใส่ Card สีขาวขอบมน พร้อมเงาสีชมพูให้ดูเด่นเด้งขึ้นมา */}
          <View style={styles.loadingCard}>
            
            <LottieView
                source={require('@/assets/images/CreateTrip/Airplane.json')}
                autoPlay
                loop
                style={{ width: 180, height: 180 }} // ปรับขนาดให้ใหญ่ขึ้นอีกนิดให้เด่นๆ
              />
              
              {/* เพิ่มข้อความให้ผู้ใช้รู้ว่า AI กำลังทำงานอยู่ */}
              <Text style={styles.loadingTitle}>Planning Your Journey...</Text>
              <Text style={styles.loadingSub}>
                 We’re finding the best places for you. This will only take a moment.
              </Text>

          </View>
        </View>
      </Modal>

      <Modal visible={alertConfig.visible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            
            {/* แสดง Animation ตามสถานะ */}
            {alertConfig.isSuccess ? (
              <ApproveAnimation size={120} loop={true} />
            ) : (
              <WrongAnimation size={120} loop={true} />
            )}

            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>

            {/* ปุ่มกดตกลง */}
            <TouchableOpacity style={styles.alertBtn} onPress={closeAlert} activeOpacity={0.8}>
              <LinearGradient 
                // สีเขียวถ้าสำเร็จ สีชมพูแดงถ้าผิดพลาด
                colors={alertConfig.isSuccess ? ['#66BB6A', '#43A047'] : ['#FFA0B4', '#FF526C']} 
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
                style={styles.alertBtnGradient}
              >
                <Text style={styles.alertBtnText}>View Details</Text>
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:20, gap:16 },
  title:{ fontSize:22, fontWeight:'800' },
  sub:{ color:'#6b7280', marginBottom:8 },
  field:{ gap:6 },
  label:{ fontSize:13, color:'#374151' },
  input:{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:12, padding:12, fontSize:16, backgroundColor:'#fff' },
  row:{ flexDirection:'row', alignItems:'flex-end', gap:12 },

  dateBtn:{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:12, padding:12, backgroundColor:'#fff' },
  dateText:{ fontSize:16, color: '#111' },

  imagePicker: {
    width: '100%', height: 160,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', marginBottom: 10
  },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { alignItems: 'center', gap: 6 },
  imagePlaceholderText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  editIconBadge: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20
  },

  btn:{ padding:16, borderRadius:12, alignItems:'center' },
  btnPrimary:{ backgroundColor:'#111827' },
  btnPrimaryText:{ color:'#fff', fontSize:16, fontWeight:'700', textAlign: 'center' },
  btnGhost:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb' },
  btnGhostText:{ color:'#111827', fontSize:16, fontWeight:'700', textAlign: 'center' },
  card: {
    width: 140,
    height: 150,
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  image: {
    width: "100%",
    height: 100,
  },
  cardText: {
    padding: 8,
    fontSize: 14,
    fontWeight: "600",
  },
   selectBtn: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff',
  },
  selectBtnText: { color: '#333' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipText: { color: '#334155' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  searchInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    backgroundColor: '#fff',
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#cbd5e1',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  checkboxTick: { color: '#fff', fontWeight: '900', lineHeight: 18 },
  cityName: { fontSize: 16, color: '#111827' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  modalCancel: { backgroundColor: '#fff' },
  modalApply: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  modalBtnText: { fontWeight: '700' },
  // --- Loading Modal Styles ---
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // พื้นหลังสีดำโปร่งแสง
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#FF6B81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4A3B3D',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSub: {
    fontSize: 14,
    color: '#7A6B6D',
    textAlign: 'center',
    lineHeight: 22,
  },
  // --- Custom Alert Styles ---
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#FF6B81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4A3B3D',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: '#7A6B6D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  alertBtn: {
    width: '100%',
    borderRadius: 16,
    shadowColor: '#FF526C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  alertBtnGradient: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  alertBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // --- Styles สำหรับปุ่ม Create Trip แบบใหม่ ---
  submitBtnWrapper: {
    marginTop: 10, 
    borderRadius: 25, 
    // เปลี่ยนเงาเป็นสีน้ำตาลเข้ม
    shadowColor: '#8B5A2B', 
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, 
    shadowRadius: 8, 
    elevation: 5
  },
  submitBtnGradient: {
    flexDirection: 'row', 
    paddingVertical: 16, 
    borderRadius: 25,
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8
  },

});
