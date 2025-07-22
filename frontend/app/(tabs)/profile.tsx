// ProfileScreen.tsx
// import React, { useEffect, useState } from 'react';
// import { View, Text, ActivityIndicator, Alert, Button  } from 'react-native';
// import axios from 'axios';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import LogoutButton from '@/components/ui/Logoutbutton';
// import { useNavigation } from '@react-navigation/native';

// type User = {
//   first_name: string;
//   last_name: string;
//   email: string;
// };
// const ProfileScreen = () => {
//   const [user, setUser] = useState<User | null>(null);
//   const navigation = useNavigation<any>();


//   const fetchProfile = async () => {
//     try {
//       const token = await AsyncStorage.getItem('access_token');
//       if (!token) {
//         console.log('❌ No token found in storage');
//         Alert.alert('Unauthorized', 'Please log in again');
//       return;
// }

//       const res = await axios.get('http://192.168.1.45:8000/user',{
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       setUser(res.data);
//     } catch (err : any) {
//       console.log('Fetch user error:', err.response?.data || err.message);
//       Alert.alert('Error', 'Unable to fetch profile');
//     }
//   };

//   const handleLogoutSuccess = () => {
//     navigation.navigate('Login'); // ไปหน้า Login หลัง logout สำเร็จ
//   };

//   useEffect(() => {
//     fetchProfile();
//   }, []);

//     if (!user) {
//         return (
//             <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//             <ActivityIndicator size="large" color="#0000ff" />
//             <Text>Loading profile...</Text>
//             <View style={{ marginTop: 20 }}>
//             <Button
//                 title="Go to Login"
//                 onPress={() => navigation.navigate('Login')}
//             />
//             </View>
//         </View>
//         );
//     }

//   return (
//      <View style={{ padding: 20 }}>
//       <Text style={{ fontSize: 18, marginBottom: 10 }}>👤 Profile</Text>
//       <Text>First Name: {user.first_name}</Text>
//       <Text>Last Name: {user.last_name}</Text>
//       <Text>Email: {user.email}</Text>

//       <View style={{ marginTop: 30 }}>
//         <LogoutButton onLogoutSuccess={handleLogoutSuccess} />
//       </View>
//     </View>


//   );
// };

// export default ProfileScreen;


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

    const res = await axios.get('http://192.168.1.45:8000/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    console.log("User response:", res.data);
    setUser(res.data);
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

  useEffect(() => {
    if (user) {
      setTempInfo(user);
    }
  }, [user]);

  const handleLogoutSuccess = () => {
    router.push('/Login') // ไปหน้า Login หลัง logout สำเร็จ
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

  const completedTrips = [
    {
      id: 1,
      title: 'โตเกียว-โอซาก้า 7 วัน',
      date: 'มีนาคม 2024',
      duration: '7 วัน 6 คืน',
      image: '🏯',
      rating: 4.8,
      totalCost: '฿45,000',
      highlights: ['Shibuya Crossing', 'Mount Fuji', 'Osaka Castle', 'Dotonbori'],
      description: 'ทริปสุดประทับใจ ได้เห็นภูเขาฟูจิและลิงสกี มากินอาหารอร่อยๆ เยอะมาก'
    },
    {
      id: 2,
      title: 'เกียวโต ฤดูใบไม้ผลิ',
      date: 'เมษายน 2024',
      duration: '5 วัน 4 คืน',
      image: '🌸',
      rating: 5.0,
      totalCost: '฿38,000',
      highlights: ['Fushimi Inari', 'Bamboo Forest', 'Kinkaku-ji', 'Gion District'],
      description: 'ช่วงซากุระบาน สวยมากๆ ถ่ายรูปได้สวยทุกมุม วัดทองคำสวยจนต้องไปหลายรอบ'
    }
  ];

  const TripCard = ({ trip }: any) => (
    <View style={styles.tripCard}>
      <Text style={styles.tripImage}>{trip.image}</Text>
      <View style={styles.tripInfo}>
        <Text style={styles.tripTitle}>{trip.title}</Text>
        <Text style={styles.tripSubtitle}>{trip.date} • {trip.duration}</Text>
        <Text style={styles.tripDetails}>⭐ {trip.rating}   💵 {trip.totalCost}</Text>
        <Text style={styles.tripDescription}>{trip.description}</Text>
        <View style={styles.highlights}>
          {trip.highlights.map((h : any, idx : any) => (
            <Text key={idx} style={styles.highlightTag}>{h}</Text>
          ))}
        </View>
      </View>
    </View>
  );

  
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

      <TouchableOpacity style={styles.tripToggle} onPress={() => setShowTrips(!showTrips)}>
        <Text style={styles.sectionTitle}>ทริปที่เสร็จสิ้นแล้ว ({completedTrips.length}) {showTrips ? '⬆️' : '⬇️'}</Text>
      </TouchableOpacity>
      {showTrips && completedTrips.map(trip => <TripCard key={trip.id} trip={trip} />)}

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
  }
});