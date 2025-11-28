import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function JoinTripModal() {
  const router = useRouter();
  const params = useLocalSearchParams(); // รับค่าจาก Deep Link
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [tripDetails, setTripDetails] = useState<any>(null);

  // ถ้ามี Code ส่งมาทาง Link ให้โหลดทันที
  useEffect(() => {
    if (params.code) {
      setCode(params.code as string);
      fetchTripDetails(params.code as string);
    }
  }, [params.code]);

  // Step 1: ค้นหากลุ่ม
  const fetchTripDetails = async (searchCode: string) => {
    if (!searchCode) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      // ⚠️ เปลี่ยน IP เป็นของเครื่องคุณ
      const response = await axios.get(
        `http://192.168.1.45:8000/trip_group/code/${searchCode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTripDetails(response.data);
      setStep('preview'); // ไปหน้า Preview
    } catch (error) {
      Alert.alert("Error", "ไม่พบกลุ่ม หรือ รหัสไม่ถูกต้อง");
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: ยืนยันการเข้าร่วม
  const handleConfirmJoin = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `http://192.168.1.45:8000/trip_group/join`,
        { unique_code: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Success", "เข้าร่วมกลุ่มสำเร็จ!", [
        { text: "OK", onPress: () => router.replace('/(tabs)/mytrip') }
      ]);
    } catch (error) {
      Alert.alert("Error", "ไม่สามารถเข้าร่วมกลุ่มได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
           <Text style={styles.title}>เข้าร่วมทริป</Text>
           <TouchableOpacity onPress={() => router.back()}>
             <Ionicons name="close" size={24} color="#666" />
           </TouchableOpacity>
        </View>

        {step === 'input' ? (
          // --- หน้ากรอก Code ---
          <View>
            <Text style={styles.label}>กรอกรหัสกลุ่ม (Invite Code)</Text>
            <TextInput 
              style={styles.input}
              placeholder="Ex. A1B2C3D4"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => fetchTripDetails(code)}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>ค้นหากลุ่ม</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          // --- หน้าแสดงรายละเอียด (Preview) ---
          <View>
            <View style={styles.previewContainer}>
              <View style={styles.iconContainer}>
                 <Ionicons name="airplane" size={40} color="#FFA500" />
              </View>
              <Text style={styles.tripName}>{tripDetails?.name_group}</Text>
              <Text style={styles.ownerText}>โดย: {tripDetails?.owner_name}</Text>
              
              <View style={styles.divider} />
              
              <View style={styles.row}>
                 <Ionicons name="people-outline" size={16} color="#666" />
                 <Text style={styles.detailText}> สมาชิก {tripDetails?.member_count} คน</Text>
              </View>
              <View style={styles.row}>
                 <Ionicons name="calendar-outline" size={16} color="#666" />
                 <Text style={styles.detailText}> {new Date(tripDetails?.start_date).toLocaleDateString()} - {new Date(tripDetails?.end_date).toLocaleDateString()}</Text>
              </View>

              {tripDetails?.is_member ? (
                 <Text style={styles.alreadyMemberText}>คุณเป็นสมาชิกกลุ่มนี้แล้ว</Text>
              ) : null}
            </View>

            <TouchableOpacity 
              style={[styles.button, tripDetails?.is_member && styles.disabledButton]} 
              onPress={handleConfirmJoin}
              disabled={loading || tripDetails?.is_member}
            >
               {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>{tripDetails?.is_member ? "เข้าร่วมแล้ว" : "ยืนยันการเข้าร่วม"}</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setStep('input')} style={styles.backButton}>
                <Text style={styles.backButtonText}>กลับไปค้นหาใหม่</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  card: { width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 20, elevation: 5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 14, color: '#666', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 18, textAlign: 'center', marginBottom: 20, backgroundColor: '#f9f9f9' },
  button: { backgroundColor: '#FFA500', padding: 15, borderRadius: 10, alignItems: 'center' },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  // Preview Styles
  previewContainer: { alignItems: 'center', marginBottom: 20 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF5E0', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  tripName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  ownerText: { color: '#888', marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  detailText: { marginLeft: 8, color: '#444' },
  alreadyMemberText: { color: 'green', fontWeight: 'bold', marginTop: 10 },
  backButton: { marginTop: 15, alignItems: 'center' },
  backButtonText: { color: '#666' }
});