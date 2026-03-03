
import {View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import TripCardID from '@/components/ui/trip/cardtripId';
import DailyPlanTabs from '@/components/ui/trip/Dailytrip';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import FloatingChat from '@/components/ui/trip/chat/Floatingchat';
import { DailyPlanTabsHandle } from '@/components/ui/trip/Dailytrip';

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/api.js'
import DownloadTripButton from '@/components/ui/trip/DownloadTripButton';
import { useSQLiteContext } from 'expo-sqlite';


dayjs.locale('en');

const getStatus = (start: string, end: string): 'Upcoming' | 'On Trip' | 'Trip Ended' => {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (now < startDate) return 'Upcoming';
  if (now >= startDate && now <= endDate) return 'On Trip';
  return 'Trip Ended';
};

const getDuration = (start: string, end: string): number => {
  return dayjs(end).diff(dayjs(start), 'day') + 1;
};

const formatTripDateRange = (startStr: string, endStr: string): string => {
  const start = dayjs(startStr);
  const end = dayjs(endStr);
  const startDate = start.date();
  const endDate = end.date();
  const monthName = end.format('MMM');
  const year = (start.year() + 543) % 100;
  return `${startDate}-${endDate} ${monthName} ${year}`;
};

type TimeSlot = 'MORNING'|'AFTERNOON'|'EVENING'|'NIGHT';
type DailyPlan = { day:number; date:string; items: Partial<Record<TimeSlot, string[]>> };


export default function Hometrip() {
    const db = useSQLiteContext();
    
    const { trip_id } = useLocalSearchParams();
    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const API_BASE = useMemo(() => `${API_URL}`, []);
    const [netStatus, setNetStatus] = useState<boolean>(true);
    
    const dailyRef = useRef<DailyPlanTabsHandle>(null);
    const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]); 
    
    const [refreshKey, setRefreshKey] = useState(Date.now());


    useFocusEffect(
      useCallback(() => {
        const fetchTrip = async () => {
          try {
            const token = await AsyncStorage.getItem('access_token');
            console.log("Trip ID:", trip_id );
            if (!token) return;

            const res = await axios.get(`${API_URL}/trip_plan/${trip_id}`, {
              headers: { Authorization: `Bearer ${token}`,'Cache-Control': 'no-cache' },
              timeout: 10000,
              params: { t: new Date().getTime() },
            });
            setTrip(res.data);

            setRefreshKey(Date.now());
          } catch (err: any) {
            if (err.response) {
              console.error('Error fetching trip:', err);
              return;
            }
            try {
              const offlineTripsSchedule = await db.getAllAsync('SELECT * FROM TripPlan WHERE plan_id = ?', [trip_id as any]);
              setTrip(offlineTripsSchedule[0]);
              setNetStatus(false);
            }
            catch (error) {
              console.error('Error fetching offline trip schedule:', error);
            }
            
          } finally {
            setLoading(false);
          }
        };

        if (trip_id) {
          fetchTrip();
        }
      }, [trip_id])
    );

    

    if (loading) {
        return <ActivityIndicator style={{ marginTop: 100 }} />;
    }

    if (!trip) {
        return <Text style={{ textAlign: 'center', marginTop: 100 }}>ไม่พบทริป</Text>;
    }

    const totalDays = getDuration(trip.start_plan_date, trip.end_plan_date);

    const handleImageUpdate = (newImageUrl: string) => {
      console.log("Parent received new image:", newImageUrl);
      
      // สั่ง update state ของแม่ (เพื่อให้หน้าจอมัน render รูปใหม่)
      setTrip((prev: any) => ({
        ...prev,
        image: newImageUrl 
      }));
    };

    return (
        <View style={styles.screen} pointerEvents="box-none">
            
            <ParallaxScrollView
                headerHeight={350}
                headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
                headerImage={
                   <View style={styles.imageWrapper}>
                    <Image  
                      source={require('@/assets/images/home/fuji-view.jpg')}
                      style={styles.imageview}
                    />
                    
                    <View style={styles.imageOverlay} />
                      {/* เพิ่มปุ่มดาวน์โหลดข้อมูลทริปสำหรับดูออฟไลน์ */}
                      {netStatus && (
                        <View style={{ alignItems: 'flex-end', paddingRight: 16, marginTop: -50 }}>
                          <DownloadTripButton tripData={trip} planId={trip.plan_id} />
                        </View>
                      )}
                      <View style={styles.overlayContent}>
                        <View style={styles.cardWrapper}>
                        <TripCardID
                            name={trip.name_group}
                            date={formatTripDateRange(trip.start_plan_date, trip.end_plan_date)}
                            duration={`${getDuration(trip.start_plan_date, trip.end_plan_date)}`}
                            status={getStatus(trip.start_plan_date, trip.end_plan_date)}
                            people={(trip.tripGroup?.members?.length || 1)}
                            planId={trip.plan_id}
                            tripId={trip.trip_id}
                            budget={trip.budget?.total_budget}
                            netStatus={netStatus}
                            image={trip.image || 'https://via.placeholder.com/300x200.png?text=No+Image'}
                            onImageUpdate={handleImageUpdate}
                            />
                            </View>
                      </View>
                  </View>
                  
                }  
                
              >
              <DailyPlanTabs
                    key={refreshKey}
                    startDate={trip.start_plan_date}
                    endDate={trip.end_plan_date}
                    planId={trip.plan_id}                 // << ส่งแผนที่ใช้งานจริงเข้าไปตรงๆ
                    ref={dailyRef}
              />

              </ParallaxScrollView>

              {netStatus && (
                <FloatingChat
                  apiBaseUrl={API_BASE}
                  planId={trip.plan_id}
                />
              )}
              

             
        </View>
       
    )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: 'relative',    // ✅ ให้ลูก absolute ยึดเต็มจอได้
  },
  scroll: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    gap: 10
  
  },
   imageWrapper: {
    position: 'relative',
    width: '100%',
    height: 350,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  
  },
  imageview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', // Adjust the opacity here
  },
   overlayContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cardWrapper: {
  width: '90%',
  maxWidth: 400,
  // backgroundColor: '#fff', // ใช้ช่วย debug
  borderRadius: 12,
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
},
  
});
