// import { StyleSheet, Image, Platform } from 'react-native';

// import { Collapsible } from '@/components/Collapsible';
// import { ExternalLink } from '@/components/ExternalLink';
// import ParallaxScrollView from '@/components/ParallaxScrollView';
// import { ThemedText } from '@/components/ThemedText';
// import { ThemedView } from '@/components/ThemedView';
// import { IconSymbol } from '@/components/ui/IconSymbol';

// export default function TabTwoScreen() {
//   return (
//     <ParallaxScrollView
//       headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
//       headerImage={
//         <IconSymbol
//           size={310}
//           color="#808080"
//           name="chevron.left.forwardslash.chevron.right"
//           style={styles.headerImage}
//         />
//       }>
//       <ThemedView style={styles.titleContainer}>
//         <ThemedText type="title">Explore</ThemedText>
//       </ThemedView>
//       <ThemedText>This app includes example code to help you get started.</ThemedText>
//       <Collapsible title="File-based routing">
//         <ThemedText>
//           This app has two screens:{' '}
//           <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> and{' '}
//           <ThemedText type="defaultSemiBold">app/(tabs)/explore.tsx</ThemedText>
//         </ThemedText>
//         <ThemedText>
//           The layout file in <ThemedText type="defaultSemiBold">app/(tabs)/_layout.tsx</ThemedText>{' '}
//           sets up the tab navigator.
//         </ThemedText>
//         <ExternalLink href="https://docs.expo.dev/router/introduction">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Android, iOS, and web support">
//         <ThemedText>
//           You can open this project on Android, iOS, and the web. To open the web version, press{' '}
//           <ThemedText type="defaultSemiBold">w</ThemedText> in the terminal running this project.
//         </ThemedText>
//       </Collapsible>
//       <Collapsible title="Images">
//         <ThemedText>
//           For static images, you can use the <ThemedText type="defaultSemiBold">@2x</ThemedText> and{' '}
//           <ThemedText type="defaultSemiBold">@3x</ThemedText> suffixes to provide files for
//           different screen densities
//         </ThemedText>
//         <Image source={require('@/assets/images/react-logo.png')} style={{ alignSelf: 'center' }} />
//         <ExternalLink href="https://reactnative.dev/docs/images">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Custom fonts">
//         <ThemedText>
//           Open <ThemedText type="defaultSemiBold">app/_layout.tsx</ThemedText> to see how to load{' '}
//           <ThemedText style={{ fontFamily: 'SpaceMono' }}>
//             custom fonts such as this one.
//           </ThemedText>
//         </ThemedText>
//         <ExternalLink href="https://docs.expo.dev/versions/latest/sdk/font">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Light and dark mode components">
//         <ThemedText>
//           This template has light and dark mode support. The{' '}
//           <ThemedText type="defaultSemiBold">useColorScheme()</ThemedText> hook lets you inspect
//           what the user's current color scheme is, and so you can adjust UI colors accordingly.
//         </ThemedText>
//         <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
//           <ThemedText type="link">Learn more</ThemedText>
//         </ExternalLink>
//       </Collapsible>
//       <Collapsible title="Animations">
//         <ThemedText>
//           This template includes an example of an animated component. The{' '}
//           <ThemedText type="defaultSemiBold">components/HelloWave.tsx</ThemedText> component uses
//           the powerful <ThemedText type="defaultSemiBold">react-native-reanimated</ThemedText>{' '}
//           library to create a waving hand animation.
//         </ThemedText>
//         {Platform.select({
//           ios: (
//             <ThemedText>
//               The <ThemedText type="defaultSemiBold">components/ParallaxScrollView.tsx</ThemedText>{' '}
//               component provides a parallax effect for the header image.
//             </ThemedText>
//           ),
//         })}
//       </Collapsible>
//     </ParallaxScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   headerImage: {
//     color: '#808080',
//     bottom: -90,
//     left: -35,
//     position: 'absolute',
//   },
//   titleContainer: {
//     flexDirection: 'row',
//     gap: 8,
//   },
// });


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


type Trip = {
  plan_id: number;
  name_group: string;
  start_plan_date: string;
  end_plan_date: string;

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

        const res = await axios.get('http://192.168.1.45:8000/trip_plan', {
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
    

    return (
      <TouchableOpacity onPress={() => router.push(`/trip/${item.plan_id}`)}>
        <TripCard
          name={item.name_group}
          date={formattedDate}
          duration={`${durationDays} วัน`}
          status={getStatus(item.start_plan_date, item.end_plan_date)}
          people={1}
        />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TopBar/>
      <View style={styles.container}>
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
