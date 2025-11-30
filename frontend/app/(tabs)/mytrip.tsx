
// import SakuraBackground from '@/components/ui/sakurabackground';
// import { View } from 'react-native';

// export default function Mytrip(){
//     return (
//        <View style={{ flex: 1 }}>
//         <SakuraBackground />
//         {/* Your main content here */}
//     </View>
//     )
// }

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import SakuraBackground from '@/components/ui/sakurabackground';
import TripCard from '@/components/ui/trip/cardtrip';
import TopBar from '@/components/TopBar';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { API_URL } from '@/api.js'


type Trip = {
  plan_id: number;
  name_group: string;
  start_plan_date: string;
  end_plan_date: string;
  tripGroup?: {
    members: any[]; // หรือกำหนด Type Member ให้ชัดเจน
  } | null;

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
  dayjs.locale('th');

  const start = dayjs(startStr);
  const end = dayjs(endStr);

  const startDate = start.date(); // วันที่ เช่น 6
  const endDate = end.date();     // วันที่ เช่น 10
  const monthName = start.format('MMM'); // เดือน ย่อ เช่น ก.ค.
  const year = toThaiYear(start) % 100;  // ปี 65 (เอา 2 หลักหลัง)

  return `${startDate}-${endDate} ${monthName} ${year}`;
};

export default function TripListScreen() {
  const [search, setSearch] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useFocusEffect(
  useCallback(() => {
    const fetchTrips = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        console.log('Token from AsyncStorage:', token);
        if (!token) {
          setError('Token not found');
          setLoading(false);
          return;
        }

        const res = await axios.get(`${API_URL}/trip_plan`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
        setError(err.response?.data?.detail || 'Failed to load trips');
        setLoading(false);
      }
    };

    fetchTrips();

    // Optional: clean up if needed
    return () => {};
  }, []) // dependency array
);



  const filteredTrips = Array.isArray(trips)
  ? trips.filter((trip: any) =>
      trip.name_group?.toLowerCase().includes(search.toLowerCase())
    )
  : [];

  const renderItem = ({ item }: { item: Trip }) => {
    const durationDays = Math.ceil(
      (new Date(item.end_plan_date).getTime() - new Date(item.start_plan_date).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const formattedDate = formatTripDateRange(item.start_plan_date, item.end_plan_date);
    
    const memberCount = item.tripGroup?.members?.length || 1;

    return (
      <TouchableOpacity onPress={() => router.push(`/trip/${item.plan_id}`)}>
        <TripCard
          name={item.name_group}
          date={formattedDate}
          duration={`${durationDays} วัน`}
          status={getStatus(item.start_plan_date, item.end_plan_date)}
          people={memberCount}
        />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TopBar/>
      <View style={styles.container}>
        <SakuraBackground />
        <TextInput
          style={styles.searchBar}
          placeholder="ค้นหาทริป..."
          value={search}
          onChangeText={setSearch}
        />

        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <FlatList
            data={filteredTrips}
            keyExtractor={(item) => item.plan_id.toString()}
            renderItem={renderItem}
            ListEmptyComponent={<Text>ไม่พบทริป</Text>}
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
  searchBar: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
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
  
});
