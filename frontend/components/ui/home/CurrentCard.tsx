import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js'; // ตรวจสอบ path นี้ให้ถูกต้อง

dayjs.locale('th');

type Trip = {
  plan_id: number;
  name_group: string;
  start_plan_date: string;
  end_plan_date: string;
  tripGroup?: {
    members: any[];
  } | null;
};

export default function CurrentCard() {
  const router = useRouter();
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAnyTrip, setHasAnyTrip] = useState(false); // เช็คว่าเคยมีทริปบ้างไหม

  // โหลดข้อมูลทุกครั้งที่หน้าจอถูก Focus (เช่น กลับมาจากหน้าอื่น)
  useFocusEffect(
    useCallback(() => {
      fetchCurrentTrip();
    }, [])
  );

  const fetchCurrentTrip = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_URL}/trip_plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        setHasAnyTrip(true);
        const trips = res.data;
        const now = dayjs();

        // 1. หา Trip ที่กำลังเดินทาง (On Trip)
        const onTrip = trips.find((t: Trip) => {
          const start = dayjs(t.start_plan_date);
          const end = dayjs(t.end_plan_date);
          return now.isSame(start, 'day') || now.isSame(end, 'day') || (now.isAfter(start) && now.isBefore(end));
        });

        if (onTrip) {
          setCurrentTrip(onTrip);
        } else {
          // 2. ถ้าไม่มี On Trip ให้หา Trip ที่จบไปแล้วล่าสุด (Trip Ended)
          // เรียงจากจบใหม่สุดไปเก่าสุด
          const endedTrips = trips
            .filter((t: Trip) => dayjs(t.end_plan_date).isBefore(now, 'day'))
            .sort((a: Trip, b: Trip) => dayjs(b.end_plan_date).diff(dayjs(a.end_plan_date)));

          if (endedTrips.length > 0) {
            setCurrentTrip(endedTrips[0]);
          } else {
            // กรณีมีแต่ Upcoming หรือไม่มีทริปที่เข้าเงื่อนไขเลย
            setCurrentTrip(null);
          }
        }
      } else {
        setHasAnyTrip(false);
        setCurrentTrip(null);
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrip = () => {
    router.push('/trip/Createtrip'); // เปลี่ยน path ตามหน้าสร้างทริปของคุณ
  };

  const handleJoinTrip = () => {
    router.push('/(modals)/join-trip'); // เปลี่ยน path ตามหน้า Join
  };

  const handlePressCard = () => {
    if (currentTrip) {
      router.push(`/trip/${currentTrip.plan_id}`);
    }
  };

  const formatDate = (start: string, end: string) => {
    const s = dayjs(start);
    const e = dayjs(end);
    return `${s.format('D MMM')} - ${e.format('D MMM YYYY')}`;
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.centerContent]}>
        <ActivityIndicator color="#FFB7C5" />
      </View>
    );
  }

  // กรณีไม่มีทริปเลย (หรือไม่มี OnTrip/Ended)
  if (!currentTrip) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <Text style={styles.emptyTitle}>ยังไม่มีการเดินทางเร็วๆ นี้</Text>
        <Text style={styles.emptySubtitle}>สร้างทริปใหม่ หรือเข้าร่วมกับเพื่อนได้เลย!</Text>
        
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.sakuraButton} onPress={handleCreateTrip}>
            <Ionicons name="add-circle-outline" size={20} color="white" />
            <Text style={styles.buttonText}>สร้างทริป</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sakuraButton, styles.joinButton]} onPress={handleJoinTrip}>
            <Ionicons name="people-outline" size={20} color="#FF99AC" />
            <Text style={[styles.buttonText, styles.joinButtonText]}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isEnded = dayjs().isAfter(dayjs(currentTrip.end_plan_date));
  // กรณีมีทริป (แสดง On Trip หรือ Last Ended)
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardHeader}>ทริปล่าสุด</Text>
        
        {/* ด้านขวา: สถานะ + ปุ่ม (ถ้ามี) */}
        <View style={styles.rightHeader}>
            <Text style={[styles.statusText, isEnded ? styles.statusEnded : styles.statusActive]}>
                {isEnded ? "จบแล้ว" : "กำลังเดินทาง"}
            </Text>

            {/* แสดงปุ่มเฉพาะเมื่อทริปจบแล้ว */}
            {isEnded && (
            <TouchableOpacity style={styles.smallSakuraBtn} onPress={handleCreateTrip}>
                <Text style={styles.smallSakuraText}>+ ทริปใหม่</Text>
            </TouchableOpacity>
            )}
        </View>
      </View>

      <TouchableOpacity style={styles.info} onPress={handlePressCard} activeOpacity={0.8}>
        <Image
          source={require('@/assets/images/home/fuji-view.jpg')}
          style={styles.cardImage}
        />
        <View style={styles.textContainer}>
          <Text style={styles.tripTitle} numberOfLines={1}>{currentTrip.name_group}</Text>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.detailText}>
              {formatDate(currentTrip.start_plan_date, currentTrip.end_plan_date)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={14} color="#666" />
            <Text style={styles.detailText}>
               {currentTrip.tripGroup?.members ? currentTrip.tripGroup.members.length + 1 : 1} คน
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    width: '90%', // ปรับความกว้างให้เหมาะสม
    alignSelf: 'center',
    padding: 14,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 20,
    marginTop: 10,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 150,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: "#ffffffff",
    fontWeight: '600',
  },
  statusActive: {
    backgroundColor: '#51e169ff', // Lavender Blush (สีพื้นอ่อนๆ)
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#57de6eff',
  },
  statusEnded: {
    color: '#888',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardImage: {
    width: 130,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  
  // Styles สำหรับปุ่ม Sakura
  smallSakuraBtn: {
    backgroundColor: '#FFF0F5', // Lavender Blush (สีพื้นอ่อนๆ)
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB7C5',
  },
  smallSakuraText: {
    fontSize: 12,
    color: '#FF69B4', // Hot Pink
    fontWeight: '600',
  },

  // Styles สำหรับ Empty State
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  sakuraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB7C5', // Sakura Pink
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#FFB7C5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  joinButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#FFB7C5',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  joinButtonText: {
    color: '#FF99AC',
  }
});