// app/trip/detail.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, TextInput, ScrollView, TouchableOpacity, 
  Alert, ActivityIndicator, StyleSheet, 
  Modal, Image, SafeAreaView, FlatList
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js'

type City = {
  id: number;
  name: string;
};

export default function TripDetail() {
  const { planId, cities: citiesParam } = useLocalSearchParams(); // รับจาก router
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const [schedule, setSchedule] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState<any>(null);

  const [allCities, setAllCities] = useState<City[]>([]);
  const [currentSelectedCities, setCurrentSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState('');
  

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

        const citiesRes = await axios.get(`${API_URL}/cities`);
        if (citiesRes.data && Array.isArray(citiesRes.data.items)) {
          setAllCities(citiesRes.data.items);
        }

        if (citiesParam) {
          const parsedCities = JSON.parse(citiesParam as string);
          setCurrentSelectedCities(parsedCities);
        }
        
      } catch (e) {
        console.error("โหลดแผนไม่สำเร็จ:", e);
        Alert.alert("โหลดแผนไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [planId]);

  const toggleCity = (cityName: string) => {
    setCurrentSelectedCities((prev) => {
      if (prev.includes(cityName)) {
        return prev.filter((c) => c !== cityName);
      } else {
        return [...prev, cityName];
      }
    });
  };

  const filteredCities = useMemo(() => {
    return allCities.filter((c) =>
      c.name.toLowerCase().includes(citySearch.toLowerCase())
    );
  }, [allCities, citySearch]);

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
  };

  const handleRegenerate = async () => {
    if (currentSelectedCities.length === 0) {
      Alert.alert("แจ้งเตือน", "กรุณาเลือกเมืองอย่างน้อย 1 เมือง");
      return;
    }

    setAddModalVisible(false); // ปิด Modal
    setSaving(true); // เปิด Loading

    try {
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const toDDMMYYYY = (ymd: string) => {
        const [y, m, d] = ymd.split("-");
        return `${d}/${m}/${y}`;
      };

      const startDate = schedule.itinerary[0]?.date ?? "";
      const endDate = schedule.itinerary[schedule.itinerary.length - 1]?.date ?? "";

      // เรียก AI แบบ Re-plan (เปลี่ยนเมือง / เปลี่ยนความต้องการ)
      // เราใช้ text ที่ผู้ใช้กรอกใหม่ + เมืองใหม่
      const res = await axios.post(`${API_URL}/llm/fix/`, 
        { 
          start_date: toDDMMYYYY(startDate),
          end_date: toDDMMYYYY(endDate),
          cities: currentSelectedCities, 
          // ส่ง prompt บอก AI ว่าเป็นการ Re-plan ตามความต้องการใหม่
          text: `${newNote}`,
          itinerary_data: editedSchedule
        }, 
        { headers }
      );
      
      const revised = res.data;

      // บันทึกผลลัพธ์ใหม่ลง DB
      await axios.put(`${API_URL}/trip_schedule/${planId}`, 
        { plan_id: planId, payload: revised }, 
        { headers }
      );

      setSchedule(revised);
      setEditedSchedule(revised);
      setNewNote(""); // ล้างข้อความ
      Alert.alert("สำเร็จ", "AI สร้างแผนใหม่ให้คุณเรียบร้อยแล้ว ✨");

    } catch (e) {
      console.error("แก้ไขแผนใหม่ไม่สำเร็จ:", e);
      Alert.alert("Error", "ไม่สามารถสร้างแผนใหม่ได้");
    } finally {
      setSaving(false);
    }
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
            <Text style={styles.addButtonText}>แก้ไขใหม่</Text>
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
            <Text style={styles.modalTitle}>แก้ไขแผนการเดินทางใหม่</Text>
            <Text style={styles.modalSubtitle}>กรอกความต้องการสถานที่ ที่ท่านอยากไป</Text>

            <Text style={styles.label}>เลือกเมืองที่ต้องการไป</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาเมือง..."
              value={citySearch}
              onChangeText={setCitySearch}
            />
            <View style={styles.cityListContainer}>
              <FlatList
                data={filteredCities}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                  const isChecked = currentSelectedCities.includes(item.name);
                  return (
                    <TouchableOpacity 
                      style={styles.cityRow} 
                      onPress={() => toggleCity(item.name)}
                    >
                      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                        {isChecked && <Ionicons name="checkmark" size={14} color="white" />}
                      </View>
                      <Text style={styles.cityText}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <Text style={[styles.label, { marginTop: 10 }]}>ความต้องการเพิ่มเติม</Text>
            <TextInput 
              style={styles.modalInput}
              placeholder="เช่น อยากเน้นกิน, อยากไปวัด, ไม่รีบ..."
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
                onPress={handleRegenerate}
              >
                <Text style={[styles.modalBtnText, { color: 'white' }]}>แก้ไข</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- 5. Loading Modal (ระหว่างรอ Save) --- */}
      <Modal transparent={true} animationType="fade" visible={saving} onRequestClose={()=>{}}>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFA500" />
            <Text style={styles.loadingText}>กำลังปรับปรุงแผน...</Text>
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
    width: 100,
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
    fontSize: 16,
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
    backgroundColor: '#f3606cff',
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
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
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
  },

  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#f9f9f9' },
  cityListContainer: { height: 200, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 10 },
  cityRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  checkboxChecked: { backgroundColor: '#FFA500', borderColor: '#FFA500' },
  cityText: { fontSize: 16, color: '#333' },

});
