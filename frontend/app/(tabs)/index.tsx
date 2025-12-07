import {View, Text, StyleSheet, Image } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import CurrentCard from '@/components/ui/home/CurrentCard';
import InfoCard from '@/components/ui/home/InfoCard';
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/api.js'


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

    useFocusEffect(
      React.useCallback(() => {
        fetchProfile();
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
                
                <CurrentCard />
                
              </View>
          </View>
          
        }  
      >
          <View>
            <Text style={{fontSize: 24}}> สถานที่ท่องเที่ยวแนะนำ</Text>
          </View>
          
          <View style={styles.container}>
            <>
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
            </>
          </View>
      

        <View>
          <Text style={{fontSize: 24}}> ร้านอาหารแนะนำ</Text>
          <View style={styles.container}>
            <>
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard />
            </> 
          </View>
        </View>

        <View>
          <Text style={{fontSize: 24}}> ทริปไกด์แนะนำ</Text>
          <View style={styles.container}>
            <>
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
              <InfoCard /> 
            </>
          </View>
        </View>
      
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
