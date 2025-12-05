import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, Alert, Image, SafeAreaView 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js'; 
import * as Clipboard from 'expo-clipboard';

export default function MemberScreen() {
  const { trip_id } = useLocalSearchParams(); // รับ planId มาจาก router
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [tripGroup, setTripGroup] = useState<any>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [trip_id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      // 1. หา User ปัจจุบัน (เพื่อเช็คว่าเป็น Owner ไหม)
      const userRes = await axios.get(`${API_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUserEmail(userRes.data.email);

      // 2. ดึงข้อมูล Plan เพื่อหา Group ID
      const planRes = await axios.get(`${API_URL}/trip_plan/${trip_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const realTripId = planRes.data.trip_id;

      if (realTripId) {
        // 3. ดึงข้อมูลกลุ่มและสมาชิก
        const groupRes = await axios.get(`${API_URL}/trip_group/${realTripId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTripGroup(groupRes.data);
        
        // จัด Format สมาชิก
        setMembers(groupRes.data.members || []);
      }

    } catch (e) {
      console.error("Error fetching members:", e);
      Alert.alert("Error", "ไม่สามารถโหลดข้อมูลสมาชิกได้");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (tripGroup?.uniqueCode) {
      await Clipboard.setStringAsync(tripGroup.uniqueCode);
      Alert.alert("Copied", "คัดลอกรหัสเชิญเรียบร้อยแล้ว");
    }
  };

  // ✅ ฟังก์ชันลบสมาชิก (เชื่อมต่อ API จริงแล้ว)
  const handleRemoveMember = (memberId: number, name: string) => {
    Alert.alert("ยืนยัน", `ต้องการลบ ${name} ออกจากกลุ่มใช่หรือไม่?`, [
      { text: "ยกเลิก", style: "cancel" },
      { 
        text: "ลบ", 
        style: "destructive",
        onPress: async () => {
            try {
                const token = await AsyncStorage.getItem('access_token');
                if (!token || !tripGroup?.trip_id) return;

                // เรียก API ลบสมาชิก
                await axios.delete(`${API_URL}/trip_group/${tripGroup.trip_id}/members/${memberId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // อัปเดตรายการสมาชิกในหน้าจอทันที (ลบออกจาก state)
                setMembers(prev => prev.filter(m => m.group_member_id !== memberId));
                
                Alert.alert("สำเร็จ", `ลบ ${name} ออกจากกลุ่มเรียบร้อยแล้ว`);

            } catch (error) {
                console.error("Remove member error:", error);
                Alert.alert("ผิดพลาด", "ไม่สามารถลบสมาชิกได้");
            }
        }
      }
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert("ออกจากกลุ่ม", "คุณแน่ใจหรือไม่ที่จะออกจากทริปนี้?", [
      { text: "ยกเลิก", style: "cancel" },
      { 
        text: "ออกจากกลุ่ม", 
        style: "destructive",
        onPress: async () => {
            try {
                const token = await AsyncStorage.getItem('access_token');
                if (!token || !tripGroup?.trip_id) return;

                // เรียก API Leave Group
                await axios.delete(`${API_URL}/trip_group/${tripGroup.trip_id}/leave`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                Alert.alert("สำเร็จ", "คุณได้ออกจากกลุ่มเรียบร้อยแล้ว");
                // กลับไปหน้า My Trip
                router.replace('/(tabs)/mytrip');

            } catch (error) {
                console.error("Leave group error:", error);
                Alert.alert("ผิดพลาด", "ไม่สามารถออกจากกลุ่มได้");
            }
        }
      }
    ]);
  };

  const isOwner = tripGroup?.owner?.email === currentUserEmail;

  const renderItem = ({ item }: { item: any }) => {
    const user = item.customer;
    const isMe = user.email === currentUserEmail;
    const isMemberOwner = tripGroup?.owner_id === user.customer_id;

    return (
      <View style={styles.memberCard}>
        <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                    {user.first_name?.[0]?.toUpperCase() || "?"}
                </Text>
            </View>
        </View>
        
        <View style={styles.infoContainer}>
            <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                <Text style={styles.name}>
                    {user.first_name} {user.last_name} {isMe && "(ฉัน)"}
                </Text>
                {isMemberOwner && (
                    <View style={styles.ownerBadge}>
                        <Text style={styles.ownerText}>หัวหน้า</Text>
                    </View>
                )}
            </View>
            <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* ปุ่มลบ (แสดงเฉพาะถ้าเราเป็น Owner และไม่ได้ลบตัวเอง) */}
        {isOwner && !isMemberOwner && (
            <TouchableOpacity onPress={() => handleRemoveMember(item.group_member_id, user.first_name)}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FFA500" />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>สมาชิกในทริป</Text>
        <View style={{width: 24}} /> 
      </View>

      {/* Invite Code Section */}
      {tripGroup && (
          <View style={styles.inviteCard}>
            <View>
                <Text style={styles.inviteLabel}>รหัสเชิญเพื่อน (Invite Code)</Text>
                <Text style={styles.inviteCode}>{tripGroup.uniqueCode}</Text>
            </View>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                <Ionicons name="copy-outline" size={20} color="white" />
                <Text style={styles.copyText}>คัดลอก</Text>
            </TouchableOpacity>
          </View>
      )}

      {/* Member List */}
      <Text style={styles.sectionTitle}>รายชื่อสมาชิก ({members.length})</Text>
      
      <FlatList
          data={members}
          keyExtractor={(item) => item.group_member_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }} // เผื่อที่ให้ปุ่มด้านล่าง
          ListEmptyComponent={
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>ยังไม่มีสมาชิกในกลุ่ม</Text>
            </View>
          }
      />

      {/* ✅ ปุ่มออกจากกลุ่ม (แสดงเฉพาะถ้าไม่ใช่ Owner) */}
      {!isOwner && (
        <View style={styles.footer}>
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
                <Text style={styles.leaveButtonText}>ออกจากกลุ่ม</Text>
            </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    alignItems: 'center', justifyContent: 'space-between',
    padding: 16,borderBottomWidth: 1, borderColor: '#EEE'
  },
  backButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: 'bold' },
  
  inviteCard: {
    margin: 16, padding: 16, backgroundColor: 'white', borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  inviteLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  inviteCode: { fontSize: 20, fontWeight: 'bold', color: '#333', letterSpacing: 1 },
  copyButton: { 
    flexDirection: 'row', backgroundColor: '#007AFF', paddingVertical: 8, paddingHorizontal: 12, 
    borderRadius: 8, alignItems: 'center', gap: 4 
  },
  copyText: { color: 'white', fontSize: 14, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#666', marginLeft: 16, marginBottom: 8 },
  
  memberCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    padding: 12, marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
    borderWidth: 1, borderColor: '#EEE'
  },
  avatarContainer: { marginRight: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E0E0',
    justifyContent: 'center', alignItems: 'center'
  },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#666' },
  
  infoContainer: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#333' },
  email: { fontSize: 14, color: '#888' },
  
  ownerBadge: {
    backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginLeft: 6
  },
  ownerText: { fontSize: 10, fontWeight: 'bold', color: '#333' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#999', fontSize: 16 },

  footer: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20,
  },
  leaveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF0F0', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 30, borderWidth: 1, borderColor: '#FF3B30',
    width: '100%', gap: 8
  },
  leaveButtonText: {
    color: '#FF3B30', fontSize: 16, fontWeight: 'bold'
  }
});