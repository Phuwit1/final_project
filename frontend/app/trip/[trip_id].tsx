
import {View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import TripCard from '@/components/ui/trip/cardtrip';
import DailyPlanTabs from '@/components/ui/trip/Dailytrip';
import { useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

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
  const monthName = start.format('MMM');
  const year = (start.year() + 543) % 100;
  return `${startDate}-${endDate} ${monthName} ${year}`;
};

// const mockTrips = [
//     {
//       id: '1',
//       name: 'Tokyo Tok Tok',
//       city: 'Tokyo',
//       date: '20-23 เม.ย 68',
//       duration: '3 วัน 2 คืน',
//       status: 'On Trip',
//       people: 3,
//       image: require('@/assets/images/home/fuji-view.jpg'),
//     },
// ]


export default function Hometrip() {

    const { trip_id } = useLocalSearchParams();
    const [trip, setTrip] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
    const fetchTrip = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        console.log("Trip ID:", trip_id );
        if (!token) return;

        const res = await axios.get(`http://192.168.1.45:8000/trip_plan/${trip_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Fetched trip:", res.data);
        
        setTrip(res.data);
      } catch (err) {
        console.error('Error fetching trip:', err);
      } finally {
        setLoading(false);
      }
    };

    if (trip_id) {
      fetchTrip();
    }
  }, [trip_id]);

    if (loading) {
        return <ActivityIndicator style={{ marginTop: 100 }} />;
    }

    if (!trip) {
        return <Text style={{ textAlign: 'center', marginTop: 100 }}>ไม่พบทริป</Text>;
    }

    return (
        <>
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
        
                      <View style={styles.overlayContent}>
                        <View style={styles.cardWrapper}>
                        <TripCard 
                            name={trip.name_group}
                            date={formatTripDateRange(trip.start_date, trip.end_date)}
                            duration={`${getDuration(trip.start_date, trip.end_date)} วัน`}
                            status={getStatus(trip.start_date, trip.end_date)}
                            people={(trip.members?.length || 0) + 1}
                            // image={require('@/assets/images/home/fuji-view.jpg')}
                           
                            />
                            </View>

                      </View>
                  </View>
                  
                }  
                
              >
                 <DailyPlanTabs
                startDate={trip.start_date}
                endDate={trip.end_date}
                plans={[
                  'เที่ยววัด Asakusa, กินราเมน',
                  'ไป DisneySea, ช็อปปิ้ง Shibuya',
                  'เดินเล่น Ueno Park แล้วกลับ',
                ]}
              />

              </ParallaxScrollView>

             
        </>
       
    )
}

const styles = StyleSheet.create({
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