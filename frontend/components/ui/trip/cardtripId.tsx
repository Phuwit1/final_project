import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share, Alert, ActivityIndicator, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard'; // ต้องลง: npx expo install expo-clipboard
import * as Linking from 'expo-linking'; 
// import API function ของคุณ (สมมติว่าใช้ axios หรือ fetch)
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; // สมมติว่าเก็บ token ไว้ที่นี่
import { API_URL } from '@/api.js'

interface TripCardProps {
  name: string;
  date: string;
  duration: string;
  status: 'On Trip' | 'Upcoming' | 'Trip Ended';
  people: number;
  image: string;
  budget?: number; // เพิ่ม budget แบบ optional
  planId?: string; // สำหรับส่ง id ไปหน้า budget ถ้าต้องใช้
  tripId?: string;
  groupcode?: string;
  onGroupCreated?: (newGroupData: any) => void;
}

const TripCardID: React.FC<TripCardProps> = ({name, date, duration, status, people, image, budget = 0, planId,tripId ,onGroupCreated}) => {
    const navigation = useNavigation<any>();
    const router = useRouter();
    console.log('planId from props:', planId);
    console.log('tripId from props:', tripId);
    const [isPressed, setIsPressed] = useState(false);

    const [loading, setLoading] = useState(false);
    const [groupCode, setGroupCode] = useState<string | null>(null);
    const hasGroup = !!tripId || !!groupCode;
    console.log("groupCode group:", groupCode);
    const [isShareModalVisible, setShareModalVisible] = useState(false);
    const goToBudget = () => {
      router.push(`/trip/${planId}/budget`); // ให้คุณตั้งชื่อหน้านี้ไว้ใน navigation
    };

    const goToMember = () => {
      router.push(`/trip/${planId}/member`); // ให้คุณตั้งชื่อหน้านี้ไว้ใน navigation
    };

    const handleCopyCode = async () => {
    if (groupCode) {
      await Clipboard.setStringAsync(groupCode);
      Alert.alert("Copied", "Invite code copied to clipboard!");
    }
    };
    const handleCopyLink = async () => {
    if (groupCode) {
      // สร้าง Deep Link (เช่น myapp://join-trip?code=XYZ)
      const redirectUrl = Linking.createURL('join-trip', {
        queryParams: { code: groupCode },
      });
      await Clipboard.setStringAsync(redirectUrl);
      Alert.alert("Copied", "Invite link copied to clipboard!");
    }
  };

    const handleShareSystem = async () => {
      if (!groupCode) return;
      const redirectUrl = Linking.createURL('join-trip', {
        queryParams: { code: groupCode },
      });
      try {
        await Share.share({
          message: `Join my trip "${name}" on Japan Planner!\nCode: ${groupCode}\nLink: ${redirectUrl}`,
        });
      } catch (error: any) {
        Alert.alert(error.message);
      }
    };

    const handleCreateGroup = async () => {
    setLoading(true);
    try {
        const token = await AsyncStorage.getItem('access_token');// ดึง Token
        console.log("👉 Sending Token:", token);
        // เปลี่ยน URL ตาม IP เครื่องคุณ
        const response = await axios.post(
            `${API_URL}/trip_group/create_from_plan/${planId}`, 
            {}, 
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const newGroup = response.data;
        setGroupCode(newGroup.uniqueCode);
        
        Alert.alert("Success", "Trip Group Created Successfully!");
        
        if (onGroupCreated) {
            onGroupCreated(newGroup);
        }

    } catch (error) {
        console.error(error);
        Alert.alert("Error", "Failed to create group.");
    } finally {
        setLoading(false);
    }
  };

  const onSharePress = async () => {
    // ถ้าเพิ่งสร้างเสร็จมี groupCode อยู่แล้วก็เปิดเลย
    if (groupCode) {
      setShareModalVisible(true);
      return;
    }

    // ถ้ามี tripId (เป็นกลุ่มอยู่แล้ว) แต่ยังไม่มี code ใน state -> ต้องไป fetch มาก่อน
    if (tripId) {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('access_token');
            const res = await axios.get(`${API_URL}/trip_group/${tripId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroupCode(res.data.uniqueCode);
            setShareModalVisible(true);
        } catch (e) {
            console.error("Fetch group error", e);
            Alert.alert("Error", "ไม่สามารถดึงข้อมูลกลุ่มได้");
        } finally {
            setLoading(false);
        }
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.tripName}>{name}</Text>
         {!hasGroup ? (
          <TouchableOpacity
            style={styles.createGroupButton}
            onPress={handleCreateGroup}
            disabled={loading}
          >
            {loading ? (
                <ActivityIndicator size="small" color="#FFA500" />
            ) : (
                <Text style={styles.createGroupText}>+ สร้างกลุ่ม</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={onSharePress}
            disabled={loading}
          >
             <Ionicons name="share-social-outline" size={20} color="#007AFF" />
             <Text style={styles.shareButtonText}>แชร์</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.imageRow}>
        <Image source={{ uri: image }} style={styles.image} />
        <View style={styles.details}>
          <Text style={styles.detailText}>วันที่ {date}</Text>
          <Text style={styles.detailText}>{duration}</Text>
          <View style={styles.budgetRow}>
            <Text style={styles.detailText}>จำนวนเงิน: ฿{budget}</Text>
            <TouchableOpacity style={styles.budgetButton} onPress={goToBudget}>
                <Text style={styles.budgetText}>✏️</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.memberRow}>
            <Text style={styles.detailText}>สมาชิก : {people} คน</Text>
            <TouchableOpacity style={styles.memberButton} onPress={goToMember}>
                  <Text style={styles.budgetText}>✏️</Text>
            </TouchableOpacity>
          </View>
          
   
        </View>
        
      </View>

      <Modal
        visible={isShareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>เชิญเพื่อนร่วมทริป</Text>
                <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Invite Code</Text>
            <TouchableOpacity style={styles.copyBox} onPress={handleCopyCode}>
                <Text style={styles.codeText}>{loading ? "Loading..." : (groupCode || "No Code")}</Text>
                <Ionicons name="copy-outline" size={20} color="#666" />
            </TouchableOpacity>

            <Text style={styles.label}>Invite Link</Text>
            <TouchableOpacity style={styles.copyBox} onPress={handleCopyLink}>
                <Text style={styles.linkText} numberOfLines={1}>
                    myapp://join-trip?code={groupCode}
                </Text>
                <Ionicons name="link-outline" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.mainShareButton} onPress={handleShareSystem}>
                <Ionicons name="share-outline" size={20} color="white" />
                <Text style={styles.mainShareText}>แชร์ผ่านแอปอื่น</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#ffffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#ffffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tripName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 14,
    color: '#555',
  },
  imageRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  image: {
    width: 150,
    height: 110,
    backgroundColor: '#ccc',
    borderRadius: 8,
  },
  details: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'space-around',
  },
  detailText: {
    fontSize: 14,
    color: '#444',
  },
  budgetRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},
memberRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 4,
},
memberButton: {
  marginLeft: 5,
  backgroundColor: '#f0f0f0',
  paddingVertical: 2,
  paddingHorizontal: 6,
  borderRadius: 6,
},

budgetButton: {
  marginLeft: 8,
  backgroundColor: '#f0f0f0',
  paddingVertical: 2,
  paddingHorizontal: 6,
  borderRadius: 6,
},
  budgetText: {
    fontSize: 10,
    color: '#333',
  },
    createGroupButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  createGroupButtonPressed: {
    backgroundColor: '#e0e0e0',
  },
  createGroupText: {
    fontSize: 14,
    color: '#FFA500',
    fontWeight: '500',
  },
  createGroupTextPressed: {
    color: '#cc8400',
  },
  shareButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, 
    borderRadius: 6, backgroundColor: '#E3F2FD', gap: 4
  },
  shareButtonText: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  label: { fontSize: 14, color: '#666', marginBottom: 6, marginTop: 10 },
  copyBox: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EEE'
  },
  codeText: { fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#333' },
  linkText: { fontSize: 14, color: '#007AFF', flex: 1, marginRight: 10 },
  mainShareButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#28a745', padding: 12, borderRadius: 8, marginTop: 24, gap: 8
  },
  mainShareText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});


export default TripCardID;
