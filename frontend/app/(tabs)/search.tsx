import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Button, Text, StyleSheet, Alert, ScrollView, TextInput, TouchableOpacity, 
  ActivityIndicator, Modal, SafeAreaView, AppState 
} from 'react-native';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// เปลี่ยน path ให้ตรงกับโครงสร้างโปรเจคของคุณ
import { API_URL, WEBSOCKET_URL } from '@/api.js'; 

let globalSocket: any = null;

const getSocket = () => {
    if (!globalSocket) {
        globalSocket = io(WEBSOCKET_URL, {
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
    const [status, setStatus] = useState<string>('Disconnected');
    const [socketId, setSocketId] = useState<string>('');
    const [myLocation, setMyLocation] = useState<any>(null);
    const [otherLocations, setOtherLocations] = useState<any>({});
    const [groupInput, setGroupInput] = useState<string>('');
    const [usernameInput, setUsernameInput] = useState<string>('');
    const [currentGroup, setCurrentGroup] = useState<any>(null);
    const [myUsername, setMyUsername] = useState<string>('');
    const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);
    const [hasCenteredOnOpen, setHasCenteredOnOpen] = useState<boolean>(false);

    const [isMapVisible, setIsMapVisible] = useState<boolean>(false);

    // ใช้ any กับ ref ทั้งหมด
    const socketRef = useRef<any>(null);
    const locationSubscription = useRef<any>(null);
    const mapRef = useRef<any>(null);

    // 🔥 ป้องกัน Map ค้างหลังกลับ foreground
    useEffect(() => {
        const sub = AppState.addEventListener("change", (state: any) => {
            if (state === "active" && myLocation && mapRef.current) {
                mapRef.current.animateCamera({
                    center: {
                        latitude: myLocation.lat,
                        longitude: myLocation.lng
                    },
                    zoom: 16
                });
            }
        });
        return () => sub.remove();
    }, [myLocation]);

    useFocusEffect(
        useCallback(() => {
            const fetchUserProfile = async () => {
                setIsLoadingUser(true);
                try {
                    const token = await AsyncStorage.getItem('access_token');
                    if (!token) {
                        Alert.alert('Error', 'Token not found. Please login again.');
                        setIsLoadingUser(false);
                        return;
                    }
                    const res: any = await axios.get(`${API_URL}/user`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.data) {
                        setUsernameInput(res.data.first_name + " " + res.data.last_name);
                    }
                } catch (err: any) {
                    console.error("Fetch user error:", err);
                } finally {
                    setIsLoadingUser(false);
                }
            };
            fetchUserProfile();
        }, [])
    );

    useEffect(() => {
        const socket = getSocket();
        socketRef.current = socket;

        socket.on('connect', () => { setStatus('Connected'); setSocketId(socket.id); });
        socket.on('disconnect', () => { setStatus('Disconnected'); setSocketId(''); setCurrentGroup(null); setOtherLocations({}); });
        socket.on('connect_error', (err: any) => { setStatus(`Error: ${err.message}`); });

        socket.on('location_update', (data: any) => 
            setOtherLocations((prev: any) => ({ ...prev, [data.sid]: data }))
        );

        socket.on('group_locations', (locations: any) => {
            const locMap: any = {};
            locations.forEach((loc: any) => { if (loc.sid !== socket.id) locMap[loc.sid] = loc; });
            setOtherLocations(locMap);
        });

        socket.on('user_left', (data: any) => {
            setOtherLocations((prev: any) => {
                const newLocs = { ...prev };
                delete newLocs[data.sid];
                return newLocs;
            });
        });

        if (!socket.connected) socket.connect();

        return () => {
            stopLocationTracking();
            socket.disconnect();
            socket.removeAllListeners();
        };
    }, []);

    useEffect(() => {
        if (currentGroup) startLocationTracking();
        else stopLocationTracking();
    }, [currentGroup]);

    // รีเซ็ตตอนแมพถูกเปิดใหม่
    useEffect(() => {
        if (isMapVisible) {
            setHasCenteredOnOpen(false);  // อนุญาตให้ camera เลื่อนตอนเปิดครั้งนี้
        }
    }, [isMapVisible]);

    // 🔥 กล้องเลื่อนเฉพาะตอนแมพถูกเปิดครั้งแรก
    useEffect(() => {
        if (
            isMapVisible &&
            myLocation &&
            mapRef.current &&
            !hasCenteredOnOpen        // <-- เช็คว่าทำครั้งแรกเท่านั้น
        ) {
            mapRef.current.animateCamera(
                {
                    center: {
                        latitude: myLocation.lat,
                        longitude: myLocation.lng,
                    },
                    zoom: 17,
                },
                { duration: 600 }
            );

            setHasCenteredOnOpen(true);   // หลังจากเลื่อนแล้ว → ไม่ให้เลื่อนอีก
        }
    }, [isMapVisible, myLocation]);

    const startLocationTracking = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationSubscription.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
            (location: any) => {
                const payload = {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    timestamp: location.timestamp
                };
                setMyLocation(payload);

                const socket = socketRef.current;
                if (socket && socket.connected) socket.emit('update_location', payload);
            }
        );
    };

    const stopLocationTracking = () => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };

    const handleJoinGroup = () => {
        if (!groupInput.trim() || !usernameInput.trim()) return;

        const socket = socketRef.current;
        if (!socket || !socket.connected) return;

        setOtherLocations({});
        socket.emit('join_group', { group_id: groupInput, username: usernameInput }, (response: any) => {
            if (response.status === 'success') {
                setCurrentGroup(response.group_id);
                setMyUsername(response.username);
            } else {
                Alert.alert("Error", response.message);
            }
        });
    };

    const handleLeaveGroup = () => {
        const socket = socketRef.current;
        if (socket) socket.emit('leave_group', {});
        setCurrentGroup(null);
        setMyUsername('');
        setOtherLocations({});
        setGroupInput('');
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('th-TH');
    };

    const otherUsers: any[] = Object.values(otherLocations);

    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>📍 Group Tracker</Text>

                <View style={styles.statusBox}>
                    <Text style={styles.label}>Status:</Text>
                    <Text style={[styles.status, status === 'Connected' ? styles.online : styles.offline]}>
                        {status}
                    </Text>
                </View>

                <View style={styles.groupBox}>
                    {isLoadingUser && !currentGroup ? (
                        <ActivityIndicator size="large" color="#2e7d32" />
                    ) : !currentGroup ? (
                        <View>
                            <Text style={styles.label}>Identity:</Text>
                            <View style={styles.readOnlyInput}>
                                <Text style={styles.readOnlyText}>👤 {usernameInput || 'Unknown User'}</Text>
                            </View>
                            <Text style={styles.label}>Group ID:</Text>
                            <TextInput 
                                style={styles.input}
                                placeholder="e.g. ROOM1"
                                value={groupInput}
                                onChangeText={setGroupInput}
                                autoCapitalize="characters"
                            />
                            <Button title="Join Group" onPress={handleJoinGroup} />
                        </View>
                    ) : (
                        <View style={styles.activeGroup}>
                            <Text style={styles.groupTitle}>🟢 Room: {currentGroup}</Text>
                            <Text style={styles.userInfo}>👤 You are: {myUsername}</Text>

                            <View style={styles.trackingBadge}>
                                <Text style={styles.trackingText}>📡 Broadcasting Location...</Text>
                            </View>

                            {/* ปุ่มเปิดแผนที่ */}
                            <TouchableOpacity 
                                style={styles.mapButton} 
                                onPress={() => setIsMapVisible(true)}
                            >
                                <Text style={styles.mapButtonText}>🗺️ Open Map</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                                <Text style={styles.leaveText}>Leave Group</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Location list below */}
                <View style={styles.divider} />

                {myLocation && (
                    <View style={[styles.locationBox, styles.myLocation]}>
                        <Text style={styles.boxTitle}>📍 My Location</Text>
                        <Text>Lat: {myLocation.lat.toFixed(6)}, Lng: {myLocation.lng.toFixed(6)}</Text>
                    </View>
                )}

                {currentGroup && otherUsers.length > 0 && (
                    <View style={styles.othersContainer}>
                        <Text style={styles.boxTitle}>👥 Friends Nearby ({otherUsers.length})</Text>
                        {otherUsers.map((loc: any) => (
                            <View key={loc.sid} style={styles.locationBox}>
                                <Text style={styles.userLabel}>👤 {loc.username}</Text>
                                <Text>Lat: {loc.lat?.toFixed(6)}, Lng: {loc.lng?.toFixed(6)}</Text>
                                <Text style={styles.timestamp}>{formatTime(loc.timestamp)}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* 🔥 Map Modal ที่ไม่ unmount MapView */}
            <Modal visible={isMapVisible} animationType="slide">
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.mapHeader}>
                        <TouchableOpacity 
                            onPress={() => setIsMapVisible(false)}
                            style={styles.closeMapButton}
                        >
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Close</Text>
                        </TouchableOpacity>

                        <Text style={styles.mapTitle}>🗺️ Live Map ({currentGroup})</Text>
                    </View>

                    {/* 🔥 Map ไม่ถูก unmount */}
                    <View style={{ flex: 1, display: isMapVisible ? "flex" : "none" }}>
                        <MapView
                            ref={mapRef}
                            provider={PROVIDER_GOOGLE}
                            style={styles.map}
                            showsMyLocationButton={true}
                            showsCompass={true}
                            toolbarEnabled={true}
                            showsUserLocation={true}

                            // ป้องกัน bug ตอน switch background
                            renderToHardwareTextureAndroid={true}
                            liteMode={false}
                            cacheEnabled={false}

                            initialRegion={myLocation ? {
                                latitude: myLocation.lat,
                                longitude: myLocation.lng,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            } : undefined}
                        >
                            
                            {/* Marker ของเรา */}
                            {myLocation && (
                                <Marker
                                    key={"me"}
                                    coordinate={{
                                        latitude: myLocation.lat,
                                        longitude: myLocation.lng
                                    }}
                                    title="You"
                                    pinColor="blue"
                                />
                            )}

                            {/* Marker เพื่อนๆ */}
                            {otherUsers.map((user: any) => (
                                <Marker
                                    key={user.sid}
                                    coordinate={{
                                        latitude: Number(user.lat),
                                        longitude: Number(user.lng)
                                    }}
                                    title={user.username}
                                    description={formatTime(user.timestamp)}
                                    pinColor="orange"
                                />
                            ))}

                        </MapView>
                    </View>

                    <View style={styles.mapFooter}>
                        <Text>Status: {myLocation ? "Tracking Active 🟢" : "Finding Location..."}</Text>
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, paddingTop: 60, backgroundColor: '#f5f5f5' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    statusBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    label: { fontWeight: '600', marginBottom: 5 },
    status: { fontSize: 16, fontWeight: 'bold', marginLeft: 5 },
    online: { color: 'green' },
    offline: { color: 'red' },

    groupBox: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 4 },
    readOnlyInput: { padding: 12, borderRadius: 8, marginBottom: 15, backgroundColor: '#e3f2fd', borderWidth: 1, borderColor: '#bbdefb' },
    readOnlyText: { fontSize: 16, color: '#0d47a1', fontWeight: 'bold' },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 15, backgroundColor: '#fafafa' },

    activeGroup: { alignItems: 'center' },
    groupTitle: { fontSize: 20, fontWeight: 'bold', color: '#2e7d32', marginBottom: 5 },
    userInfo: { fontSize: 16, color: '#555', marginBottom: 10 },
    trackingBadge: { backgroundColor: '#e8f5e9', padding: 6, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#c8e6c9', marginBottom: 15 },
    trackingText: { color: '#2e7d32', fontSize: 12 },

    mapButton: { backgroundColor: '#2196F3', padding: 12, paddingHorizontal: 30, borderRadius: 8, marginBottom: 15, width: '100%', alignItems: 'center' },
    mapButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    leaveButton: { backgroundColor: '#ff5252', padding: 10, paddingHorizontal: 25, borderRadius: 8 },
    leaveText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    divider: { height: 1, backgroundColor: '#ddd', marginVertical: 20 },

    locationBox: { padding: 15, backgroundColor: 'white', borderRadius: 10, marginTop: 15 },
    myLocation: { borderLeftWidth: 5, borderLeftColor: '#2196F3', backgroundColor: '#E3F2FD' },
    boxTitle: { fontSize: 16, fontWeight: 'bold' },
    userLabel: { fontSize: 16, fontWeight: 'bold', color: '#1565C0' },
    timestamp: { fontSize: 12, color: '#555', marginTop: 5 },
    othersContainer: { marginTop: 10, paddingBottom: 40 },

    map: { flex: 1, width: "100%" },
    mapHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#ddd' },
    closeMapButton: { backgroundColor: '#444', padding: 8, borderRadius: 5, marginRight: 10 },
    mapTitle: { fontSize: 18, fontWeight: 'bold' },
    mapFooter: { padding: 10, backgroundColor: 'white', alignItems: 'center' }
});
