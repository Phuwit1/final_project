// import React from 'react';
// import { Button, Alert } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import axios from 'axios';

// interface LogoutButtonProps {
//   onLogoutSuccess: () => void;
// }

// export default function LogoutButton({ onLogoutSuccess }: LogoutButtonProps) {
//   const logout = async () => {
//     try {
//       const token = await AsyncStorage.getItem('access_token');
//       if (!token) {
//         Alert.alert('Not logged in');
//         return;
//       }

//       const res = await axios.post(
//         'http://127.0.0.1:8000/logout',
//         {},
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (res.status === 200) {
//         await AsyncStorage.removeItem('access_token');
//         await AsyncStorage.removeItem('refresh_token');
//         Alert.alert('Logout successful');
//         onLogoutSuccess();
//       }
//     } catch (error: any) {
//       Alert.alert('Logout failed', error.response?.data?.detail || error.message);
//     }
//   };

//   return <Button title="Logout" onPress={logout} />;
// }


import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { API_URL } from '@/api.js'
import { GoogleSignin } from '@react-native-google-signin/google-signin';

interface LogoutButtonProps {
  onLogoutSuccess?: () => void;
}

export default function LogoutButton({ onLogoutSuccess }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      try {
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser) {
          await GoogleSignin.signOut();
          console.log("Google Sign-Out Successful");
        }
      } catch (error) {
        console.error("Google Sign-Out Error:", error);
        // ไม่ throw error เพื่อให้ process อื่นทำงานต่อได้
      }
      
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('No token found');

      // เรียก API logout backend
      await axios.post(`${API_URL}/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // ลบ token
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');

      Alert.alert('ออกจากระบบ', 'คุณได้ออกจากระบบเรียบร้อยแล้ว');
      if (onLogoutSuccess) onLogoutSuccess();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถออกจากระบบได้ ลองอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.logoutButton, loading && { opacity: 0.7 }]}
      onPress={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={styles.logoutButtonText}>🚪 ออกจากระบบ</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    backgroundColor: '#E94B3C',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    marginVertical: 20,
    alignSelf: 'center',
    shadowColor: '#E94B3C',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
