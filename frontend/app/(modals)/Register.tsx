import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, ScrollView, TouchableOpacity, Platform, Image  } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '@/api.js'
import { LinearGradient } from 'expo-linear-gradient';

export default function RegisterScreen({ navigation } : { navigation: any }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
    birth_date: new Date(), // ค่าเริ่มต้นเป็นวันนี้
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const router = useRouter();
  

  const handleRegister = async () => {

    if (!form.first_name || !form.last_name || !form.email || !form.password || !form.phone_number || !form.birth_date) {
      Alert.alert('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    if (form.phone_number.length !== 10) {
        Alert.alert('เบอร์โทรต้องมี 10 หลัก');
        return;
      }

    try {
      const payload = {
        ...form,
        birth_date: form.birth_date.toISOString().split('T')[0], // ส่งเป็น YYYY-MM-DD
      };

      // const response = await axios.post('http://192.168.1.45:8000/register', payload);
      const response = await axios.post(`${API_URL}/register`, payload);
     
      Alert.alert(
        'สมัครสมาชิกสำเร็จ!',
        `ยินดีต้อนรับคุณ ${form.first_name}`,
        [
          { text: 'ไปหน้าเข้าสู่ระบบ', onPress: () => router.push('/Login') }
        ]
      );

    } catch (err: any) {
      Alert.alert(
        'เกิดข้อผิดพลาด',
        err?.response?.data?.detail || 'ไม่สามารถสมัครสมาชิกได้',
        [{ text: 'ตกลง' }]
      );
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setForm({ ...form, birth_date: selectedDate });
    }
  };


  const handleBackToLogin = () => {
     router.push('/Login');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <Image 
          source={require('../../assets/images/adaptive-icon.png')}
          style={styles.tabigologo}
          ></Image>
          <Text style={styles.title}>สมัครสมาชิก</Text>
          <TextInput
            style={styles.input}
            placeholder="ชื่อ"
            value={form.first_name}
            onChangeText={(text) => setForm({ ...form, first_name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="นามสกุล"
            value={form.last_name}
            onChangeText={(text) => setForm({ ...form, last_name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="อีเมล"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
          />

           <TextInput
            style={styles.input}
            placeholder="เบอร์โทรศัพท์"
            keyboardType="phone-pad"
            value={form.phone_number}
            onChangeText={(text) => setForm({ ...form, phone_number: text })}
          />

          {/* วันที่ */}
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateInput}>
            <Text style={styles.dateText}>
              วันเกิด: {form.birth_date.toLocaleDateString('th-TH')}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={form.birth_date}
              mode="date"
              display={Platform.OS === 'android' ? 'calendar' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="รหัสผ่าน"
            secureTextEntry
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
          />

          <TouchableOpacity onPress={handleRegister} style={styles.buttonContainer} >
            <LinearGradient  
              colors={['#fc8c54ff', '#FF5E62']}          
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}  
              style={styles.gradientButton}
             >
              <Text style={styles.buttonText}>สร้างบัญชี</Text>
            </LinearGradient>
          </TouchableOpacity>

            <View style={styles.loginContainer}>
            <Text style={styles.loginText}>มีบัญชีอยู่แล้ว? </Text>
            <TouchableOpacity onPress={handleBackToLogin}>
              <Text style={styles.loginLink}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>

    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  dateInput: {
    width: '100%',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderColor: '#ddd',
    borderWidth: 1,
  },
  dateText: { fontSize: 16, color: '#333' },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: 10,
    marginBottom: 20,
  },
  gradientButton: {
    padding: 15,
    alignItems: 'center',
    borderRadius: 16, // ทำมุมโค้งมน
    width: '100%',    // หรือกำหนดความกว้างที่ต้องการ
  },
  buttonText: {
    backgroundColor: 'transparent',
    fontSize: 18,
    color: '#fff', // ตัวหนังสือสีขาว
    fontWeight: 'bold',
  },
  tabigologo :{
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#666',
    fontSize: 16,
  },
  loginLink: {
    color: '#fc9a4fff',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
