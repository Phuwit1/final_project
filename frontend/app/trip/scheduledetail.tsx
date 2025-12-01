// app/trip/detail.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, Text, TextInput, ScrollView, TouchableOpacity, 
  Alert, ActivityIndicator, StyleSheet, 
  Modal, Image, SafeAreaView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js'

export default function TripDetail() {
  const { planId, cities: citiesParam } = useLocalSearchParams(); // รับจาก router
  const router = useRouter();

  // const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any>(null);
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState<any>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newNote, setNewNote] = useState("");
  
  const selectedCities = citiesParam ? JSON.parse(citiesParam  as string) : [];

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await axios.get(`${API_URL}/trip_schedule/${planId}`, { headers });
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
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const toDDMMYYYY = (ymd: string) => {
        const [y, m, d] = ymd.split("-");
        return `${d}/${m}/${y}`;
      };

      const startDate = schedule.itinerary[0]?.date ?? "";
      const endDate = schedule.itinerary[schedule.itinerary.length - 1]?.date ?? "";
      // 1) ส่งไปให้ LLM revise
      const res = await axios.post(`${API_URL}/llm/fix/`, 
        { 
        start_date: toDDMMYYYY(startDate),
        end_date: toDDMMYYYY(endDate),
        cities: selectedCities, 
        text: "This is the user's finalized itinerary. Please strictly PRESERVE all activities, times, and order exactly as provided. Do not change the schedule. Only polish the descriptions and fill in missing specific_location_name or lat/lng coordinates if they are null.", // ✅ อธิบายเหตุผลสั้นๆ
        itinerary_data: editedSchedule
        }, 
        { headers });
      const revised = res.data;

    

      // 2) PUT กลับไปแก้ใน DB
      await axios.put(`${API_URL}/trip_schedule/${planId}`, 
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
  const handleAddNote = () => {
    // Logic สำหรับปุ่มเพิ่ม (หน้าสุด)
    console.log("Adding note:", newNote);
    Alert.alert("บันทึก", `เพิ่มข้อมูล: ${newNote} เรียบร้อย (ตัวอย่าง)`);
    setAddModalVisible(false);
    setNewNote("");
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const currentDay = editedSchedule.itinerary[selectedDayIndex];

  return (
   <SafeAreaView style={styles.container}>
      
      {/* --- 1. ส่วนเลือกวัน (Header) --- */}
      <View style={styles.headerContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.dayList}
        >
          {/* ปุ่มเพิ่ม (+) อยู่หน้าสุด */}
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addButtonText}>เพิ่ม</Text>
          </TouchableOpacity>

          {/* รายการวัน */}
          {editedSchedule.itinerary.map((item: any, index: number) => {
            const isSelected = selectedDayIndex === index;
            // แปลงวันที่เป็นรูปแบบสั้นๆ เช่น 2025-10-12 -> 12/10
            const dateParts = item.date ? item.date.split('-') : []; 
            const shortDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : item.date;

            return (
              <TouchableOpacity
                key={index}
                style={[styles.dayChip, isSelected && styles.selectedDayChip]}
                onPress={() => setSelectedDayIndex(index)}
              >
                <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>
                  {item.day}
                </Text>
                <Text style={[styles.dateText, isSelected && styles.selectedDateText]}>
                  {shortDate}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* --- 2. ส่วนแสดงรายละเอียดกิจกรรม (Body) --- */}
      <View style={styles.bodyContainer}>
        <Text style={styles.dayTitle}>
          ✨ {currentDay.day} - {currentDay.date}
        </Text>
        
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {currentDay.schedule.map((item: any, i: number) => (
            <View key={`${selectedDayIndex}-${i}`} style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>เวลา</Text>
                <TextInput
                  style={styles.input}
                  value={item.time}
                  onChangeText={(val) => updateActivity(selectedDayIndex, i, "time", val)}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>กิจกรรม</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  multiline
                  value={item.activity}
                  onChangeText={(val) => updateActivity(selectedDayIndex, i, "activity", val)}
                />
              </View>
            </View>
          ))}
          {/* เว้นที่ด้านล่างเผื่อปุ่ม Confirm บัง */}
          <View style={{ height: 80 }} /> 
        </ScrollView>
      </View>

      {/* --- 3. ปุ่มยืนยัน (Footer) --- */}
      <View style={styles.footerContainer}>
        <TouchableOpacity onPress={confirmPlan} style={styles.confirmButton}>
          <Text style={styles.confirmButtonText}>✅ ยืนยันแผน</Text>
        </TouchableOpacity>
      </View>

      {/* --- 4. Modal สำหรับปุ่มเพิ่ม --- */}
      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เพิ่มรายละเอียด</Text>
            <Text style={styles.modalSubtitle}>กรอกข้อมูลที่ต้องการเพิ่มในทริป</Text>
            
            <TextInput 
              style={styles.modalInput}
              placeholder="เช่น จองตั๋วรถไฟ, นัดเจอไกด์..."
              value={newNote}
              onChangeText={setNewNote}
              multiline
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]} 
                onPress={handleAddNote}
              >
                <Text style={[styles.modalBtnText, { color: 'white' }]}>เพิ่ม</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- 5. Loading Modal (ระหว่างรอ Save) --- */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={saving}
        onRequestClose={() => {}}
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFA500" />
            <Text style={styles.loadingText}>กำลังบันทึกและปรับปรุงแผน...</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  
  // Header Day Selector
  headerContainer: {
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dayList: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  addButton: {
    width: 60,
    height: 60,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  dayChip: {
    width: 60,
    height: 60,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedDayChip: {
    backgroundColor: '#FFA500',
    borderColor: '#FFA500',
    transform: [{ scale: 1.05 }],
  },
  dayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  selectedDayText: {
    color: 'white',
  },
  dateText: {
    fontSize: 10,
    color: '#999',
  },
  selectedDateText: {
    color: 'rgba(255,255,255,0.8)',
  },

  // Body
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: '#333',
  },
  card: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  inputGroup: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#FFF',
    color: '#333',
  },

  // Footer Confirm Button
  footerContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  confirmButton: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  saveBtn: {
    backgroundColor: '#FFA500',
  },
  modalBtnText: {
    fontWeight: 'bold',
    color: '#333',
  },

  // Loading Overlay
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontWeight: '600',
    color: '#333',
  }
});
