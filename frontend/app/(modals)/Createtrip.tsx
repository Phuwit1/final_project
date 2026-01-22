import React, { useState } from 'react';
import { View, Text, TextInput, Button, Platform, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { API_URL } from '@/api.js'
import * as ImagePicker from 'expo-image-picker';

const CLOUD_NAME = "dqghrasqe"; 
const UPLOAD_PRESET = "TabiGo";

const CreateTripScreen = () => {
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState<{show: boolean; mode: 'start' | 'end'}>({show: false, mode: 'start'});
  const [imageUri, setImageUri] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0,0,0,0); // ตัดเวลาออก เพื่อเช็คแค่วัน

  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`; // e.g. "2025-08-14"
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ต้องการสิทธิ์', 'ขอสิทธิ์เข้าถึงคลังภาพเพื่อเลือกรูปปก');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [16, 9], 
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
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
    return json.secure_url; // ส่งคืน URL
  };


  const onChangeDate = (event: any, selectedDate: Date | undefined) => {
    setShowPicker({ show: false, mode: showPicker.mode });
    if (selectedDate) {
      const selectedDay = new Date(selectedDate);
      selectedDay.setHours(0,0,0,0);

      if (selectedDay < today) {
        Alert.alert('ไม่สามารถเลือกวันในอดีตได้');
        return;
      }

      if (showPicker.mode === 'start') {
    
        setStartDate(selectedDay);
        if (selectedDay > endDate) {
          setEndDate(selectedDay);
        }
      } else {
        if (selectedDay < startDate) {
          Alert.alert('วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น');
          return;
        }
        setEndDate(selectedDay);
      }
    }
  };

  const handleCreateTrip = async () => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      Alert.alert('กรุณาเข้าสู่ระบบใหม่');
      return;
    }

    let coverImageUrl = null;

    if (imageUri) {
        try {
          coverImageUrl = await uploadToCloudinary(imageUri);
          console.log("Uploaded Image:", coverImageUrl);
        } catch (uploadErr) {
          console.error("Cloudinary Error:", uploadErr);
          Alert.alert("อัปโหลดรูปไม่สำเร็จ", "จะสร้างทริปโดยไม่มีรูปปกแทน");
        }
      }

    const payload = {
      name_group: tripName,
      start_plan_date: toYMD(startDate),
      end_plan_date: toYMD(endDate),
      image: coverImageUrl,   
    };
    console.log("Payload for create trip:", payload)
    const res = await axios.post(`${API_URL}/trip_plan`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    

    // Alert.alert('สร้างทริปสำเร็จ', `รหัสกลุ่ม: ${res.data.uniqueCode}`);
    router.push('/(tabs)/mytrip'); 
  } catch (err: any) {
    console.error('Create trip error:', err.response?.data || err.message);
    Alert.alert('ผิดพลาด', 'ไม่สามารถสร้างทริปได้');
  }
};
  return (
    <View style={styles.container}>

      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.imagePreview} />
        ) : (
          <View style={styles.imagePlaceholder}>
             <Text style={styles.imagePlaceholderText}>+ เพิ่มรูปปกทริป</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Trip Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter trip name"
        value={tripName}
        onChangeText={setTripName}
      />

      <Text style={styles.label}>Start Date</Text>
      <TouchableOpacity onPress={() => setShowPicker({show: true, mode: 'start'})} style={styles.dateButton}>
        <Text style={styles.dateText}>{startDate.toDateString()}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>End Date</Text>
      <TouchableOpacity onPress={() => setShowPicker({show: true, mode: 'end'})} style={styles.dateButton}>
        <Text style={styles.dateText}>{endDate.toDateString()}</Text>
      </TouchableOpacity>

      {showPicker.show && (
        <DateTimePicker
          value={showPicker.mode === 'start' ? startDate : endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onChangeDate}
          minimumDate={today}  // บังคับเลือกวัน >= วันนี้
        />
      )}

      <Button title="Create Trip" onPress={handleCreateTrip} disabled={!tripName} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    flex: 1,
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 8,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
  },
  imagePicker: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CreateTripScreen;
