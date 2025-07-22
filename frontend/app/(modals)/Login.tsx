import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, TouchableOpacity, Image} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { showMessage } from 'react-native-flash-message';

import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode
} from '@react-native-google-signin/google-signin';



export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();
  const router = useRouter();

  const [termChecked, setTermChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleLogin = async () => {
  try {
    const response = await axios.post('http://192.168.1.45:8000/login', {
      email,
      password,
    });

    const { token, refresh_token } = response.data;

    await AsyncStorage.setItem('access_token', token);
    await AsyncStorage.setItem('refresh_token', refresh_token);
    
     router.push('/(tabs)/profile');
    
    } catch (err : any) {
      Alert.alert(
        'เข้าสู่ระบบไม่สำเร็จ',
        err?.response?.data?.detail || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        [{ text: 'ลองใหม่อีกครั้ง' }]
      );
    }
  };

  const handleGoogleLogin = async () => {
    Alert.alert('เข้าสู่ระบบด้วย Google');
  // try {
  //   console.log('Starting Google Sign-In...');
  //   setIsSubmitting(true);
    
  //   // ตรวจสอบ Play Services
  //   await GoogleSignin.hasPlayServices();
    
  //   const response = await GoogleSignin.signIn();
  //   console.log('Sign-in response:', response);
    
  //   if (isSuccessResponse(response)) {
  //     const { idToken, user } = response.data;
  //     const { name, email, photo } = user;

  //     console.log('Google Sign-In successful:', { name, email });

  //     router.push({
  //       pathname: '/(tabs)/profile',
  //       params: { name, email, photo, idToken }
  //     });
  //   } else {
  //     showMessage({ 
  //       message: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ', 
  //       type: 'danger' 
  //     });
  //   }
  // } catch (error) {
  //   console.error('Google Sign-In error:', error);
    
  //   if (isErrorWithCode(error)) {
  //     switch (error.code) {
  //       case statusCodes.SIGN_IN_CANCELLED:
  //         showMessage({ 
  //           message: 'ยกเลิกการเข้าสู่ระบบ', 
  //           type: 'info' 
  //         });
  //         break;
  //       case statusCodes.IN_PROGRESS:
  //         showMessage({ 
  //           message: 'กำลังเข้าสู่ระบบ...', 
  //           type: 'info' 
  //         });
  //         break;
  //       case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
  //         showMessage({ 
  //           message: 'Google Play Services ไม่พร้อมใช้งาน', 
  //           type: 'danger' 
  //         });
  //         break;
  //       default:
  //         showMessage({ 
  //           message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 
  //           type: 'danger' 
  //         });
  //     }
  //   } else {
  //     showMessage({ 
  //       message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด', 
  //       type: 'danger' 
  //     });
  //   }
  // } finally {
  //   setIsSubmitting(false);
  // }
};
   const handleRegister = () => {
     router.push('/Register');
  };


  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>เข้าสู่ระบบ</Text>
        
        <TextInput
          style={styles.input}
          placeholder="อีเมล"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="รหัสผ่าน"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        
        <View style={styles.buttonContainer}>
          <Button title="เข้าสู่ระบบ" onPress={handleLogin} />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>หรือ</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
          <View style={styles.googleButtonContent}>
            <Image 
               source={require('../../assets/images/googlelogo.png')} 
              style={styles.googleLogo}
            />
            <Text style={styles.googleButtonText}>เข้าสู่ระบบด้วย Google</Text>
          </View>
        </TouchableOpacity>

          <View style={styles.registerContainer}>
          <Text style={styles.registerText}>ยังไม่มีบัญชี? </Text>
          <TouchableOpacity onPress={handleRegister}>
            <Text style={styles.registerLink}>สร้างบัญชีใหม่</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
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
  buttonContainer: {
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
  },
  googleButton: {
    width: '100%',
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
   googleLogo: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  googleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
   googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
   registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  registerText: {
    color: '#666',
    fontSize: 16,
  },
  registerLink: {
    color: '#4285f4',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});