import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js'

dayjs.locale('th');

const API_BASE = `${API_URL}`;

// ===== ชนิดข้อมูลจาก API =====
type DBScheduleRow = {
  schedule_id: number;
  plan_id: number;
  date: string;           // ISO DateTime (db.Date) เช่น "2025-10-10T00:00:00.000Z"
  time: string;           // ISO DateTime (db.Time) เช่น "1970-01-01T09:00:00.000Z"
  activity: string;
  description: string;
  creat_at?: string;
};

// ===== โครงให้แสดงต่อวัน =====
type DisplayItem = {
  schedule_id: number;
  hhmm: string;           // "HH:mm"
  activity: string;
  description: string;
};

type DailyData = {
  day: number;            // 1-based
  dateISO: string;        // 'YYYY-MM-DD'
  items: DisplayItem[];   // เรียงเวลาแล้ว
};

export type DailyPlanTabsHandle = {
  setActiveDay: (index: number) => void;  // 0-based
  reload: () => void;                     // รีเฟรชจาก DB
};

type Props = {
  planId: number;
  startDate: string;     // ISO
  endDate: string;       // ISO
};

function buildDayRange(startISO: string, endISO: string): string[] {
  const s = dayjs(startISO);
  const e = dayjs(endISO);
  const total = Math.max(1, e.diff(s, 'day') + 1);
  return Array.from({ length: total }).map((_, i) => s.add(i, 'day').format('YYYY-MM-DD'));
}

const DailyPlanTabs = forwardRef<DailyPlanTabsHandle, Props>(function DailyPlanTabs(
  { planId, startDate, endDate },
  ref
) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<DailyData[]>([]);

  const dayKeys = useMemo(() => buildDayRange(startDate, endDate), [startDate, endDate]);

 const fetchSchedules = async () => {
  setLoading(true);
  try {
    const token = await AsyncStorage.getItem('access_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${API_BASE}/trip_schedule/${planId}`;
    const res = await axios.get(url, { headers, timeout: 30000 });

    const payload = res.data?.payload;
    if (!payload || !payload.itinerary) {
      setDays([]);
      return;
    }

    // map itinerary จาก payload
    const packed: DailyData[] = payload.itinerary.map((day: any, idx: number) => {
      const items: DisplayItem[] = (day.schedule ?? []).map((s: any, i: number) => ({
        schedule_id: `${idx}-${i}`, // ไม่มี id จริง เอา index ทำ key
        hhmm: s.time,
        activity: s.activity,
        description: s.specific_location_name ?? "",
      }));

      return {
        day: idx + 1,
        dateISO: day.date,
        items,
      };
    });

    setDays(packed);
  } catch (e: any) {
    console.error("fetchSchedules error:", e?.response?.data ?? e?.message ?? e);
    Alert.alert("ดึงข้อมูลไม่สำเร็จ", "ตรวจสอบเครือข่าย/สิทธิ์การเข้าถึง");
  } finally {
    setLoading(false);
  }
};
  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, startDate, endDate]);

  useImperativeHandle(ref, () => ({
    setActiveDay: (index: number) => {
      const i = Math.max(0, Math.min(index, dayKeys.length - 1));
      setSelectedDay(i + 1);
    },
    reload: () => fetchSchedules(),
  }));

  // === Add activity (POST /trip_schedule) ===
  const [modalVisible, setModalVisible] = useState(false);
  const [newTime, setNewTime] = useState('09:00');  // 'HH:mm'
  const [newDesc, setNewDesc] = useState('');

  const addActivity = async () => {
    const desc = newDesc.trim();
    if (!desc) return;

    // แปลง 'HH:mm' -> 'HH:mm:00'
    const hhmmss = /^\d{1,2}:\d{2}$/.test(newTime) ? `${newTime}:00` : newTime;

    try {
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const body = {
        plan_id: planId,
        date: dayKeys[selectedDay - 1], // 'YYYY-MM-DD'
        time: hhmmss,
        activity: desc,
        description: '',
      };

      await axios.post(`http://192.168.1.45:8000/trip_schedule`, body, {
        headers,
        timeout: 20000,
      });

      setModalVisible(false);
      setNewTime('09:00');
      setNewDesc('');
      // รีเฟรชจาก DB ให้ตรงกัน
      fetchSchedules();
    } catch (e: any) {
      console.error('addActivity error:', e?.response?.data ?? e?.message ?? e);
      Alert.alert('บันทึกไม่สำเร็จ', 'กรุณาลองใหม่');
    }
  };

  const current = days.find(d => d.day === selectedDay);

  return (
    <View>
      {/* ปุ่ม Day 1..N */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayButtonContainer}>
        {dayKeys.map((key, i) => {
          const day = i + 1;
          const dateLabel = dayjs(key).format('D MMM');
          return (
            <TouchableOpacity
              key={key}
              style={[styles.dayButton, selectedDay === day && styles.dayButtonSelected]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={styles.dayButtonText}>{`Day ${day}`}</Text>
              <Text style={styles.dayDate}>{dateLabel}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={fetchSchedules}
          style={[styles.dayButton, { backgroundColor: '#E5F3FF' }]}
        >
          {loading ? <ActivityIndicator /> : <Text style={{ fontWeight: '600' }}>รีเฟรช</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* รายการของวัน */}
      <View style={styles.planContainer}>
        <Text style={styles.planTitle}> {dayjs(dayKeys[selectedDay - 1]).format('D MMMM YYYY')}</Text>

        {loading && (!current || current.items.length === 0) ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : current && current.items.length > 0 ? (
          current.items.map((it) => (
            <View key={it.schedule_id} style={styles.row}>
              <Text style={styles.time}>{it.hhmm}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.activity}>{it.activity}</Text>
                {!!it.description && <Text style={styles.desc}>{it.description}</Text>}
              </View>
              {/* ถ้ามี DELETE endpoint ค่อยใส่ปุ่มลบจริง ๆ ตรงนี้ */}
            </View>
          ))
        ) : (
          <Text style={{ color: '#555' }}>ยังไม่มีรายการ</Text>
        )}

        {/* ปุ่มเพิ่ม */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ เพิ่มกิจกรรม</Text>
        </TouchableOpacity>
      </View>

      {/* Modal เพิ่มกิจกรรม */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>เพิ่มกิจกรรม</Text>

            <Text style={styles.modalLabel}>เวลา (HH:mm)</Text>
            <TextInput
              value={newTime}
              onChangeText={setNewTime}
              placeholder="เช่น 09:00"
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.modalLabel}>รายละเอียดกิจกรรม</Text>
            <TextInput
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="เช่น เดินชมวัด Asakusa"
              style={styles.input}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setModalVisible(false)}>
                <Text style={{ color: '#555' }}>ยกเลิก</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={addActivity}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>บันทึก</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

export default DailyPlanTabs;

/* ============== Styles ============== */
const styles = StyleSheet.create({
  dayButtonContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dayButtonSelected: {
    backgroundColor: '#FF6B6B',
  },
  dayButtonText: {
    fontWeight: '600',
    color: '#000',
    fontSize: 16,
  },
  dayDate: {
    fontSize: 12,
    color: '#555',
  },
  planContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    marginHorizontal: 12,
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  time: {
    width: 60,
    fontWeight: '700',
    color: '#111',
  },
  activity: {
    color: '#111',
    fontSize: 15,
    marginBottom: 2,
  },
  desc: {
    color: '#666',
    fontSize: 13,
  },
  addBtn: {
    marginTop: 16,
    backgroundColor: '#FFD6D6',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D60000',
  },
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    width: '90%', backgroundColor: '#fff',
    padding: 16, borderRadius: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  modalLabel: { fontSize: 14, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#CCC',
    borderRadius: 8, padding: 10,
  },
  btn: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12,
  },
  btnGhost: {
    backgroundColor: '#F3F4F6',
  },
  btnPrimary: {
    backgroundColor: '#2563eb',
  },
});
