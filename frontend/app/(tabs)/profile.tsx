import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, Alert, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import LogoutButton from '@/components/ui/Logoutbutton';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { API_URL } from '@/api.js'
import FinishedTripCard from '@/components/ui/profile/FinishedTripCard';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import  Avatar  from '@/components/ui/profile/Avatar';
import * as ImagePicker from 'expo-image-picker';
import ProfileSkeleton from '@/components/ui/profile/ProfileSkeleton';
import { LinearGradient } from 'expo-linear-gradient';

const CLOUD_NAME = "dqghrasqe"; 
const UPLOAD_PRESET = "TabiGo";


export default function ProfileScreen() {
  const [isEditing, setIsEditing] = useState(false);
  const [showTrips, setShowTrips] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [tempInfo, setTempInfo] = useState<any>(null);
  const navigation = useNavigation<any>();
  const router = useRouter();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  


  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      console.log("FetchProfile with token:", token);
      setIsLoading(true);

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
      }
    } finally {
      setIsLoading(false);
    }
  };


  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  const handleLogoutSuccess = () => {
    router.push('/Login') // Go to Login page after logout success
  };

  const uploadToCloudinary = async (uri: string) => {
      const data = new FormData();
      let filename = uri.split('/').pop();
      let match = /\.(\w+)$/.exec(filename || '');
      let type = match ? `image/${match[1]}` : `image`;

      // @ts-ignore
      data.append('file', { uri: uri, name: filename, type });
      data.append('upload_preset', UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: data,
        headers: { 'content-type': 'multipart/form-data' },
      });
      
      const json = await res.json();
      return json.secure_url;
  };

  const handleEditImage = async () => {
    // 2.1 ขอสิทธิ์และเลือกรูป
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Permission needed to access media library');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', // Must use string in new version
      allowsEditing: true,
      aspect: [1, 1],       // Profile picture should be square
      quality: 0.6,         // Reduce quality for faster upload
    });

    if (result.canceled) return;

    // 2.2 Start uploading
    try {
      setUploading(true); // Show loading spinner
      const localUri = result.assets[0].uri;

      const newImageUrl = await uploadToCloudinary(localUri);
      console.log("New Profile URL:", newImageUrl);

      const token = await AsyncStorage.getItem('access_token');
      
      await axios.patch(`${API_URL}/customer/${user.customer_id}`, 
        { image: newImageUrl }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // C. Update screen immediately (no need to reload)
      setUser((prev: any) => ({
        ...prev,
        image: newImageUrl 
      }));

      Alert.alert("Success", "Profile picture updated successfully!");

    } catch (error) {
      console.error("Update profile failed:", error);
      Alert.alert("Error", "Failed to upload image, please try again");
    } finally {
      setUploading(false); // Stop loading spinner
    }
  };

  const handleSave = async() => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      console.log("Token:", token);
      console.log("User ID:", user?.customer_id);

      if (!token) {
        Alert.alert("Error", "Token not found, please login again");
        return;
      }
      
      if (!user?.customer_id) {
        Alert.alert("Error", "User ID not found");
        return;
      }

      const payload = {
        // Send only editable fields
        first_name: tempInfo.first_name,
        last_name: tempInfo.last_name,
        phone_number: tempInfo.phone_number,
        birth_date: tempInfo.birth_date,
      };

      // 2. Call API Update
      const res = await axios.put(`${API_URL}/customer/${user.customer_id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 3. Update screen state with new data from server
      setUser(res.data);
      setTempInfo(res.data); // Reset temp to match latest
      setIsEditing(false);
      
      Alert.alert('Success', 'Profile updated successfully');

    } catch (error) {
      console.error("Update profile error:", error);
      Alert.alert('Error', 'Unable to save profile');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // iOS keeps picker visible until Done button or dismiss
    if (selectedDate) {
        setTempInfo({ ...tempInfo, birth_date: selectedDate.toISOString() });
        
        // For Android, close picker after selection
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
    } else {
        // Cancel
        if (Platform.OS === 'android') setShowDatePicker(false);
    }
  };

  const handleCancel = () => {
    setTempInfo(user);
    setIsEditing(false);
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }


  if (!user) {
    return (
      <View style={styles.guestContainer}>
        {/* Decorative Background Elements (วงกลมตกแต่งสไตล์มินิมอลญี่ปุ่น) */}
        <View style={styles.sakuraCircle1} />
        <View style={styles.sakuraCircle2} />

        {/* Large Profile Icon */}
        <View style={styles.guestIconBg}>
          <Ionicons name="person" size={65} color="#FF6B81" />
        </View>

        {/* Invitation Text */}
        <Text style={styles.guestTitle}>Unlock Your Profile</Text>
        <Text style={styles.guestSubtitle}>
          Log in or sign up to save your travel plans, manage your budget, and keep track of your past adventures.
        </Text>

        {/* Login Button */}
        <TouchableOpacity 
          onPress={() => router.push('/Login')}
          activeOpacity={0.8}
          style={styles.guestButtonWrapper}
        >
          <LinearGradient
            // 🌸 Gradient from left to right (light pink -> pinkish red)
            colors={['#FFA0B4', '#FF526C']} 
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.guestLoginGradient}
          >
            <Ionicons name="log-in-outline" size={24} color="#FFF" />
            <Text style={styles.guestLoginText}>Log In / Sign Up</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

 
  const currentBirthDate = tempInfo?.birth_date ? new Date(tempInfo.birth_date) : new Date();
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>My Profile</Text>
        <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
          <Text style={styles.editIcon}>{isEditing ? '✕' : '✏️'}</Text>
        </TouchableOpacity>
      </View>

      {user && tempInfo && (
        <View style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <TouchableOpacity onPress={handleEditImage} style={{ position: 'relative' }}>
    
            <Avatar 
              uri={user?.image} 
              name={user?.name} 
              size={110} 
            />

            {/* ✅ Camera icon button (Badge) */}
            <View style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: '#FF6B6B', // Theme color
              padding: 8,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: 'white'
            }}>
              <Ionicons name="camera" size={16} color="white" />
            </View>

          </TouchableOpacity>
          </View>

          {isEditing ? (
            <View style={{flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 10}}>
                <TextInput
                  style={[styles.nameInput, {flex:1}]}
                  placeholder="First Name"
                  value={tempInfo.first_name}
                  onChangeText={val => setTempInfo({ ...tempInfo, first_name: val })}
                />
                <TextInput
                  style={[styles.nameInput, {flex:1}]}
                  placeholder="Last Name"
                  value={tempInfo.last_name}
                  onChangeText={val => setTempInfo({ ...tempInfo, last_name: val })}
                />
            </View>
          ) : (
            <Text style={styles.name}>{user.first_name} {user.last_name}</Text>
          )}

          <Text style={styles.joinDate}>
            Member since {user.createdAt ? format(new Date(user.createdAt), "d MMM yyyy", { locale: enUS }) : "-"}
          </Text>

          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          {/* 1. Email (usually not editable or requires verification) */}
          <View style={styles.inputGroup}>
             <Text style={styles.label}>Email</Text>
             <Text style={[styles.inputText, { color: '#888' }]}>{user.email}</Text>
          </View>

          {/* 2. Phone number (using field: phone_number) */}
          <View style={styles.inputGroup}>
             <Text style={styles.label}>Phone Number</Text>
             {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={tempInfo.phone_number || ''}
                  onChangeText={val => setTempInfo({ ...tempInfo, phone_number: val })}
                  keyboardType="phone-pad"
                />
             ) : (
                <Text style={styles.inputText}>{user.phone_number || '-'}</Text>
             )}
          </View>

          {/* 3. Birth date (using field: birth_date) */}
          <View style={styles.row}>
          <Text style={styles.label}>Birth Date</Text>
          {isEditing ? (
            <>
              {/* ✅ 4. Switch TextInput to TouchableOpacity to open date picker */}
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <View style={[styles.input, { justifyContent: 'center' }]}>
                    <Text style={{ color: tempInfo.birth_date ? '#333' : '#aaa' }}>
                        {tempInfo.birth_date 
                            ? format(new Date(tempInfo.birth_date), 'dd MMMM yyyy', { locale: enUS }) 
                            : 'Select Birth Date'}
                    </Text>
                </View>
              </TouchableOpacity>

              {/* ✅ 5. Display DateTimePicker */}
              {showDatePicker && (
                <DateTimePicker
                    value={currentBirthDate}
                    mode="date"
                    display="default" // or "spinner"
                    onChange={onDateChange}
                    maximumDate={new Date()} // Cannot select future dates
                />
              )}
            </>
          ) : (
            <Text style={styles.value}>
              {user.birth_date 
                ? format(new Date(user.birth_date), 'dd MMMM yyyy', { locale: enUS }) 
                : '-'}
            </Text>
          )}
        </View>

          {/* Save/Cancel buttons */}
          {isEditing && (
            <View style={styles.buttonGroup}>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                <Text style={[styles.buttonText, {color: '#333'}]}>Cancel</Text>
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
          <Text style={styles.tripHeaderText}>Travel History</Text>
          <Ionicons name={showTrips ? "chevron-up" : "chevron-down"} size={20} color="#666" />
        </TouchableOpacity>
        
        {showTrips && (
          <View style={styles.tripList}>
            {user.ownedTrips && user.ownedTrips.length > 0 ? (
              user.ownedTrips.map((trip: any) => {
                const startDate = new Date(trip.start_plan_date);
                const endDate = new Date(trip.end_plan_date);
                const isFinished = new Date() > endDate; // Check if trip is finished
                const formattedDate = `${format(startDate, 'd MMM', { locale: enUS })} - ${format(endDate, 'd MMM yyyy', { locale: enUS })}`;
              
                return (
                  <TouchableOpacity 
                    key={trip.trip_id || trip.plan_id}
                    onPress={() => router.push(`/trip/${trip.plan_id}`)}
                  >
                    {isFinished ? (<FinishedTripCard
                        name={trip.name_group}
                        date={formattedDate}
                        budget={trip.budget?.total_budget || 0}
                        people={trip.members?.length ? trip.members.length + 1 : 1}
                        city="Tokyo, Kyoto" // Add city data here if available in the future
                    />) : null
                    
                    }
                    
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.noTripText}>No travel history yet</Text>
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
            <Text>🔑 Go to Login</Text>
          </TouchableOpacity>
        )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdff',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    gap: 20,
    marginTop: 15
  },
  headerText: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  guestContainer: {
    flex: 1,
    backgroundColor: '#FFF5F7', // Light pink background (Soft Sakura)
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    position: 'relative', 
    overflow: 'hidden', // Hide circle overflow
  },
  sakuraCircle1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FFE3E8', // Medium pink
    opacity: 0.6,
  },
  sakuraCircle2: {
    position: 'absolute',
    bottom: 40,
    left: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD1DC', // Darker pink
    opacity: 0.5,
  },
  guestIconBg: {
    width: 130,
    height: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    // เงาสีชมพูแดง
    shadowColor: '#FF6B81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  guestTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4A3B3D', // สีเทาอมน้ำตาลเข้ม (ดูอบอุ่นกว่าสีดำสนิท)
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  guestSubtitle: {
    fontSize: 15,
    color: '#7A6B6D', // สีเทาอมชมพูหม่น
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 15,
  },
 guestButtonWrapper: {
    borderRadius: 30,
    // Add shadow to button wrapper
    shadowColor: '#FF526C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  guestLoginGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  guestLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
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
  },
  tripHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingVertical: 10, marginBottom: 10 
  },
  tripHeaderText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  tripList: { gap: 10 },
  noTripText: { color: '#999', textAlign: 'center', marginVertical: 20 },
  row: { marginBottom: 16 },
  value: { fontSize: 16, color: '#333', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
});
