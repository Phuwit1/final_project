import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, Dimensions, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Setup dayjs
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

interface FloatingChatProps {
  planId: number;
  apiBaseUrl: string; // http://192.168.1.45:8000
}

type ScheduleItem = {
  time: string;
  activity: string;
  need_location: boolean;
  specific_location_name: string | null;
  lat: number | null;
  lng: number | null;
};

type ItineraryDay = {
  day: string;
  date: string;
  schedule: ScheduleItem[];
};

export default function FloatingChat({ planId, apiBaseUrl }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [nextActivity, setNextActivity] = useState<ScheduleItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ฟังก์ชันหลักเมื่อกดปุ่ม
  const handlePress = async () => {
    if (isOpen) {
      // ถ้าเปิดอยู่ ให้ปิด
      setIsOpen(false);
      setRouteInfo(null);
      setErrorMsg(null);
      return;
    }

    // ถ้าปิดอยู่ ให้เปิดและเริ่มคำนวณ
    setIsOpen(true);
    await calculateRoute();
  };

  const calculateRoute = async () => {
    setLoading(true);
    setErrorMsg(null);
    setRouteInfo(null);

    try {
      // 1. ขอ Permission และหาตำแหน่งปัจจุบัน
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission to access location was denied');
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const origin = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;

      // 2. ดึงข้อมูล Itinerary (Plan)
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${apiBaseUrl}/trip_schedule/${planId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const itineraryData = res.data?.payload?.itinerary;
      if (!itineraryData || !Array.isArray(itineraryData)) {
        throw new Error('ไม่พบข้อมูลตารางการเดินทาง');
      }

      // 3. หา Destination (กิจกรรมถัดไปที่มี Location)
      const target = findNextLocation(itineraryData);
      
      if (!target) {
        throw new Error('ไม่พบกิจกรรมถัดไปที่มีสถานที่ระบุไว้');
      }

      setNextActivity(target);

      // 4. เรียก API Route Summarize
      const destination = `${target.lat},${target.lng}`;
      console.log(`Routing: ${origin} -> ${destination} (${target.activity})`);

      const route = {
        start : origin,
        goal : destination,
        start_time : dayjs().format('YYYY-MM-DDTHH:mm:ss') 
      }

     const routeRawRes = await axios.get(`${apiBaseUrl}/route`,
      {
        params:  route ,
        headers: { Authorization: `Bearer ${token}` }
      }
    );
      
      // เช็คว่าได้เส้นทางมาไหม
      if (!routeRawRes.data || routeRawRes.data.error) {
          throw new Error('ไม่พบเส้นทาง หรือ API มีปัญหา');
      }

      
      // 3. ✅ ส่งผลลัพธ์ที่ได้ไปให้ AI สรุป (POST /route/summarize)
      // ต้องส่งให้ตรงกับ Schema: { route: Dict }
      const summarizeRes = await axios.post(`${apiBaseUrl}/route/summarize`, 
        { route: routeRawRes.data }, // ส่ง JSON ก้อนใหญ่ไปใส่ใน key 'route'
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRouteInfo(summarizeRes.data);

    } catch (err: any) {
      console.error("Route Error:", err);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการคำนวณเส้นทาง");
    } finally {
      setLoading(false);
    }
  };

  // Logic การหากิจกรรมถัดไปตามโจทย์
  const findNextLocation = (itinerary: ItineraryDay[]): ScheduleItem | null => {
    const now = dayjs(); // เวลาปัจจุบัน
    // const now = dayjs("2025-12-11 09:00"); // ปลดล็อกเพื่อ Test เวลา

    // แปลง Itinerary ให้เป็น List เดียวที่เรียงตามเวลา เพื่อหาง่ายๆ
    let allActivities: (ScheduleItem & { fullDateTime: dayjs.Dayjs })[] = [];

    itinerary.forEach(day => {
      day.schedule.forEach(item => {
        // รวม Date + Time เป็น Object เดียว
        const itemDateTime = dayjs(`${day.date} ${item.time}`, "YYYY-MM-DD HH:mm");
        if (itemDateTime.isValid()) {
          allActivities.push({ ...item, fullDateTime: itemDateTime });
        }
      });
    });

    // เรียงตามเวลา
    allActivities.sort((a, b) => a.fullDateTime.diff(b.fullDateTime));

    // วนลูปหาตัวแรกที่ เวลา >= ปัจจุบัน และ need_location = true
    for (const item of allActivities) {
      // เงื่อนไข 1: เวลาต้องเป็นอนาคต หรือ ปัจจุบัน (เผื่อเลทนิดหน่อยได้ เช่น -10 นาที)
      // เงื่อนไข 2: ต้องมีพิกัด (lat, lng)
      // เงื่อนไข 3: need_location ต้องเป็น true
      if (item.fullDateTime.isAfter(now.subtract(10, 'minute')) && item.need_location && item.lat && item.lng) {
        return item;
      }
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* หน้าต่างแสดงผล (Bubble) */}
      {isOpen && (
        <View style={styles.bubbleCard}>
          <View style={styles.bubbleHeader}>
            <Text style={styles.bubbleTitle}>เส้นทางถัดไป 📍</Text>
            <TouchableOpacity onPress={() => setIsOpen(false)}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF6B6B" />
              <Text style={styles.loadingText}>กำลังคำนวณเส้นทาง...</Text>
            </View>
          ) : errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : routeInfo && nextActivity ? (
            <View style={styles.infoContainer}>
              <Text style={styles.targetLabel}>มุ่งหน้าสู่:</Text>
              <Text style={styles.targetName} numberOfLines={1}>
                {nextActivity.specific_location_name || nextActivity.activity}
              </Text>
              <Text style={styles.targetTime}>เวลา: {nextActivity.time}</Text>
              
              <View style={styles.divider} />
              
              {/* ✅ แก้ไขส่วนแสดงผล Route ให้รองรับ Array แบบใหม่ */}
              {Array.isArray(routeInfo) && routeInfo.length > 0 ? (
                <View>
                  {/* แสดงหัวข้อ Option แรก (เช่น Fastest) */}
                  <Text style={[styles.routeDetail, { fontWeight: 'bold', color: '#2563eb', marginBottom: 4 }]}>
                     {routeInfo[0].title}
                  </Text>

                  {/* แสดงระยะทางและค่าโดยสาร */}
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                      <Text style={[styles.routeDetail, {fontSize: 12}]}>{routeInfo[0].distance}</Text>
                      <Text style={[styles.routeDetail, {fontSize: 12}]}>{routeInfo[0].fare}</Text>
                  </View>

                  <View style={{ height: 6 }} />

                  {/* แสดงขั้นตอนการเดินทาง 3 บรรทัดแรก */}
                  {routeInfo[0].detail.slice(0, 3).map((step: string, idx: number) => (
                    <Text key={idx} style={[styles.routeDetail, { fontSize: 12, color: '#555' }]} numberOfLines={1}>
                      {step}
                    </Text>
                  ))}
                  
                  {/* ถ้ามีมากกว่า 3 ขั้นตอน ให้มี ... */}
                  {routeInfo[0].detail.length > 3 && (
                    <Text style={{ fontSize: 10, color: '#999', textAlign: 'center' }}>...</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.infoText}>ไม่พบข้อมูลเส้นทาง</Text>
              )}
            </View>
          ) : (
            <Text style={styles.infoText}>ไม่พบกิจกรรมถัดไปที่ต้องเดินทาง</Text>
          )}
        </View>
      )}

      {/* ปุ่ม Floating Button */}
      <TouchableOpacity 
        style={[styles.fab, isOpen ? styles.fabActive : null]} 
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={isOpen ? "map" : "navigate"} 
          size={28} 
          color="white" 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end', // จัดให้ Bubble อยู่ชิดขวาตรงกับปุ่ม
    zIndex: 9999, // ให้ลอยอยู่บนสุด
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B', // สีปุ่มหลัก
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabActive: {
    backgroundColor: '#FF4757',
  },
  bubbleCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16, // ระยะห่างจากปุ่ม FAB
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bubbleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  infoContainer: {
    gap: 4,
  },
  targetLabel: {
    fontSize: 12,
    color: '#888',
  },
  targetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  targetTime: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  routeDetail: {
    fontSize: 14,
    color: '#444',
    marginBottom: 2,
  },
  bold: {
    fontWeight: 'bold',
    color: '#000',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    textAlign: 'center',
  },
  infoText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  }
});