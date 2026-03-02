
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import SakuraBackground from '@/components/ui/sakurabackground';
import TripCard from '@/components/ui/trip/cardtrip';
import TopBar from '@/components/TopBar';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { API_URL } from '@/api.js'
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import TripListSkeleton from '@/components/ui/trip/TripListSkeleton';

type Trip = {
  plan_id: number;
  name_group: string;
  start_plan_date: string;
  end_plan_date: string;
  tripGroup?: {
    members: any[]; // หรือกำหนด Type Member ให้ชัดเจน
  } | null;
  image?: string;

};

const getStatus = (start: string, end: string): 'Upcoming' | 'On Trip' | 'Trip Ended' => {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (now < startDate) return 'Upcoming';
  if (now >= startDate && now <= endDate) return 'On Trip';
  return 'Trip Ended';
};


const toThaiYear = (date: dayjs.Dayjs) => date.year() + 543;

const formatTripDateRange = (startStr: string, endStr: string): string => {
  dayjs.locale('en');

  const start = dayjs(startStr);
  const end = dayjs(endStr);

  const startDate = start.date(); // วันที่ เช่น 6
  const endDate = end.date();     // วันที่ เช่น 10
  const monthName = start.format('MMM'); // เดือน ย่อ เช่น ก.ค.
  const year = toThaiYear(start) % 100;  // ปี 65 (เอา 2 หลักหลัง)

  return `${startDate}-${endDate} ${monthName} ${year}`;
};

// 🌸 Component สำหรับแสดงผลตอนไม่มีทริป
const EmptyTripState = ({ router }: { router: any }) => (
  <View style={styles.emptyContainer}>
    {/* ไอคอนกระเป๋าเดินทาง / เครื่องบิน */}
    <View style={styles.emptyIconBg}>
      <Ionicons name="airplane" size={55} color="#FF6B81" />
    </View>

    {/* ข้อความเชิญชวน */}
    <Text style={styles.emptyTitle}>No Trips Yet</Text>
    <Text style={styles.emptySubtitle}>
      You haven't planned any trips. Let's start building your next amazing adventure!
    </Text>

    {/* ปุ่มสำหรับไปสร้างทริป (เปลี่ยน Path ได้ตามต้องการ) */}
    <View style={styles.emptyButtonGroup}>
      {/* ปุ่มที่ 1: Create Trip (ปุ่มหลัก) */}
      <TouchableOpacity 
        onPress={() => router.push('/home')} // เปลี่ยนเป็น Path สร้างทริป
        activeOpacity={0.8}
        style={styles.emptyButtonWrapper}
      >
        <LinearGradient
          colors={['#FFA0B4', '#FF526C']} 
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyButtonGradient}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFF" />
          <Text style={styles.emptyButtonText}>Create Trip</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ปุ่มที่ 2: Join Trip (ปุ่มรอง) */}
      <TouchableOpacity 
        onPress={() => router.push('/join')} // เปลี่ยนเป็น Path หน้า Join
        activeOpacity={0.8}
        style={styles.emptyJoinWrapper}
      >
        <Ionicons name="enter-outline" size={20} color="#FF526C" />
        <Text style={styles.emptyJoinText}>Join Trip</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default function TripListScreen() {
  const db = useSQLiteContext();
  const [search, setSearch] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useFocusEffect(
  useCallback(() => {
    const fetchTrips = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        console.log('Token from AsyncStorage:', token);
        if (!token) {
            setIsGuest(true);
            setLoading(false);
            return;
          }

        setIsGuest(false);
        const res = await axios.get(`${API_URL}/trip_plan`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000, // 10 seconds timeout
        });
      if (Array.isArray(res.data)) {
        setTrips(res.data);
      } else {
        console.warn('Expected array, but got:', res.data);
        setError('Unexpected response format');
        setTrips([]); // fallback
      }

    setLoading(false);

      } catch (err: any) {
        console.log('Online fetch failed, trying SQLite...', err.message);
        try{
          const offlineTrips = await db.getAllAsync('SELECT * FROM TripPlan');
          if (offlineTrips.length > 0 && Array.isArray(offlineTrips)) {
            setTrips(offlineTrips as Trip[]);
            setError(''); // ล้าง error เพราะเรามีข้อมูลออฟไลน์มาโชว์แล้ว
          } else {
            setError('ไม่สามารถโหลดข้อมูลได้ และไม่มีข้อมูลสำรองในเครื่อง');
          }
        }
        catch(sqliteErr) {
          setError('เกิดข้อผิดพลาดในการเข้าถึงฐานข้อมูลในเครื่อง');
        }
        finally {
          setLoading(false);   
        }
      }
    };

    fetchTrips();

    // Optional: clean up if needed
    return () => {setIsDeleteMode(false);};
  }, []) // dependency array
);
  const handleDelete = async (planId: number) => {
    Alert.alert(
      "ยืนยันการลบ",
      "คุณต้องการลบทริปนี้ใช่หรือไม่?",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบ",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              await axios.delete(`${API_URL}/trip_plan/${planId}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000,
              });
            } catch (error: any) {
              if (error.response) {
                console.log("Server rejected delete:", error.response.status);
                Alert.alert("ลบไม่ได้", `Server ปฏิเสธการลบ (Code: ${error.response.status})`);

                return; 
              }
              try {
                await db.runAsync('DELETE FROM TripPlan WHERE plan_id = ?', [planId]);
              }
              catch (error) {
                Alert.alert("Error", "ไม่สามารถลบทริปได้");
              }
            }
            finally {
              // ลบออกจาก State ทันทีเพื่อให้ UI อัปเดต
              setTrips(prev => prev.filter(t => t.plan_id !== planId));
            }
          }
        }
      ]
    );
  };

  if (isGuest) {
    return (
      <>
        <View style={styles.guestContainer}>
          {/* วงกลมตกแต่งสไตล์มินิมอลญี่ปุ่น */}
          <View style={styles.sakuraCircle1} />
          <View style={styles.sakuraCircle2} />

          {/* ไอคอนสำหรับหน้าทริป */}
          <View style={styles.guestIconBg}>
            <Ionicons name="map" size={60} color="#FF6B81" />
          </View>

          {/* ข้อความเชิญชวน */}
          <Text style={styles.guestTitle}>Unlock Your Trips</Text>
          <Text style={styles.guestSubtitle}>
            Log in or sign up to create, save, and manage your amazing travel plans.
          </Text>

          {/* ปุ่ม Login Gradient */}
          <TouchableOpacity 
            onPress={() => router.push('/Login')}
            activeOpacity={0.8}
            style={styles.guestButtonWrapper}
          >
            <LinearGradient
              colors={['#FFA0B4', '#FF526C']} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.guestLoginGradient}
            >
              <Ionicons name="log-in-outline" size={24} color="#FFF" />
              <Text style={styles.guestLoginText}>Log In / Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </>
    );
  }
  


  const filteredTrips = Array.isArray(trips)
  ? trips.filter((trip: any) =>
      trip.name_group?.toLowerCase().includes(search.toLowerCase())
    )
  : [];

  const renderItem = ({ item }: { item: Trip }) => {
    const durationDays = Math.ceil(
      (new Date(item.end_plan_date).getTime() - new Date(item.start_plan_date).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1; // รวมวันเริ่มต้นด้วย

    const formattedDate = formatTripDateRange(item.start_plan_date, item.end_plan_date);
    
    const memberCount = item.tripGroup?.members?.length || 1;
    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity 
          onPress={() => router.push(`/trip/${item.plan_id}`)}
          disabled={isDeleteMode} // ปิดการกดเข้าทริปถ้าอยู่ในโหมดลบ
          activeOpacity={isDeleteMode ? 1 : 0.7}
        >
          <TripCard
            name={item.name_group}
            date={formattedDate}
            duration={`${durationDays}`}
            status={getStatus(item.start_plan_date, item.end_plan_date)}
            people={memberCount}
            image={item.image || 'https://via.placeholder.com/300x200.png?text=No+Image'}
          />
        </TouchableOpacity>

        {/* ✅ 4. แสดงปุ่มกากบาทเมื่ออยู่ในโหมดลบ */}
        {isDeleteMode && (
          <TouchableOpacity 
            style={styles.deleteBadge} 
            onPress={() => handleDelete(item.plan_id)}
          >
            <Ionicons name="close-circle" size={28} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <TopBar/>
      <View style={styles.container}>
        <SakuraBackground />
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchBar}
            placeholder="ค้นหาทริป..."
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.actionButtons}>
            {/* ✅ 5. ปุ่ม Toggle โหมดลบ (ถังขยะ) */}
            <TouchableOpacity 
              style={[styles.deleteToggleButton, isDeleteMode && styles.deleteActive]}
              onPress={() => setIsDeleteMode(!isDeleteMode)}
            >
              <Ionicons 
                name={isDeleteMode ? "close" : "trash-outline"} 
                size={20} 
                color={isDeleteMode ? "white" : "#FF3B30"} 
              />
            </TouchableOpacity>
          </View>
        </View>
        {loading ? (
          <TripListSkeleton />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <FlatList
            data={filteredTrips}
            keyExtractor={(item) => item.plan_id.toString()}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyTripState router={router} />}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center', 
    marginBottom: 16,
    gap: 10, 
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  searchButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteToggleButton: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD6D6',
  },
  deleteActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  cardContainer: {
    position: 'relative',
    marginBottom: 8,
    marginTop: 5, 
    marginRight: 10, 
    marginLeft: 4,
    overflow: 'visible',
  },
  
  deleteBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 15,
    zIndex: 10,
    elevation: 5,
  },
  searchBar: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    height: 40,
  },
  tripCard: {
    backgroundColor: '#f4f4f4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  tripName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tripDate: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
  errorText: {
    textAlign: 'center',
    color: 'red',
    marginTop: 20,
  },
  // --- Guest State Styles (Sakura Theme) ---
  guestContainer: {
    flex: 1,
    backgroundColor: '#FFF5F7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    position: 'relative', 
    overflow: 'hidden',
  },
  sakuraCircle1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FFE3E8',
    opacity: 0.6,
  },
  sakuraCircle2: {
    position: 'absolute',
    bottom: 40,
    left: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD1DC',
    opacity: 0.5,
  },
  guestIconBg: {
    width: 130,
    height: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#FF6B81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  guestTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4A3B3D',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  guestSubtitle: {
    fontSize: 15,
    color: '#7A6B6D',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 15,
  },
  guestButtonWrapper: {
    borderRadius: 30,
    shadowColor: '#FF526C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  guestLoginGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  guestLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // --- Empty State Styles (Sakura Theme) ---
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconBg: {
    width: 110,
    height: 110,
    backgroundColor: '#FFF5F7',
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FF6B81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4A3B3D',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#7A6B6D',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  emptyButtonWrapper: {
    borderRadius: 25,
    shadowColor: '#FF526C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  emptyButtonGroup: {
    flexDirection: 'row',
    gap: 12, // ระยะห่างระหว่างปุ่ม
    marginTop: 10,
  },
  emptyJoinWrapper: {
    flexDirection: 'row',
    paddingVertical: 12, // ขอบต้องบางกว่า Gradient นิดนึงเพราะมี Border
    paddingHorizontal: 18,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FF526C',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyJoinText: {
    color: '#FF526C',
    fontSize: 15,
    fontWeight: 'bold',
  },
  
});
