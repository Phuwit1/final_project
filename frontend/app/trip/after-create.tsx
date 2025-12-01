// app/trip/ai-create.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, FlatList, Modal, Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '@/api.js'
// 👉 เปลี่ยนให้เป็นของโปรเจกต์คุณ (หรือ import จาก config)
const API_BASE = 'http://192.168.1.45:8000';

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

type City = {
  id: number;
  name: string;
};

const toHHmmss = (t?: string) => {
  if (!t) return '09:00:00';
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return '09:00:00';
  return `${m[1].padStart(2, '0')}:${m[2]}:00`;
};



// Date -> 'DD/MM/YYYY' (ตามสเปค /llm/)
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

const CITY_OPTIONS = ["Tokyo", "Osaka", "Kyoto", "Nagoya", "Sapporo"];

export default function AICreateTrip() {
  const router = useRouter();

  const [tripName, setTripName] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [triprequest, setTripRequest] = useState('');

  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [citySearch, setCitySearch] = useState(''); 
  const [loadingCities, setLoadingCities] = useState(false);

  // วันที่เริ่ม/จบ (ห้ามย้อนหลัง, end ≥ start)
  const today = new Date(); today.setHours(0,0,0,0);
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [picker, setPicker] = useState<{ show: boolean; mode: 'start' | 'end' }>({ show: false, mode: 'start' });

  const [loading, setLoading] = useState(false);

  const openPicker = (mode: 'start' | 'end') => setPicker({ show: true, mode });


  const onChangeDate = (_: any, selected?: Date) => {
    setPicker(p => ({ ...p, show: false }));
    if (!selected) return;
    const picked = new Date(selected); picked.setHours(0,0,0,0);

    if (picked < today) {
      Alert.alert('ไม่สามารถเลือกวันในอดีตได้');
      return;
    }
    if (picker.mode === 'start') {
      setStartDate(picked);
      if (picked > endDate) setEndDate(picked);
    } else {
      if (picked < startDate) {
        Alert.alert('วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น');
        return;
      }
      setEndDate(picked);
    }
  };

const toggleCity = (name: string) => {
  setSelectedCities(prev =>
    prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
  );
};

// filter รายชื่อเมืองตามช่องค้นหา (ฝั่ง client)
const filteredCities = useMemo(() => {
  const q = citySearch.trim().toLowerCase();
  if (!q) return cities;
  return cities.filter(c => c.name.toLowerCase().includes(q));
}, [cities, citySearch]);


const CITIES_ENDPOINT = `${API_URL}/cities`; // หรือ /cities

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
      })).filter(x => Number.isFinite(x.id) && x.name);

      if (mounted) setCities(normalized);
    } catch (e) {
      console.error('Load cities error:', e);
      if (mounted) Alert.alert('โหลดรายชื่อเมืองไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
    } finally {
      if (mounted) setLoadingCities(false);
    }
  })();
  return () => { mounted = false; };
}, []);


const onCreateWithAI = async () => {
  try {
    if (!tripName.trim()) {
      Alert.alert('กรุณาใส่ชื่อทริป');
      return;
    }

    setLoading(true);
    const token = await AsyncStorage.getItem('access_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    // 1) สร้างทริปใหม่ก่อน (ยังไม่มี plan_id)
    const createPayload = {
      name_group: tripName.trim(),
      start_plan_date: toYMD(startDate),
      end_plan_date: toYMD(endDate),
    };
    const created = await axios.post(
      `${API_URL}/trip_plan`,
      createPayload,
      { headers, timeout: 30000 }
    );

    const planId: number = Number(created.data?.plan_id);
    const tripIdForRoute: string = String(
      created.data?.trip_id ?? created.data?.plan_id
    ); // fallback ถ้าไม่มี trip_id

    if (!Number.isFinite(planId)) {
      Alert.alert('สร้างทริปไม่สำเร็จ', 'ไม่พบ plan_id จากเซิร์ฟเวอร์');
      setLoading(false);
      return;
    }


    // 2) ขอให้ LLM สร้าง itinerary
    const llmBody = {
      start_date: toDDMMYYYY_fromDate(startDate),
      end_date: toDDMMYYYY_fromDate(endDate),
      cities : selectedCities,
      text: triprequest,
    };

    console.log("LLM request body:", llmBody);

    const llm = await axios.post(`${API_URL}/llm/`, llmBody, {
      headers,
      timeout: 45000,
    });

    const data: any = typeof llm.data === 'string'
      ? JSON.parse(llm.data)
      : llm.data;


    await axios.post(
      `${API_URL}/trip_schedule`,
      {
        plan_id: planId,
        payload: data, 
      },
      { headers } 
    );

    Alert.alert('สำเร็จ', `สร้างทริปและแผนรายวันด้วย AI แล้ว`, [
      {
        text: 'ดูแผน',
        onPress: () =>
          router.push({
            pathname: "/trip/scheduledetail",
            params: { 
              planId: planId,
              cities: JSON.stringify(selectedCities) 
            }
          }),
        }
    ]);
  } catch (e: any) {
    console.error(
      'AI create trip error:',
      e?.response?.data ?? e?.message ?? e
    );
    Alert.alert('สร้างไม่สำเร็จ', 'กรุณาลองใหม่ หรือตรวจสอบเซิร์ฟเวอร์');
  } finally {
    setLoading(false);
  }
};


  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.container}>
        <Text style={styles.title}>✨ สร้างทริปใหม่ ✨</Text>
        <Text style={styles.sub}>ใส่ข้อมูล แล้วให้ AI จัด Daily Trip ให้เลย</Text>

        <View style={styles.field}>
          <Text style={styles.label}>ชื่อทริป</Text>
          <TextInput value={tripName} onChangeText={setTripName} placeholder="เช่น Tokyo Autumn" style={styles.input} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>เลือกเมือง</Text>

          {/* ปุ่มเปิด Modal */}
          <TouchableOpacity style={styles.selectBtn} onPress={() => setCityModalVisible(true)}>
            <Text style={styles.selectBtnText}>
              {selectedCities.length > 0 ? selectedCities.join(', ') : 'เลือกหลายเมือง'}
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
              <Text style={styles.modalTitle}>เลือกเมือง</Text>

              {/* ช่องค้นหา */}
              <TextInput
                placeholder="ค้นหาเมือง..."
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
                      ไม่พบเมืองที่ค้นหา
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
                  <Text style={styles.modalBtnText}>ปิด</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalApply]} onPress={() => setCityModalVisible(false)}>
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>ยืนยัน</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.field}>
          <Text style={styles.label}>ความต้องการ</Text>
          <TextInput value={triprequest} onChangeText={setTripRequest} placeholder="เช่น อยากไปดูซากุระ" style={styles.input} />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>วันที่ไป</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('start')}>
              <Text style={styles.dateText}>{startDate.toDateString()}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>วันที่กลับ</Text>
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

        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onCreateWithAI} disabled={loading || !tripName}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>สร้างทริปด้วย AI</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => router.back()} disabled={loading}>
          <Text style={styles.btnGhostText}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>
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

  btn:{ padding:16, borderRadius:12, alignItems:'center' },
  btnPrimary:{ backgroundColor:'#111827' },
  btnPrimaryText:{ color:'#fff', fontSize:16, fontWeight:'700' },
  btnGhost:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb' },
  btnGhostText:{ color:'#111827', fontSize:16, fontWeight:'700' },
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
});
