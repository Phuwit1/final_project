
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import InfoCard from '../../components/ui/home/InfoCard'; 
import SearchCard from '../../components/ui/search/searchCard';
import AsyncStorage from '@react-native-async-storage/async-storage';


interface Attraction {
  attraction_id: number;
  name: string;
  photo_ref: string | null;
  rating: number | null;
  description: string | null;
  local_image_path?: string | null;
}

interface City {
  city_id: number;
  name: string;
  attractions: Attraction[]; 
}
import { API_URL } from '@/api.js'; 


export default function ExploreScreen() {
  const navigation = useNavigation();
  const [cityData, setCityData] = useState<any[]>([]); 
  const [searchText, setSearchText] = useState("");


  useEffect(() => {
    fetchExploreData();
  }, []);

  const fetchExploreData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${API_URL}/explore-cities`, {
        headers: { 
        Authorization: `Bearer ${token}` 
      }});
      setCityData(res.data);
    } catch (err) {
      console.log("Error fetching explore data:", err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput 
                    placeholder="Search destination..." 
                    style={styles.input}
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>
        </View>

        {cityData.map((city) => {
            if (!city.attractions || city.attractions.length === 0) return null;

            return (
                <View key={city.city_id} style={styles.sectionContainer}>
              
                    <Text style={styles.sectionTitle}>{city.name}</Text>
                    
    
                    <ScrollView 
                        horizontal={true} 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 20 }}
                    >
                        {city.attractions.map((attraction: Attraction) => (
                             <View key={attraction.attraction_id} style={{ marginRight: 15 }}>
                                <SearchCard 
                                    title={attraction.name}
                                    photo_ref={attraction.photo_ref} 
                                    rating={attraction.rating}
                                    onPress={() => console.log("กดที่", attraction.name)}
                                />
                            </View>
                        ))}
                    </ScrollView>
                </View>
            );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 15, marginBottom: 10 },
  header: { paddingHorizontal: 20, marginBottom: 10 },
  logoText: { fontSize: 24, fontWeight: 'bold', color: '#FF5A5F' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f2', padding: 12, borderRadius: 10, gap: 10 },
  input: { flex: 1, fontSize: 16 },
  sectionContainer: { marginBottom: 25 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', marginLeft: 20, marginBottom: 10, color: '#333' },
});