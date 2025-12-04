import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Text, StyleSheet, Alert, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import { API_URL } from '@/api.js';

let globalSocket = null;

const getSocket = () => {
  if (!globalSocket) {
    globalSocket = io(API_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });
  }
  return globalSocket;
};

export default function App() {
  const [status, setStatus] = useState('Disconnected');
  const [socketId, setSocketId] = useState('');
  const [myLocation, setMyLocation] = useState(null);
  const [otherLocations, setOtherLocations] = useState({});
  
  // State สำหรับ Group
  const [groupInput, setGroupInput] = useState('');
  const [currentGroup, setCurrentGroup] = useState(null);

  const socketRef = useRef(null);
  const locationSubscription = useRef(null); // 🆕 เก็บตัว tracking

  // 1. Setup Socket
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.off('connect');
    socket.off('disconnect');
    socket.off('connect_error');
    socket.off('location_update');
    socket.off('group_locations');
    socket.off('user_left');
    socket.off('user_joined');

    socket.on('connect', () => {
        console.log("✅ Connected:", socket.id);
        setStatus('Connected');
        setSocketId(socket.id);
    });
    
    socket.on('disconnect', (reason) => {
        console.log("❌ Disconnected:", reason);
        setStatus('Disconnected');
        setSocketId('');
        setCurrentGroup(null);
        setOtherLocations({});
    });

    socket.on('connect_error', (err) => {
        setStatus(`Error: ${err.message}`);
    });

    socket.on('location_update', (data) => {
        setOtherLocations(prev => ({ ...prev, [data.sid]: data }));
    });

    socket.on('group_locations', (locations) => {
        const locMap = {};
        locations.forEach(loc => {
            if (loc.sid !== socket.id) locMap[loc.sid] = loc;
        });
        setOtherLocations(locMap);
    });

    socket.on('user_left', (data) => {
        setOtherLocations(prev => {
            const newLocs = {...prev};
            delete newLocs[data.sid];
            return newLocs;
        });
    });

    if (!socket.connected) {
        socket.connect();
    }

    return () => {
        stopLocationTracking(); // 🆕 หยุด tracking เมื่อปิดแอป
        socket.disconnect();
        socket.removeAllListeners();
    };
  }, []);

  // 2. 🆕 Auto Tracking Logic
  // ทำงานเมื่อ currentGroup เปลี่ยนแปลง (เข้า หรือ ออกกลุ่ม)
  useEffect(() => {
    if (currentGroup) {
        startLocationTracking();
    } else {
        stopLocationTracking();
    }
  }, [currentGroup]);

  // 🆕 ฟังก์ชันเริ่มดักจับพิกัด
  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission denied', 'Cannot access location');
        return;
    }

    // หยุดอันเก่าก่อน (ถ้ามี) กันซ้อน
    if (locationSubscription.current) {
        locationSubscription.current.remove();
    }

    console.log("🛰️ Starting Real-time Tracking...");

    // watchPositionAsync จะทำงานตลอดเวลาเมื่อพิกัดเปลี่ยน
    locationSubscription.current = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000, // 🆕 อัปเดตทุก 3 วินาที (ปรับตามความเหมาะสม)
            distanceInterval: 10, // 🆕 หรือเมื่อขยับเกิน 10 เมตร
        },
        (location) => {
            const payload = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                timestamp: location.timestamp
            };

            setMyLocation(payload); // อัปเดต UI ตัวเอง

            // ส่งไปหา Socket
            const socket = socketRef.current;
            if (socket && socket.connected) {
                socket.emit('update_location', payload);
                // ไม่ต้อง log ทุกครั้งก็ได้ เดี๋ยวรก console
            }
        }
    );
  };

  // 🆕 ฟังก์ชันหยุดดักจับ
  const stopLocationTracking = () => {
    if (locationSubscription.current) {
        console.log("🛑 Stopping Tracking");
        locationSubscription.current.remove();
        locationSubscription.current = null;
    }
  };

  const handleJoinGroup = () => {
    if (!groupInput.trim()) {
        Alert.alert("Error", "Please enter a Group ID");
        return;
    }
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    setOtherLocations({});

    socket.emit('join_group', { group_id: groupInput }, (response) => {
        if (response.status === 'success') {
            setCurrentGroup(response.group_id);
            // Alert.alert("Joined", `Entered group: ${response.group_id}`); // ไม่ต้อง alert ก็ได้ ดู smooth กว่า
        } else {
            Alert.alert("Error", response.message);
        }
    });
  };

  const handleLeaveGroup = () => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit('leave_group', {}, (response) => {
        if (response.status === 'success') {
            setCurrentGroup(null);
            setOtherLocations({});
            setGroupInput('');
            // stopLocationTracking จะทำงานเองผ่าน useEffect
        }
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('th-TH');
  };

  const otherUsers = Object.values(otherLocations);

  return (
      <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Real-time Group Tracker</Text>
          
          <View style={styles.statusBox}>
              <Text style={styles.label}>Status:</Text>
              <Text style={[styles.status, status === 'Connected' ? styles.online : styles.offline]}>
                  {status}
              </Text>
          </View>
          
          {/* Group UI */}
          <View style={styles.groupBox}>
            {!currentGroup ? (
                <View>
                    <Text style={styles.label}>Enter Group ID:</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="e.g. ROOM123"
                        value={groupInput}
                        onChangeText={setGroupInput}
                        autoCapitalize="characters"
                    />
                    <Button title="Join Group" onPress={handleJoinGroup} disabled={status !== 'Connected'} />
                </View>
            ) : (
                <View style={styles.activeGroup}>
                    <Text style={styles.groupTitle}>🟢 Group: {currentGroup}</Text>
                    
                    {/* 🆕 แสดงสถานะว่ากำลังส่งข้อมูล */}
                    <View style={styles.trackingBadge}>
                        <Text style={styles.trackingText}>📡 Broadcasting Location...</Text>
                    </View>

                    <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                        <Text style={styles.leaveText}>Leave Group</Text>
                    </TouchableOpacity>
                </View>
            )}
          </View>
          
          <View style={styles.divider} />

          {/* ลบปุ่ม Share Location ออกแล้ว */}
          
          {/* แสดง Location ของตัวเอง */}
          {myLocation && (
              <View style={[styles.locationBox, styles.myLocation]}>
                  <Text style={styles.boxTitle}>📍 My Location (Live)</Text>
                  <Text>Lat: {myLocation.lat.toFixed(6)}</Text>
                  <Text>Lng: {myLocation.lng.toFixed(6)}</Text>
                  <Text style={styles.timestamp}>
                      {formatTime(myLocation.timestamp)}
                  </Text>
              </View>
          )}

          {/* แสดง Location ของคนอื่นๆ */}
          {currentGroup && otherUsers.length > 0 && (
              <View style={styles.othersContainer}>
                  <Text style={styles.boxTitle}>
                      👥 Group Members ({otherUsers.length})
                  </Text>
                  
                  {otherUsers.map((loc) => (
                      <View key={loc.sid} style={styles.locationBox}>
                          <Text style={styles.userLabel}>
                              User: {loc.sid.slice(0, 8)}...
                          </Text>
                          <Text>Lat: {loc.lat?.toFixed(6)}</Text>
                          <Text>Lng: {loc.lng?.toFixed(6)}</Text>
                          <Text style={styles.timestamp}>
                              Updated: {formatTime(loc.timestamp)}
                          </Text>
                      </View>
                  ))}
              </View>
          )}

          {currentGroup && otherUsers.length === 0 && (
              <Text style={styles.noUsers}>Waiting for others...</Text>
          )}

            {!currentGroup && (
              <Text style={styles.noUsers}>Please join a group to start tracking.</Text>
          )}
          
      </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    statusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    label: {
        fontWeight: 'bold',
        marginRight: 8,
        fontSize: 16
    },
    status: { fontSize: 16, fontWeight: 'bold' },
    online: { color: 'green' },
    offline: { color: 'red' },
    
    groupBox: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
        elevation: 2,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        borderRadius: 5,
        marginBottom: 10,
        fontSize: 16,
        backgroundColor: '#fafafa'
    },
    activeGroup: { alignItems: 'center' },
    groupTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2e7d32',
        marginBottom: 10,
    },
    // 🆕 Styles สำหรับ Badge
    trackingBadge: {
        backgroundColor: '#e8f5e9',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#c8e6c9'
    },
    trackingText: {
        color: '#2e7d32',
        fontSize: 12,
        fontWeight: '600'
    },
    leaveButton: {
        backgroundColor: '#ef5350',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 5,
    },
    leaveText: { color: 'white', fontWeight: 'bold' },
    divider: {
        height: 1,
        backgroundColor: '#ddd',
        marginBottom: 20,
    },
    locationBox: {
        marginTop: 15,
        padding: 15,
        backgroundColor: 'white',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    myLocation: {
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    boxTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    userLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
        marginTop: 5,
    },
    othersContainer: {
        marginTop: 20,
        width: '100%',
    },
    noUsers: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
        fontStyle: 'italic',
    },
});
