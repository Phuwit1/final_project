import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, Dimensions, Platform,
  UIManager, LayoutAnimation, ScrollView
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

// เปิดใช้งาน LayoutAnimation สำหรับ Android ให้การขยายการ์ดดูสมูท
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

export interface RouteOption {
  title: string;
  detail: string[];
  fare: string;
  distance: string;
}

// ==========================================
// Component ย่อย: สำหรับแสดงการ์ดเส้นทางแบบกดขยายได้
// ==========================================
function RouteSuggestion({ options }: { options: RouteOption[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  if (!options || options.length === 0) return null;

  return (
    <View style={routeStyles.container}>
      <Text style={routeStyles.headerTitle}>✨ Best Routes Found</Text>
      
      {options.map((option, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <View key={index} style={[routeStyles.card, isExpanded && routeStyles.cardExpanded]}>
            {/* ส่วนหัวของการ์ด */}
            <TouchableOpacity 
              style={routeStyles.cardHeader} 
              onPress={() => toggleExpand(index)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={routeStyles.optionTitle}>{option.title}</Text>
                <View style={routeStyles.infoRow}>
                  <Text style={routeStyles.infoText}>{option.fare}</Text>
                  <Text style={routeStyles.infoDot}> • </Text>
                  <Text style={routeStyles.infoText}>{option.distance}</Text>
                </View>
              </View>
              <Ionicons 
                name={isExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>

            {/* ส่วนรายละเอียด (แสดงเมื่อถูกกดขยาย) */}
            {isExpanded && (
              <View style={routeStyles.cardBody}>
                <View style={routeStyles.timelineLine} />
                {option.detail.map((step, stepIdx) => (
                  <View key={stepIdx} style={routeStyles.stepContainer}>
                    <View style={routeStyles.stepDot} />
                    <Text style={routeStyles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const testLocation = async () => {
  try {
    console.log("--- 📍 เริ่มทดสอบระบบ Location ---");
    
    // ขั้นตอนที่ 1: เช็ค Permission
    console.log("1. กำลังขอ Permission...");
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log("-> สถานะ Permission:", status);

    if (status !== 'granted') {
      console.log("❌ จบการทำงาน: ผู้ใช้ไม่อนุญาต (Permission Denied)");
      return;
    }

    // ขั้นตอนที่ 2: ดึงพิกัด
    console.log("2. กำลังดึงพิกัด (อาจจะใช้เวลา 2-5 วินาที)...");
    
    // ทริคสำหรับ Emulator: ต้องใช้ Accuracy.Balanced หรือ Low 
    // ถ้าใช้ High มันจะหาเสาสัญญาณจริงซึ่งใน Emulator ไม่มี ทำให้เกิด Timeout/Error
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, 
    });

    // ขั้นตอนที่ 3: แสดงผล
    console.log("✅ ดึงพิกัดสำเร็จ!");
    console.log("-> Latitude (ละติจูด):", location.coords.latitude);
    console.log("-> Longitude (ลองจิจูด):", location.coords.longitude);
    console.log("-----------------------------------");

  } catch (error) {
    // ถ้ามันพัง มันจะเด้งมาเข้าบล็อกนี้ครับ
    console.log("❌ เกิด Error ระหว่างดึงพิกัด:");
    console.error(error);
  }
};

// ==========================================
// Main Component: FloatingChat
// ==========================================
export default function FloatingChat({ planId, apiBaseUrl }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [nextActivity, setNextActivity] = useState<ScheduleItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // testLocation(); // เรียกฟังก์ชันทดสอบพิกัดเมื่อคอมโพเนนต์โหลด (สามารถเอาออกได้หลังจากทดสอบเสร็จ)

  // ฟังก์ชันหลักเมื่อกดปุ่ม
  const handlePress = async () => {
    if (isOpen) {
      setIsOpen(false);
      setRouteInfo(null);
      setErrorMsg(null);
      return;
    }
    setIsOpen(true);
    await calculateRoute();
  };

  const calculateRoute = async () => {
    setLoading(true);
    setErrorMsg(null);
    setRouteInfo(null);

    try {
      // ==========================================
      // 🚧 MOCK DATA MODE (จำลองข้อมูลเพื่อทำ UI) 🚧
      // ==========================================
      
      // 1. จำลองเวลาโหลด 1.5 วินาทีให้ดูสมจริง
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 2. Mock ข้อมูลสถานที่เป้าหมาย (ให้ UI ส่วนบนแสดงผลได้)
      setNextActivity({
        time: '10:00',
        activity: 'Osaka Castle',
        need_location: true,
        specific_location_name: 'Osaka Castle (ปราสาทโอซาก้า)',
        lat: 34.6872571,
        lng: 135.5258546,
      });

      // 3. Mock ข้อมูลเส้นทางทั้ง 5 แบบจาก Routing.md
      const mockRouteData = [
          {
              "title": "🚇 Option 1: Quickest Route (⏱ 33 min, 🔁 1 transfer)",
              "detail": [
                  "🚶 Walk from Start to Tanimachi 4-chome Station (5 min, 328 m, Exit 9, Line C18)",
                  "🚇 Osaka Metro Chuo Line: Tanimachi 4-chome → Honmachi (3 min, 1.7 km, Get off at station 6, Transfer time 3 min)",
                  "🚇 Osaka Metro Midosuji Line: Honmachi → Umeda (4 min, 2.2 km, Get off at station 2)",
                  "🚶 Walk from Umeda Station (Exit 5) to Goal (13 min, 1.03 km)"
              ],
              "fare": "💴 Total Fare: ~¥240",
              "distance": "📏 Distance: 5.25 km"
          },
          {
              "title": "🚶 Option 2: All Walking & Subway (⏱ 36 min, 🔁 0 transfers)",
              "detail": [
                  "🚶 Walk from Start to Tanimachi 4-chome Station (6 min, 497 m, Exit 2, Line T23)",
                  "🚇 Osaka Metro Tanimachi Line: Tanimachi 4-chome → Higashi Umeda (7 min, 3.9 km, Get off at station 1)",
                  "🚶 Walk from Higashi Umeda Station (Exit 1) to Goal (20 min, 1.35 km)"
              ],
              "fare": "💴 Total Fare: ~¥240",
              "distance": "📏 Distance: 5.75 km"
          },
          {
              "title": "🚇 Option 3: Two Metro Lines (⏱ 37 min, 🔁 1 transfer)",
              "detail": [
                  "🚶 Walk from Start to Tanimachi 4-chome Station (5 min, 328 m, Exit 9, Line C18)",
                  "🚇 Osaka Metro Chuo Line: Tanimachi 4-chome → Honmachi (3 min, 1.7 km, Get off at station 1, Transfer time 4 min)",
                  "🚇 Osaka Metro Yotsubashi Line: Honmachi → Nishi Umeda (4 min, 2.2 km, Get off at station 1)",
                  "🚶 Walk from Nishi Umeda Station (Exit 5) to Goal (17 min, 1.13 km)"
              ],
              "fare": "💴 Total Fare: ~¥240",
              "distance": "📏 Distance: 5.35 km"
          },
          {
              "title": "🚃 Option 4: Metro & JR Line (⏱ 41 min, 🔁 1 transfer)",
              "detail": [
                  "🚶 Walk from Start to Tanimachi 4-chome Station (5 min, 328 m, Exit 9, Line C18)",
                  "🚇 Osaka Metro Chuo Line: Tanimachi 4-chome → Morinomiya (2 min, 1.3 km, Get off at station 1, Transfer time 3 min)",
                  "🚆 JR Osaka Loop Line: Morinomiya → Osaka Station (12 min, 5.9 km, Get off at station front side)",
                  "🚶 Walk from Osaka Station (Umekita Underground Exit) to Goal (14 min, 924 m)"
              ],
              "fare": "💴 Total Fare: ~¥370",
              "distance": "📏 Distance: 8.45 km"
          },
          {
              "title": "🚃 Option 5: Metro & Hankyu Line (⏱ 42 min, 🔁 2 transfers)",
              "detail": [
                  "🚶 Walk from Start to Tanimachi 4-chome Station (5 min, 328 m, Exit 9, Line C18)",
                  "🚇 Osaka Metro Chuo Line: Tanimachi 4-chome → Honmachi (3 min, 1.7 km, Get off at station 6, Transfer time 3 min)",
                  "🚇 Osaka Metro Midosuji Line: Honmachi → Umeda (4 min, 2.2 km, Get off at stations 2 and 4)",
                  "🚶 Walk from Umeda Station to Osaka Umeda Hankyu Line (4 min, 0 m)",
                  "🚆 Hankyu Kobe Main Line: Osaka Umeda → Nakatsu (2 min, 900 m, Get off at station back side)",
                  "🚶 Walk from Nakatsu Station to Goal (11 min, 756 m)"
              ],
              "fare": "💴 Total Fare: ~¥410",
              "distance": "📏 Distance: 5.88 km"
          }
      ];

      setRouteInfo(mockRouteData);


      // 1. ขอ Permission และหาตำแหน่งปัจจุบัน
    //   const { status } = await Location.requestForegroundPermissionsAsync();
    //   if (status !== 'granted') {
    //     throw new Error('Permission to access location was denied');
    //   }

    //   const currentLocation = await Location.getCurrentPositionAsync({
    //     accuracy: Location.Accuracy.Balanced,
    //   });
    //   const origin = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;

    //   // 2. ดึงข้อมูล Itinerary (Plan)
    //   const token = await AsyncStorage.getItem('access_token');
    //   const res = await axios.get(`${apiBaseUrl}/trip_schedule/${planId}`, {
    //     headers: { Authorization: `Bearer ${token}` }
    //   });

    //   const itineraryData = res.data?.payload?.itinerary;
    //   if (!itineraryData || !Array.isArray(itineraryData)) {
    //     throw new Error('ไม่พบข้อมูลตารางการเดินทาง');
    //   }

    //   // 3. หา Destination (กิจกรรมถัดไปที่มี Location)
    //   const target = findNextLocation(itineraryData);
      
    //   if (!target) {
    //     throw new Error('ไม่พบกิจกรรมถัดไปที่มีสถานที่ระบุไว้');
    //   }

    //   setNextActivity(target);

    //   // 4. เรียก API Route Summarize
    //   const destination = `${target.lat},${target.lng}`;
    //   console.log(`Routing: ${origin} -> ${destination} (${target.activity})`);

    //   const route = {
    //     start : origin,
    //     goal : destination,
    //     start_time : dayjs().format('YYYY-MM-DDTHH:mm:ss') 
    //   }

    //  const routeRawRes = await axios.post(`${apiBaseUrl}/route`,
    //   route,
    //   {
    //     headers: { Authorization: `Bearer ${token}` }
    //   }
    // );
      
    //   if (!routeRawRes.data || routeRawRes.data.error) {
    //       throw new Error('ไม่พบเส้นทาง หรือ API มีปัญหา');
    //   }
      
    //   // 3. ✅ ส่งผลลัพธ์ที่ได้ไปให้ AI สรุป (POST /route/summarize)
    //   const summarizeRes = await axios.post(`${apiBaseUrl}/route/summarize`, 
    //     { route: routeRawRes.data },
    //     { headers: { Authorization: `Bearer ${token}` } }
    //   );

    //   setRouteInfo(summarizeRes.data);

    } catch (err: any) {
      console.error("Route Error:", err);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // ลดความแม่นยำลงมาที่ระดับกลาง (สำคัญมากสำหรับ Emulator)
        });

      console.log("พิกัดที่ได้:", location.coords);
      console.log("Location Permission Status:", status);
      if (status !== 'granted') {
        throw new Error('Permission to access location was denied');
      }
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการคำนวณเส้นทาง");
    } finally {
      setLoading(false);
    }
  };

  const findNextLocation = (itinerary: ItineraryDay[]): ScheduleItem | null => {
    const now = dayjs(); 
    let allActivities: (ScheduleItem & { fullDateTime: dayjs.Dayjs })[] = [];

    itinerary.forEach(day => {
      day.schedule.forEach(item => {
        const itemDateTime = dayjs(`${day.date} ${item.time}`, "YYYY-MM-DD HH:mm");
        if (itemDateTime.isValid()) {
          allActivities.push({ ...item, fullDateTime: itemDateTime });
        }
      });
    });

    allActivities.sort((a, b) => a.fullDateTime.diff(b.fullDateTime));

    for (const item of allActivities) {
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
              
              {/* ✅ แทนที่ส่วนแสดงผลเดิมด้วย RouteSuggestion พร้อม ScrollView กันล้น */}
              {Array.isArray(routeInfo) && routeInfo.length > 0 ? (
                <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                  <RouteSuggestion options={routeInfo} />
                </ScrollView>
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

// ==========================================
// Styles
// ==========================================
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
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
    marginBottom: 16,
    width: 300, // ปรับให้กว้างขึ้นนิดนึงเพื่อให้เห็นเส้นทางชัดเจน
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
    marginVertical: 4,
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

const routeStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 4,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4A3B3D',
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: '#FF6B6B', // เปลี่ยนเป็นสีแดง/ชมพูให้เข้ากับธีม
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 11,
    color: '#666',
  },
  infoDot: {
    fontSize: 11,
    color: '#ccc',
  },
  cardBody: {
    padding: 12,
    paddingLeft: 20,
    backgroundColor: '#fff',
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 24, 
    top: 20,
    bottom: 20,
    width: 2,
    backgroundColor: '#eee',
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    position: 'relative',
    alignItems: 'flex-start',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
    marginTop: 4,
    marginRight: 10,
    zIndex: 1,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: '#444',
    lineHeight: 18,
  },
});