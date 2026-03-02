import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SearchCard from '../../components/ui/search/searchCard'; // ตรวจสอบ Path ด้วยนะครับ
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js'; 

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

export default function ExploreScreen() {
  const navigation = useNavigation();
  const [cityData, setCityData] = useState<City[]>([]); // ✅ เปลี่ยน type ให้ถูกต้อง
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    fetchExploreData();
  }, []);

  const fetchExploreData = async () => {
    try {
      const res = await axios.get(`${API_URL}/explore-cities`);
      setCityData(res.data);
    } catch (err) {
      console.log("Error fetching explore data:", err);
    }
  };

  // ✅ 1. เพิ่ม Logic สำหรับการ Filter ข้อมูล
  const filteredData = cityData.reduce((acc: City[], city) => {
    const lowerSearch = searchText.toLowerCase();
    
    // เช็คว่าชื่อเมืองตรงกับคำค้นหาไหม
    const isCityMatch = city.name.toLowerCase().includes(lowerSearch);

    // กรองหาสถานที่ที่ชื่อตรงกับคำค้นหา
    const matchingAttractions = city.attractions.filter((attr) =>
      attr.name.toLowerCase().includes(lowerSearch)
    );

    // ถ้าพิมพ์ค้นหาแล้วตรงกับชื่อ "เมือง" -> แสดงสถานที่ทั้งหมดในเมืองนั้น
    // ถ้าไม่ตรงกับชื่อเมือง -> แสดงเฉพาะ "สถานที่" ที่ค้นเจอ
    const attractionsToShow = isCityMatch ? city.attractions : matchingAttractions;

    // ถ้ามีสถานที่ให้แสดงผล (มากกว่า 0) ค่อยเก็บเข้า Array
    if (attractionsToShow.length > 0) {
      acc.push({ ...city, attractions: attractionsToShow });
    }
    
    return acc;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput 
                    placeholder="Search destination or attraction..." 
                    style={styles.input}
                    value={searchText}
                    onChangeText={setSearchText} // ค่านี้เปลี่ยนปุ๊บ filteredData จะคำนวณใหม่ปั๊บ
                />
            </View>
        </View>

        {/* ✅ 2. เปลี่ยนจาก cityData.map เป็น filteredData.map */}
        {filteredData.length > 0 ? (
          filteredData.map((city) => (
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
          ))
        ) : (
          /* ✅ 3. เพิ่มหน้าจอตอนค้นหาไม่เจอ */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>ไม่พบสถานที่ที่คุณค้นหา</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 15, marginBottom: 10 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f2', padding: 12, borderRadius: 10, gap: 10 },
  input: { flex: 1, fontSize: 16 },
  sectionContainer: { marginBottom: 25 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', marginLeft: 20, marginBottom: 10, color: '#333' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, color: '#888' }
});