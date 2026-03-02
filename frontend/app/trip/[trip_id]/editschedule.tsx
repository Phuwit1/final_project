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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import dayjs from 'dayjs';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ApproveAnimation from '@/components/ui/Alert/ApproveAnimation'; // แก้ Path ให้ตรงกับที่คุณเซฟ
import WrongAnimation from '@/components/ui/Alert/WrongAnimation';
//import '@/dotenv/config';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA73tpAfskui7aqX9GXabfGLU0OZ5HLC-U';

export default function EditSchedule() {
  // ✅ Get trip_id from URL and dayIndex from query param
  const { trip_id, dayIndex } = useLocalSearchParams();
  const router = useRouter();
  const planId = trip_id; 
  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(dayIndex ? parseInt(dayIndex as string) : 0);
  const [schedule, setSchedule] = useState<any>(null);
  const [editedSchedule, setEditedSchedule] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [isSearchVisible, setIsSearchVisible] = useState(false);
  // เลือกวัน 
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTimeIndex, setTempTimeIndex] = useState<number | null>(null); // Store index of item being edited
  const [tempDate, setTempDate] = useState(new Date());

  // --- State สำหรับ Custom Alert ---
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
    if (alertConfig.onConfirm) alertConfig.onConfirm();
  };

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          setLoading(true); // Set loading to true on each focus
          const token = await AsyncStorage.getItem('access_token');
          const headers: any = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;

          // Fetch data from API
          const res = await axios.get(`${API_URL}/trip_schedule/${planId}`, { headers });
          const payload = res.data?.payload;
          
          setSchedule(payload);
          // Use JSON.parse(JSON.stringify(...)) for deep copy
          setEditedSchedule(JSON.parse(JSON.stringify(payload)));
        } catch (e) {
          console.error("Failed to load data:", e);
          showCustomAlert("Error", "Failed to load data", false);
        } finally {
          setLoading(false);
        }
      };

      if (planId) {
        fetchData();
      }

      // Cleanup function (optional - e.g. cancel request)
      return () => {
        // This runs when the screen loses focus (blur)
      };
    }, [planId]) // dependencies array
  );

  // const updateActivity = (dayIdx: number, actIdx: number, field: string, value: string) => {
  //   setEditedSchedule((prev: any) => {
  //     const copy = { ...prev };
  //     copy.itinerary[dayIdx].schedule[actIdx][field] = value;
  //     return copy;
  //   });
  
  // };
  // make sure to sort by time after updating time field
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

      showCustomAlert("Success!", "Changes saved successfully", true, () => {
        router.back();
      });
      router.back(); 
    } catch (e) {
      console.error("Save failed:", e);
      showCustomAlert("Error", "Failed to save", false);
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
            let newH = hh + 1; // Add 1 hour
            if (newH >= 24) newH -= 24;
            nextTime = `${newH.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
        }
    }

    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      // Add activity with location data
      copy.itinerary[selectedDayIndex].schedule.push({
        time: nextTime, // Default start time (can be made smarter)
        activity: name, // Use the selected place name
        need_location: true,
        specific_location_name: name,
        lat: location?.lat || null,
        lng: location?.lng || null
      });

      
      return copy;
    });

    setIsSearchVisible(false); // Close modal
  };

  const openTimePicker = (timeStr: string, index: number) => {
    setTempTimeIndex(index);
    
    // Convert "HH:mm" string to Date Object for picker display
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
    setShowTimePicker(Platform.OS === 'ios'); // iOS requires Done button, Android closes automatically
    
    if (selectedDate && tempTimeIndex !== null) {
      // Convert back to "HH:mm" string
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      const newTimeStr = `${hh}:${mm}`;

      // Update main state
      updateActivity(selectedDayIndex, tempTimeIndex, "time", newTimeStr);
      
      if (Platform.OS === 'android') {
          setTempTimeIndex(null); // Reset index
      }
    } else {
        // Cancel case
        setTempTimeIndex(null);
    }
  };


  const handleDeleteActivity = (actIdx: number) => {
    Alert.alert("Confirm", "Are you sure you want to delete this activity?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive",
        onPress: () => {
          setEditedSchedule((prev: any) => {
            const copy = { ...prev };
      // Delete activity by index from array
            copy.itinerary[selectedDayIndex].schedule.splice(actIdx, 1);
            return copy;
          });
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <LottieView
          source={require('@/assets/images/Loading.json')} // เปลี่ยน Path ให้ตรงกับที่คุณเซฟ
          autoPlay
          loop
          style={{ width: 200, height: 200 }}
        />
        <Text style={{ marginTop: -20, fontSize: 18, fontWeight: 'bold', color: '#4A3B3D' }}>
          Preparing your schedule...
        </Text>
      </View>
    );
  }
  if (!editedSchedule) return <View style={styles.container}><Text>Data not found</Text></View>;

  const currentDay = editedSchedule.itinerary[selectedDayIndex];

  // ✅ UI ของการ์ดแต่ละใบที่จะให้ลากได้
  const renderDraggableItem = ({ item, getIndex, drag, isActive }: RenderItemParams<any>) => {
    const i = getIndex() ?? 0;
    return (
      <ScaleDecorator>
        {/* Wrapped with TouchableOpacity that captures onLongPress event to start dragging */}
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={drag}
          delayLongPress={200} // Long press for 0.2 seconds to start dragging (prevents accidental drags during typing)
          disabled={isActive}
          style={[styles.cardContainer, { opacity: isActive ? 0.8 : 1 }]}
        >
          <View style={[styles.card, isActive && { borderColor: '#FFA500', borderWidth: 2, transform: [{ scale: 1.02 }] }]}>
            
            {/* Icon to indicate dragging is possible */}
            <View style={styles.dragHandleIcon}>
              <Ionicons name="reorder-two" size={24} color="#CCC" />
            </View>

            <View style={{ flex: 1, marginLeft: 25 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity onPress={() => openTimePicker(item.time, i)}>
                  <View style={styles.timeInputBox}>
                    <Text style={styles.timeText}>{item.time}</Text>
                    <Ionicons name="time-outline" size={16} color="#666" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Activity</Text>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  multiline
                  value={item.activity}
                  onChangeText={(val) => updateActivity(selectedDayIndex, i, "activity", val)}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => handleDeleteActivity(i)}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        
        {/* Header: Select day */}
        <View style={styles.headerContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayList}>
            {editedSchedule.itinerary.map((item: any, index: number) => {
              const isSelected = selectedDayIndex === index;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayChip, isSelected && styles.selectedDayChip]}
                  onPress={() => setSelectedDayIndex(index)}
                >
                  <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{item.day}</Text>
                  <Text style={[styles.dateText, isSelected && styles.selectedDateText]}>{dayjs(item.date).format('D MMM')}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Body: List of activities  {dayjs(dayKeys[selectedDay - 1]).format('D MMMM YYYY')} */}
        
          <View style={styles.bodytop}>
              <View style={styles.dayHeaderRow}>
              <Text style={styles.dayTitle}> {currentDay.day} - {dayjs(currentDay.date).format('D MMM YY')}</Text>
              
              <TouchableOpacity onPress={handleAddActivity} style={styles.addButton}>
                  <Ionicons name="add-circle" size={24} color="#28a745" />
                  <Text style={styles.addButtonText}>Add Activity</Text>
              </TouchableOpacity>
              </View>
          </View>


         <View style={styles.bodyContainer}>
            <DraggableFlatList
              data={currentDay.schedule}
              onDragEnd={handleDragEnd} // Callback for drag end
              keyExtractor={(item, index) => `draggable-item-${index}`}
              renderItem={renderDraggableItem} // Use created component
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 80 }}
            />

            {showTimePicker && (
              <DateTimePicker
                value={tempDate}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={onTimeChange}
              />
            )}
        </View>

        {/* Footer: Save button */}
        <View style={styles.footerContainer}>
          <TouchableOpacity onPress={confirmPlan} style={styles.confirmButton}>
            <Text style={styles.confirmButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>

       {isSearchVisible && (
        <View style={styles.searchOverlayAbsolute}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Find a place</Text>
              <TouchableOpacity onPress={() => setIsSearchVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.autocompleteContainer}>
              <GooglePlacesAutocomplete
                placeholder='Type place name...'
                onPress={onPlaceSelected}
                query={{
                  key: GOOGLE_API_KEY,
                  language: 'en',
                  components: 'country:jp', 
                }}
                fetchDetails={true}
                debounce={400} 
                minLength={2} 
                nearbyPlacesAPI="GooglePlacesSearch" 
                GooglePlacesSearchQuery={{
                  rankby: 'prominence'
                }}
                styles={{
                  textInput: styles.searchInput,
                  listView: {
                    // ✅ ลบ position: 'absolute' ออก เพื่อไม่ให้บั๊กหาย
                    backgroundColor: 'white',
                    borderRadius: 5,
                    elevation: 5,
                    borderWidth: 1,
                    borderColor: '#eee',
                    flex: 1, // ดันให้เต็มจอ
                  },
                  container: { flex: 1 },
                  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
                  description: { color: '#666', fontSize: 14 }
                }}
                enablePoweredByContainer={false}
                onFail={(error) => {
                  console.error("Google Places Error:", error);
                  showCustomAlert("Error", "No results found. Please try again", false);
                }}
              />
            </View>
          </SafeAreaView>
        </View>
      )}
      </SafeAreaView>

        {/* ----------------------------------------------------------- */}
        {/* 2. Loading Modal (ตอนกดบันทึก) */}
        {/* ----------------------------------------------------------- */}
        <Modal transparent={true} animationType="fade" visible={saving} onRequestClose={()=>{}}>
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <LottieView
                source={require('@/assets/images/Loading.json')}
                autoPlay
                loop
                style={{ width: 150, height: 150 }}
              />
              <Text style={[styles.loadingText, { marginTop: -20 }]}>Saving...</Text>
            </View>
          </View>
        </Modal>

        {/* ----------------------------------------------------------- */}
        {/* 3. Custom Alert Modal (แสดงตอนโหลดเสร็จ หรือ เกิด Error) */}
        {/* ----------------------------------------------------------- */}
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={styles.alertOverlay}>
            <View style={styles.alertCard}>
              
              {alertConfig.isSuccess ? (
                <ApproveAnimation size={120} loop={false} />
              ) : (
                <WrongAnimation size={120} loop={false} />
              )}

              <Text style={styles.alertTitle}>{alertConfig.title}</Text>
              <Text style={styles.alertMessage}>{alertConfig.message}</Text>

              <TouchableOpacity style={styles.alertBtn} onPress={closeAlert} activeOpacity={0.8}>
                <LinearGradient 
                  colors={alertConfig.isSuccess ? ['#66BB6A', '#43A047'] : ['#FFA0B4', '#FF526C']} 
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
                  style={styles.alertBtnGradient}
                >
                  <Text style={styles.alertBtnText}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>

    </GestureHandlerRootView>
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
    marginHorizontal: 16
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

  // ✅ Style for card rows + delete button
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  card: {
    position: 'relative',
    flex: 1,
    padding: 16, 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#EEEEEE',
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 15,
    zIndex: 10,
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
    zIndex: 1000,
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
  loadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200, // กำหนดขนาดขั้นต่ำให้กล่องดูสวย
  },
  loadingText: { 
    marginTop: 16, 
    fontWeight: '600', 
    color: '#333', 
    fontSize: 16 
  },
  dragHandleIcon: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -10, // Center vertically
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  // --- Custom Alert Styles ---
 alertOverlay: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
},
  alertCard: {
    width: '100%',
    maxWidth: 350, // จำกัดไม่ให้กล่องกว้างเกินไปในหน้าจอใหญ่ๆ
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  searchOverlayAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 9999, // ให้ทับทุกอย่างบนหน้าจอ
    elevation: 9999, // สำหรับ Android
  },
});
