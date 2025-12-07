import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import LogoutButton from '@/components/ui/Logoutbutton';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useRouter } from 'expo-router';
import { API_URL } from '@/api.js'
import FinishedTripCard from '@/components/ui/profile/FinishedTripCard';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

export default function ProfileScreen() {
  const [isEditing, setIsEditing] = useState(false);
  const [showTrips, setShowTrips] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tempInfo, setTempInfo] = useState<any>(null);
  const navigation = useNavigation<any>();
  const router = useRouter();
  


  const fetchProfile = async () => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    console.log("FetchProfile with token:", token);

    if (!token) {
      Alert.alert('Unauthorized', 'Please log in again');
      return;
    }

    const res = await axios.get(`${API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    const userData = res.data;

    const tripsRes = await axios.get(`${API_URL}/trip_plan`, {
          headers: { Authorization: `Bearer ${token}` }
      });

    const fullUserData = {
          ...userData,
          ownedTrips: tripsRes.data // เอาทริปมาใส่ใน user object
      };


    console.log("User response:", res.data);
    setUser(fullUserData);
    setTempInfo(fullUserData);
  } catch (err : any) {
    console.log('Fetch user error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('access_token');
      router.push('/Login')
    }
  }
};


  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  const handleLogoutSuccess = () => {
    router.push('/Login') // ไปหน้า Login หลัง logout สำเร็จ
  };

  const getTripStatus = (end: string) => {
    const now = dayjs();
    const endDate = dayjs(end);
    return now.isAfter(endDate, 'day') ? 'Ended' : 'Active';
  };

  const handleSave = () => {
    setUser(tempInfo);
    setIsEditing(false);
    Alert.alert('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว');
  };

  const handleCancel = () => {
    setTempInfo(user);
    setIsEditing(false);
  };

  if (!user) {
    return (
      <View style={styles.container}><Text>กรุณาเข้าสู่ระบบ</Text>
      <TouchableOpacity onPress={() => router.push('/Login')}>
        <Text>🔑 ไปหน้า Login</Text>
      </TouchableOpacity></View>
    );
  }

 

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>โปรไฟล์ของฉัน</Text>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
          <Text style={styles.editIcon}>{isEditing ? '✕' : '✏️'}</Text>
        </TouchableOpacity>
      </View>

      {user && tempInfo && (
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>
              {user.name?.slice(0, 2) || '👤'}
            </Text>
          </View>

          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={tempInfo.name}
              onChangeText={val => setTempInfo({ ...tempInfo, name: val })}
            />
          ) : (
            <Text style={styles.name}>{user.first_name} {user.last_name}</Text>
          )}

          <Text style={styles.joinDate}>สมาชิกตั้งแต่ {format(new Date(user.createdAt), "d MMM yyyy", { locale: th })}</Text>

          <Text style={styles.sectionTitle}>เกี่ยวกับฉัน</Text>
          {isEditing ? (
            <TextInput
              style={styles.textArea}
              multiline
              value={tempInfo.bio}
              onChangeText={val => setTempInfo({ ...tempInfo, bio: val })}
            />
          ) : (
            <Text style={styles.bio}>{user.bio}</Text>
          )}

          <Text style={styles.sectionTitle}>ข้อมูลติดต่อ</Text>
          {['email', 'phone', 'birthDate'].map((field, i) => (
            <View key={i} style={styles.inputGroup}>
              <Text style={styles.label}>
                {field === 'email' ? 'อีเมล' :
                  field === 'phone' ? 'เบอร์โทรศัพท์' :
                    field === 'birthDate' ? 'วันเกิด' : ''}
              </Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={tempInfo[field]}
                  onChangeText={val => setTempInfo({ ...tempInfo, [field]: val })}
                />
              ) : (
                <Text style={styles.inputText}>{user[field]}</Text>
              )}
            </View>
          ))}

          {isEditing && (
            <View style={styles.buttonGroup}>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.buttonText}>💾 บันทึก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.buttonText}>✕ ยกเลิก</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <View style={styles.tripSection}>
        <TouchableOpacity 
          style={styles.tripHeader} 
          onPress={() => setShowTrips(!showTrips)}
        >
          <Text style={styles.tripHeaderText}>ประวัติการเดินทาง</Text>
          <Ionicons name={showTrips ? "chevron-up" : "chevron-down"} size={20} color="#666" />
        </TouchableOpacity>
        
        {showTrips && (
          <View style={styles.tripList}>
            {user.ownedTrips && user.ownedTrips.length > 0 ? (
              user.ownedTrips.map((trip: any) => {
                const startDate = new Date(trip.start_plan_date);
                const endDate = new Date(trip.end_plan_date);
                const isFinished = new Date() > endDate; // เช็คว่าทริปจบหรือยัง
                const formattedDate = `${format(startDate, 'd MMM', { locale: th })} - ${format(endDate, 'd MMM yyyy', { locale: th })}`;
              
                return (
                  <TouchableOpacity 
                    key={trip.trip_id || trip.plan_id}
                    onPress={() => router.push(`/trip/${trip.plan_id}`)}
                  >
                    <FinishedTripCard
                        name={trip.name_group}
                        date={formattedDate}
                        budget={trip.budget?.total_budget || 0}
                        people={trip.members?.length ? trip.members.length + 1 : 1}
                        city="Tokyo, Kyoto" // ถ้ามีข้อมูลเมืองในอนาคตก็ใส่ตรงนี้
                    />
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.noTripText}>ยังไม่มีประวัติการเดินทาง</Text>
            )}
          </View>
        )}
      </View>

      {user ? (
          <LogoutButton onLogoutSuccess={handleLogoutSuccess} />
        ) : (
          <TouchableOpacity
            
            onPress={() => router.push('/Login')}
          >
            <Text>🔑 ไปหน้า Login</Text>
          </TouchableOpacity>
        )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdff',
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  editIcon: {
    fontSize: 20,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2
  },
  avatarBox: {
    width: 80,
    height: 80,
    backgroundColor: '#cbd5e1',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  nameInput: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  joinDate: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    color: '#888'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  textArea: {
    height: 80,
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    textAlignVertical: 'top'
  },
  bio: {
    fontSize: 14,
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 8,
  },
  inputGroup: {
    marginBottom: 12
  },
  label: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  inputText: {
    fontSize: 14,
    color: '#111'
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  saveButton: {
    backgroundColor: '#059669',
  },
  cancelButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  tripToggle: {
    marginBottom: 16,
  },
  tripCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  tripImage: {
    fontSize: 24,
    marginBottom: 8
  },
  tripInfo: {},
  tripTitle: {
    fontWeight: 'bold',
    fontSize: 16
  },
  tripSubtitle: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4
  },
  tripDetails: {
    fontSize: 12,
    color: '#444',
    marginBottom: 4
  },
  tripDescription: {
    fontSize: 13,
    marginBottom: 6
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  highlightTag: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    marginRight: 4,
    marginBottom: 4
  },
  tripSection: { 
    marginTop: 10, paddingHorizontal: 20, paddingTop: 20, 
    borderTopWidth: 8, borderTopColor: '#f5f5f5' 
  },
  tripHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingVertical: 10, marginBottom: 10 
  },
  tripHeaderText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  tripList: { gap: 10 },
  noTripText: { color: '#999', textAlign: 'center', marginVertical: 20 },
});
