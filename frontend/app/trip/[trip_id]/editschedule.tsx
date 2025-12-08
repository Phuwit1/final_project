import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TextInput, ScrollView, TouchableOpacity, 
  Alert, ActivityIndicator, StyleSheet, 
  Modal, SafeAreaView, Platform
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_URL } from '@/api.js'; 
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { G } from 'react-native-svg';
//import '@/dotenv/config';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA73tpAfskui7aqX9GXabfGLU0OZ5HLC-U';

export default function EditSchedule() {
  // ✅ รับ trip_id จาก URL และ dayIndex จาก query param
  const { trip_id, dayIndex } = useLocalSearchParams();
  const router = useRouter();

  // ใช้ trip_id แทน planId ในการเรียก API (สมมติว่าเป็น ID ตัวเดียวกัน)
  const planId = trip_id; 

  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(dayIndex ? parseInt(dayIndex as string) : 0);
  
  const [schedule, setSchedule] = useState<any>(null);
  const [editedSchedule, setEditedSchedule] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [isSearchVisible, setIsSearchVisible] = useState(false);
  // เลือกวัน 
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTimeIndex, setTempTimeIndex] = useState<number | null>(null); // เก็บ index ของรายการที่กำลังแก้เวลา
  const [tempDate, setTempDate] = useState(new Date());
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          setLoading(true); // ควร set loading เป็น true ทุกครั้งที่ focus ใหม่
          const token = await AsyncStorage.getItem('access_token');
          const headers: any = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;

          // เรียก API ดึงข้อมูล
          const res = await axios.get(`${API_URL}/trip_schedule/${planId}`, { headers });
          const payload = res.data?.payload;
          
          setSchedule(payload);
          // ใช้ JSON.parse(JSON.stringify(...)) เพื่อ Deep Copy
          setEditedSchedule(JSON.parse(JSON.stringify(payload)));
        } catch (e) {
          console.error("โหลดข้อมูลไม่สำเร็จ:", e);
          Alert.alert("Error", "โหลดข้อมูลไม่สำเร็จ");
        } finally {
          setLoading(false);
        }
      };

      if (planId) {
        fetchData();
      }

      // Cleanup function (ถ้าจำเป็น เช่น cancel request)
      return () => {
        // ส่วนนี้จะทำงานเมื่อหน้าจอเสีย focus (เบลอ)
      };
    }, [planId]) // dependencies array
  );

  const updateActivity = (dayIdx: number, actIdx: number, field: string, value: string) => {
    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      copy.itinerary[dayIdx].schedule[actIdx][field] = value;
      return copy;
    });
  
  };

  const confirmPlan = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Update DB
      await axios.put(`${API_URL}/trip_schedule/${planId}`, 
        { plan_id: planId, payload: editedSchedule }, 
        { headers }
      );

      Alert.alert("สำเร็จ", "บันทึกการแก้ไขเรียบร้อยแล้ว ✅");
      router.back(); 
    } catch (e) {
      console.error("บันทึกไม่สำเร็จ:", e);
      Alert.alert("Error", "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const handleAddActivity = () => {
    setIsSearchVisible(true);
    console.log(GOOGLE_API_KEY);
  };

  const onPlaceSelected = (data: any, details: any = null) => {
    const name = data.description || data.name;
    const location = details?.geometry?.location; // ได้ { lat: ..., lng: ... }

    let nextTime = "09:00"; 
    const currentSchedule = editedSchedule.itinerary[selectedDayIndex].schedule;
    if (currentSchedule.length > 0) {
        const lastTime = currentSchedule[currentSchedule.length - 1].time;
        if (lastTime && lastTime.includes(":")) {
            const [hh, mm] = lastTime.split(":").map(Number);
            let newH = hh + 1; // บวกเพิ่ม 1 ชั่วโมง
            if (newH >= 24) newH -= 24;
            nextTime = `${newH.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
        }
    }

    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      // เพิ่มกิจกรรมพร้อมข้อมูลพิกัด
      copy.itinerary[selectedDayIndex].schedule.push({
        time: nextTime, // เวลาเริ่มต้น (อาจจะตั้งให้ฉลาดกว่านี้ได้)
        activity: name, // ใช้ชื่อสถานที่ที่เลือก
        need_location: true,
        specific_location_name: name,
        lat: location?.lat || null,
        lng: location?.lng || null
      });

      
      return copy;
    });

    setIsSearchVisible(false); // ปิด Modal
  };

  const openTimePicker = (timeStr: string, index: number) => {
    setTempTimeIndex(index);
    
    // แปลง string "HH:mm" เป็น Date Object เพื่อให้ Picker แสดงค่าเริ่มต้นถูก
    const now = new Date();
    const [hh, mm] = timeStr.split(':').map(Number);
    if (!isNaN(hh) && !isNaN(mm)) {
      now.setHours(hh);
      now.setMinutes(mm);
    }
    setTempDate(now);
    setShowTimePicker(true);
  };

  // ฟังก์ชันเมื่อเลือกเวลาเสร็จ
  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios'); // iOS ให้กด Done เอง, Android ปิดเลย
    
    if (selectedDate && tempTimeIndex !== null) {
      // แปลงกลับเป็น String "HH:mm"
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      const newTimeStr = `${hh}:${mm}`;

      // อัปเดตลง State หลัก
      updateActivity(selectedDayIndex, tempTimeIndex, "time", newTimeStr);
      
      if (Platform.OS === 'android') {
          setTempTimeIndex(null); // Reset index
      }
    } else {
        // กรณี Cancel
        setTempTimeIndex(null);
    }
  };


  const handleDeleteActivity = (actIdx: number) => {
    Alert.alert("ยืนยัน", "ต้องการลบกิจกรรมนี้ใช่หรือไม่?", [
      { text: "ยกเลิก", style: "cancel" },
      { 
        text: "ลบ", 
        style: "destructive",
        onPress: () => {
          setEditedSchedule((prev: any) => {
            const copy = { ...prev };
            // ลบกิจกรรมตาม index ออกจาก array
            copy.itinerary[selectedDayIndex].schedule.splice(actIdx, 1);
            return copy;
          });
        }
      }
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FFA500" />;
  if (!editedSchedule) return <View style={styles.container}><Text>ไม่พบข้อมูล</Text></View>;

  const currentDay = editedSchedule.itinerary[selectedDayIndex];

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Header: เลือกวัน */}
      <View style={styles.headerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayList}>
          {editedSchedule.itinerary.map((item: any, index: number) => {
            const isSelected = selectedDayIndex === index;
            const dateParts = item.date ? item.date.split('-') : []; 
            const shortDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : item.date;

            return (
              <TouchableOpacity
                key={index}
                style={[styles.dayChip, isSelected && styles.selectedDayChip]}
                onPress={() => setSelectedDayIndex(index)}
              >
                <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{item.day}</Text>
                <Text style={[styles.dateText, isSelected && styles.selectedDateText]}>{shortDate}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Body: รายการกิจกรรม */}
      
        <View style={styles.bodytop}>
            <View style={styles.dayHeaderRow}>
            <Text style={styles.dayTitle}>✨ {currentDay.day} - {currentDay.date}</Text>
            
            <TouchableOpacity onPress={handleAddActivity} style={styles.addButton}>
                <Ionicons name="add-circle" size={24} color="#28a745" />
                <Text style={styles.addButtonText}>เพิ่มกิจกรรม</Text>
            </TouchableOpacity>
            </View>
        </View>


        <View style={styles.bodyContainer}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {currentDay.schedule.map((item: any, i: number) => (
            <View key={`${selectedDayIndex}-${i}`} style={styles.cardContainer}>
              <View style={styles.card}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>เวลา</Text>

                  <TouchableOpacity onPress={() => openTimePicker(item.time, i)}>
                    <View style={styles.timeInputBox}>
                       <Text style={styles.timeText}>{item.time}</Text>
                       <Ionicons name="time-outline" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
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

              {/* ✅ ปุ่มลบ (ถังขยะ) อยู่ด้านขวาของการ์ด */}
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={() => handleDeleteActivity(i)}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 80 }} /> 
        </ScrollView>

        {showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          is24Hour={true}
          display="default" // หรือ "spinner"
          onChange={onTimeChange}
        />
      )}
      </View>

      {/* Footer: ปุ่มบันทึก */}
      <View style={styles.footerContainer}>
        <TouchableOpacity onPress={confirmPlan} style={styles.confirmButton}>
          <Text style={styles.confirmButtonText}>💾 บันทึกการแก้ไข</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isSearchVisible}
        animationType="slide"
        onRequestClose={() => setIsSearchVisible(false)}
      >
        <SafeAreaView style={styles.searchModalContainer}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>ค้นหาสถานที่</Text>
            <TouchableOpacity onPress={() => setIsSearchVisible(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.autocompleteContainer}>
            <GooglePlacesAutocomplete
              placeholder='พิมพ์ชื่อสถานที่...'
              onPress={onPlaceSelected}
              query={{
                key: GOOGLE_API_KEY,
                language: 'en', // หรือ 'en'
              }}
              fetchDetails={true} // สำคัญ! ต้องเป็น true ถึงจะได้ lat/lng
              styles={{
                textInput: styles.searchInput,
                listView: {
                  position: 'absolute',    // ✅ ให้ลอยอยู่เหนือ element อื่น
                  top: 60,                 // ✅ ดันลงมาจากช่องพิมพ์
                  width: '100%',           // ✅ ความกว้างเต็มจอ
                  backgroundColor: 'white',// ✅ ใส่สีพื้นหลัง (ไม่งั้นจะใส มองไม่เห็น)
                  borderRadius: 5,
                  zIndex: 1000,            // ✅ ให้ layer อยู่บนสุด
                  elevation: 5,            // ✅ เงาสำหรับ Android
                  borderWidth: 1,
                  borderColor: '#eee',
                },
                container: {
                  flex: 0, // ป้องกันมันกินพื้นที่เต็มจอถ้าไม่จำเป็น
                } // ดัน List ขึ้นมา
              }}
              enablePoweredByContainer={false}
              onFail={(error) => console.error("Google Places Error:", error)}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Loading Modal */}
      <Modal transparent={true} animationType="fade" visible={saving} onRequestClose={()=>{}}>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFA500" />
            <Text style={styles.loadingText}>กำลังบันทึก...</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerContainer: {
    paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  dayList: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  dayChip: {
    width: 60, height: 60, backgroundColor: '#F5F5F5', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
  },
  selectedDayChip: { backgroundColor: '#FFF5E0', borderColor: '#FFA500' },
  dayText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  selectedDayText: { color: '#FFA500' },
  dateText: { fontSize: 10, color: '#999' },
  selectedDateText: { color: '#FFA500' },
  
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 16,
  },
  dayTitle: { fontSize: 20, fontWeight: "bold", color: '#333' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: { color: '#28a745', fontWeight: 'bold', marginLeft: 4, fontSize: 14 },

  // ✅ Style สำหรับแถว Card + ปุ่มลบ
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  card: {
    flex: 1, // ให้ Card ขยายเต็มพื้นที่ที่เหลือ
    padding: 16, 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#EEEEEE',
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  deleteButton: {
    padding: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bodyContainer: { flex: 1, paddingHorizontal: 16  },
  bodytop: { paddingTop: 16},
  inputGroup: { marginBottom: 10 },
  label: { fontSize: 14, color: '#444', marginBottom: 6, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#FAFAFA', color: '#333' },
  
  footerContainer: {
    padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: 20, 
  },
  confirmButton: {
    backgroundColor: '#28a745', paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4,
  },
  confirmButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  searchModalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  autocompleteContainer: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  timeInputBox: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    color: '#333',
  },

  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: { backgroundColor: 'white', padding: 24, borderRadius: 16, alignItems: 'center' },
  loadingText: { marginTop: 16, fontWeight: '600', color: '#333', fontSize: 16 }
});