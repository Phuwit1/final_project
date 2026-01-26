import {View, Text, StyleSheet, Image } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import CurrentCard from '@/components/ui/home/CurrentCard';
import InfoCard from '@/components/ui/home/InfoCard';
import FlightSearch from '@/components/ui/home/FlightSearch';
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/api.js'
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface AttractionData {
  attraction_id: number;
  name: string;
  place_types: string[];
  photo_ref: string;
  rating: number;
  address: string;
  description: string;
}

export default function Home(){
  const [user, setUser] = useState<any>(null);


  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.log('No token found');
        return;
      }
      const res = await axios.get(`${API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUser(res.data);
      console.log("User response:", res.data);
    } catch (err: any) {
      console.log('Fetch user error:', err.response?.data || err.message);
    }
  };

  const fetchAttractions = async () => {
    try{
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.log('No token found');
        return;
      }

      const res = await axios.get<AttractionData[]>(`${API_URL}/attractions/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
      );
      const allData = res.data;

      const attractions = allData.filter(item => item.place_types.includes('tourist_attraction'));
      const restaurants = allData.filter(item => item.place_types.includes('restaurant'));

      setAttractions(attractions);
      setRestaurants(restaurants);

    } catch (err: any) {
      console.log('Fetch attractions error:', err.response?.data || err.message);
    }
  }


  useFocusEffect(
      React.useCallback(() => {
        fetchProfile();
        fetchAttractions();
      }, [])
  );

    const fullname = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Guest';
  
    return (
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
        headerImage={
           <View style={styles.imageWrapper}>
            <Image
              source={require('@/assets/images/home/fuji-view.jpg')}
              style={styles.imageview}
            />
            <View style={styles.imageOverlay} />

              <View style={styles.overlayContent}>
                <Text style={styles.welcomeText}>Welcome, {fullname} </Text>
                
                <TouchableOpacity 
                  style={styles.flightButton} 
                  onPress={() => setModalVisible(true)}
                >
                  <Ionicons name="airplane" size={24} color="#fff" />
                </TouchableOpacity>
                <CurrentCard />
                
              </View>
          </View>
          
        }  
      >
          <View>
            <Text style={{fontSize: 24}}> Attraction Recommend </Text>
          </View>
          
         <ScrollView 
            horizontal={true} 
            showsHorizontalScrollIndicator={false} // ซ่อนบาร์เลื่อนด้านล่างให้สวยงาม
            contentContainerStyle={styles.scrollContainer} // ใช้ style ใหม่สำหรับจัดระยะห่าง
          >
            {attractions.map((item) => (
              <View key={item.attraction_id} style={{ marginRight: 15 }}> 
  
                <InfoCard 
                  title={item.name}
                  imageRef={item.photo_ref}
                  rating={item.rating}
                  description={item.description}
                />
              </View>
            ))}

            <TouchableOpacity 
                style={styles.seeMoreCard} 
                onPress={() => router.push(`/search`)}
            >
                <View style={styles.seeMoreContent}>
              
                    <Ionicons name="log-out-outline" style={styles.seeMoreIcon}></Ionicons>
                
                    <Text style={styles.seeMoreText}>ดูเพิ่มเติม</Text>
                </View>
            </TouchableOpacity>
          </ScrollView>
            

        <View>
          <Text style={{fontSize: 24}}> Restaurant Recommend </Text>
          <ScrollView 
              horizontal={true} 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollContainer}
            >
              {restaurants.map((item) => (
                <View key={item.attraction_id} style={{ marginRight: 15 }}>
                  <InfoCard 
                    title={item.name}
                    imageRef={item.photo_ref}
                    rating={item.rating}
                    description={item.description}
                  />
                </View>
              ))}
                <TouchableOpacity 
                  style={styles.seeMoreCard} 
                  onPress={() => router.push(`/search`)} // กดแล้วไป Tab Search
              >
                  <View style={styles.seeMoreContent}>
                  
                      <Ionicons name="log-out-outline" style={styles.seeMoreIcon}></Ionicons>
                    
                      <Text style={styles.seeMoreText}>ดูเพิ่มเติม</Text>
                  </View>
              </TouchableOpacity>
            </ScrollView>
        </View>

        <View>
          <Text style={{fontSize: 24}}> ทริปไกด์แนะนำ</Text>
          <View style={styles.container}>
            <>
            </>
          </View>
        </View>
        <FlightSearch 
          visible={modalVisible} 
          onClose={() => setModalVisible(false)}
        />
      </ParallaxScrollView>
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
    height: 300,
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
  welcomeText: {
    position: 'absolute',
    top: 20,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  
});
