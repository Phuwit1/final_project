// app/trip/ai-create.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  image_url?: string;
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

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await axios.get(`${API_BASE}/cities`, { headers });
        setCities(res.data ?? []);
      } catch (e) {
        console.error("fetch cities error", e);
      }
    };
    fetchCities();
  }, []);

   const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city)
        ? prev.filter(c => c !== city)   // ถ้าเลือกแล้ว → เอาออก
        : [...prev, city]                // ถ้ายังไม่เลือก → เพิ่มเข้าไป
    );
  }

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
      `${API_BASE}/trip_plan`,
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
      text: selectedCities.join(', '),
    };

    console.log("LLM request body:", llmBody);

    const llm = await axios.post(`${API_BASE}/llm/`, llmBody, {
      headers,
      timeout: 45000,
    });

    const data: any = typeof llm.data === 'string'
      ? JSON.parse(llm.data)
      : llm.data;

    // 3) บันทึก itinerary (ทั้งก้อน JSON) ลง DB
    await axios.post(
      `${API_BASE}/trip_schedule`,
      {
        plan_id: planId,
        payload: data,   // ✅ ส่ง JSON ตรงๆ
      },
      { headers, timeout: 45000 }
    );

    // 4) ไปหน้า Trip detail
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
        <Text style={styles.title}>✨ สร้างทริปใหม่ด้วย AI</Text>
        <Text style={styles.sub}>ใส่ข้อมูล แล้วให้ AI จัด Daily Trip ให้เลย</Text>

        <View style={styles.field}>
          <Text style={styles.label}>ชื่อทริป</Text>
          <TextInput value={tripName} onChangeText={setTripName} placeholder="เช่น Tokyo Autumn" style={styles.input} />
        </View>

        <View style={styles.field}>
         <Text style={styles.label}>เลือกเมือง</Text>
          {cities.length === 0 ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={cities}
              horizontal
              keyExtractor={(item, index) => item.id ? String(item.id) : `city-${index}`}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selectedCities.includes(item.name);
                return (
                  <TouchableOpacity
                    onPress={() => toggleCity(item.name)}
                    style={[styles.card, isSelected && styles.cardSelected]}
                  >
                    <Image source={{ uri: item.image_url }} style={styles.image} />
                    <Text style={styles.cardText}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
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
});
