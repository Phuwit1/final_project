// app/trip/detail.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, ScrollView } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';

const API_BASE = 'http://192.168.1.45:8000';

export default function TripDetail() {
  const { planId, cities: citiesParam } = useLocalSearchParams(); // รับจาก router
  const router = useRouter();

  // const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [schedule, setSchedule] = useState<any>(null);
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState<any>(null);
  
  const selectedCities = citiesParam ? JSON.parse(citiesParam  as string) : [];

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await axios.get(`${API_BASE}/trip_schedule/${planId}`, { headers });
        // setPayload(res.data?.payload);

        const payload = res.data?.payload;
        setSchedule(payload);
        setEditedSchedule(JSON.parse(JSON.stringify(payload)));
      } catch (e) {
        console.error("โหลดแผนไม่สำเร็จ:", e);
        Alert.alert("โหลดแผนไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [planId]);

    const updateActivity = (dayIdx: number, actIdx: number, field: string, value: string) => {
    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      copy.itinerary[dayIdx].schedule[actIdx][field] = value;
      return copy;
    });
  };

  const confirmPlan = async () => {

    const changed = JSON.stringify(schedule) !== JSON.stringify(editedSchedule);

     if (!changed) {
        Alert.alert("ไม่มีการแก้ไข", "แผนถูกยืนยันเรียบร้อยแล้ว ✅");
        router.replace({ pathname: "/(tabs)/mytrip" });
        return;
      }

    // if (!edited) {
    //   Alert.alert("✅ ยืนยัน", "ไม่มีการแก้ไข แผนไม่ถูกเปลี่ยนแปลง");
    //   router.replace({ pathname: "/(tabs)/mytrip" });
    //   return;
    // }

   

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const body = {
        start_date: schedule.itinerary[0]?.date ?? "",
        end_date: schedule.itinerary[schedule.itinerary.length - 1]?.date ?? "",
        cities: selectedCities, // ✅ สามารถส่ง cities ที่ผู้ใช้เลือกไว้
        text: "User revised the plan", // ✅ อธิบายเหตุผลสั้นๆ
        itinerary_data: editedSchedule,
      };

       const toDDMMYYYY = (ymd: string) => {
        const [y, m, d] = ymd.split("-");
        return `${d}/${m}/${y}`;
      };

      const startDate = schedule.itinerary[0]?.date ?? "";
      const endDate = schedule.itinerary[schedule.itinerary.length - 1]?.date ?? "";

      // 1) ส่งไปให้ LLM revise
      const res = await axios.post(`${API_BASE}/llm/fix/`, 
        { 
        start_date: toDDMMYYYY(startDate),
        end_date: toDDMMYYYY(endDate),
        cities: selectedCities, // ✅ สามารถส่ง cities ที่ผู้ใช้เลือกไว้
        text: "User revised the plan", // ✅ อธิบายเหตุผลสั้นๆ
        itinerary_data: editedSchedule
        }, 
        { headers });
      const revised = res.data;

    

      // 2) PUT กลับไปแก้ใน DB
      await axios.put(`${API_BASE}/trip_schedule/${planId}`, 
        { 
          plan_id: planId,
          payload: revised 
        }, 
        { headers });

      Alert.alert("สำเร็จ", "บันทึกแผนที่แก้ไขแล้ว");
      router.replace({ pathname: "/(tabs)/mytrip" });
    } catch (e) {
      console.error("บันทึกไม่สำเร็จ:", e);
      
      Alert.alert("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

   const currentDay = editedSchedule.itinerary[page];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        ✨ {currentDay.day} - {currentDay.date}
      </Text>

      <ScrollView style={{ flex: 1 }}>
        {currentDay.schedule.map((item: any, i: number) => (
          <View key={i} style={styles.card}>
            <Text style={styles.label}>เวลา</Text>
            <TextInput
              style={styles.input}
              value={item.time}
              onChangeText={(val) => updateActivity(page, i, "time", val)}
            />

            <Text style={styles.label}>กิจกรรม</Text>
            <TextInput
              style={styles.input}
              value={item.activity}
              onChangeText={(val) => updateActivity(page, i, "activity", val)}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.pagination}>
        <TouchableOpacity
          onPress={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          style={[styles.btn, page === 0 && { backgroundColor: "#ccc" }]}
        >
          <Text style={styles.btnText}>⬅️ ก่อนหน้า</Text>
        </TouchableOpacity>

        {page < editedSchedule.itinerary.length - 1 ? (
          <TouchableOpacity
            onPress={() =>
              setPage((p) => Math.min(editedSchedule.itinerary.length - 1, p + 1))
            }
            style={styles.btn}
          >
            <Text style={styles.btnText}>ถัดไป ➡️</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={confirmPlan} style={[styles.btn, styles.btnConfirm]}>
            <Text style={styles.btnText}>✅ ยืนยันแผน</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  card: { padding: 12, marginBottom: 12, backgroundColor: "#f9f9f9", borderRadius: 8 },
  label: { fontWeight: "600", marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 6, padding: 8, marginBottom: 8 },
  pagination: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  btn: { padding: 12, backgroundColor: "#007AFF", borderRadius: 6 },
  btnText: { color: "#fff", fontWeight: "600" },
  btnConfirm: { backgroundColor: "green" },

});
