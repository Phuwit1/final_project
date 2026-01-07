import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity 
} from 'react-native';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { WEBSOCKET_URL } from '@/api.js';

// Singleton Socket
let globalSocket: any = null;
const getSocket = () => {
    if (!globalSocket) {
        globalSocket = io(WEBSOCKET_URL, {
            transports: ['websocket'],
            autoConnect: false,
            reconnection: true,
        });
    }
    return globalSocket;
};

type Props = {
    groupCode: string;
    userId: number;
    userName: string;
    onClose: () => void;
};

export default function MemberLocationMap({ groupCode, userId, userName, onClose }: Props) {
    const [myLocation, setMyLocation] = useState<any>(null);
    const [othersLocations, setOthersLocations] = useState<any>({});
    const [status, setStatus] = useState('Connecting...');
    const mapRef = useRef<MapView>(null);
    const locationSubscription = useRef<any>(null);

    useEffect(() => {
        if (!groupCode) return;
        startTracking();
        return () => stopTracking();
    }, [groupCode]);

    const startTracking = async () => {
        // 1. ขอ Permission
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'กรุณาเปิด Location เพื่อใช้งาน');
            return;
        }

        // 2. เชื่อมต่อ Socket
        const socket = getSocket();
        if (!socket.connected) socket.connect();

        // ✅ 1. แก้ชื่อ Event เป็น 'join_group' และส่ง key 'group_id'
        // (ตามไฟล์ get_location.py)
        socket.emit('join_group', { 
            group_id: groupCode, 
            username: userName 
        });
        setStatus(`Online: ${groupCode}`);

        // ✅ 2. แก้ชื่อ Event ที่รอรับเป็น 'location_update'
        socket.on('location_update', (data: any) => {
            // Backend ส่งกลับมาเป็น: { sid, username, lat, lng, timestamp }
            // เราใช้ sid เป็น unique key แทน user_id
            
            setOthersLocations((prev: any) => ({
                ...prev,
                [data.sid]: { // ใช้ sid เป็น key
                    latitude: data.lat,   // Map lat -> latitude
                    longitude: data.lng, // Map lng -> longitude
                    username: data.username,
                    timestamp: data.timestamp
                }
            }));
        });

        // 3. เริ่มส่งตำแหน่งตัวเอง
        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000, 
                distanceInterval: 10, 
            },
            (loc) => {
                const { latitude, longitude } = loc.coords;
                setMyLocation({ latitude, longitude });

                // ✅ 3. แก้ชื่อ Event ส่งเป็น 'update_location' และส่ง key 'lat', 'lng'
                socket.emit('update_location', {
                    lat: latitude, 
                    lng: longitude,
                    timestamp: new Date().toISOString()
                    // ไม่ต้องส่ง group_id เพราะ backend จำจาก session (user_groups) ได้แล้ว
                    // แต่ถ้า Backend หลุดอาจต้อง join ใหม่ (ใน get_location.py เช็ค sid in user_groups)
                });
            }
        );
    };

    const stopTracking = () => {
        if (locationSubscription.current) locationSubscription.current.remove();
        const socket = getSocket();
        
        socket.off('location_update'); // ✅ ปิด listener ตัวใหม่
        
        // ✅ ส่ง event ออกกลุ่ม (ถ้าจำเป็น)
        socket.emit('leave_group', { group_id: groupCode });
    };

    const focusAllMarkers = () => {
        if (!mapRef.current || !myLocation) return;
        
        const markers = [
            myLocation,
            ...Object.values(othersLocations).map((l: any) => ({ latitude: l.latitude, longitude: l.longitude }))
        ];

        if (markers.length > 1) {
            mapRef.current.fitToCoordinates(markers, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        } else {
             // ถ้ามีแค่เราคนเดียว ให้ซูมไปที่ตัวเรา
             mapRef.current.animateToRegion({
                ...myLocation,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01
             });
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerOverlay}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>ติดตามเพื่อน ({Object.keys(othersLocations).length})</Text>
                    <Text style={styles.headerSub}>Group: {groupCode}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            </View>

            {/* Map */}
            {myLocation ? (
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: myLocation.latitude,
                        longitude: myLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                >
                    {/* Marker ของเพื่อน */}
                    {Object.entries(othersLocations).map(([sid, loc]: any) => (
                        <Marker
                            key={sid}
                            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                            title={loc.username || 'Friend'}
                            description={loc.timestamp ? `อัปเดต: ${new Date(loc.timestamp).toLocaleTimeString()}` : ''}
                        >
                            <View style={styles.customMarker}>
                                <Ionicons name="person" size={16} color="white" />
                            </View>
                            
                            <Callout>
                                <View style={styles.calloutView}>
                                    <Text style={styles.calloutTitle}>{loc.username}</Text>
                                </View>
                            </Callout>
                        </Marker>
                    ))}
                </MapView>
            ) : (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                    <Text style={styles.loadingText}>กำลังระบุตำแหน่ง...</Text>
                </View>
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={focusAllMarkers}>
                <Ionicons name="locate" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    map: { width: '100%', height: '100%' },
    headerOverlay: {
        position: 'absolute', top: 50, left: 20, right: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12, padding: 12,
        flexDirection: 'row', alignItems: 'center',
        zIndex: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 5
    },
    closeBtn: { padding: 8, marginRight: 8 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    headerSub: { fontSize: 12, color: '#666' },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
    customMarker: {
        backgroundColor: '#FF6B6B', padding: 8, borderRadius: 20,
        borderWidth: 2, borderColor: 'white', elevation: 5
    },
    calloutView: { padding: 4, alignItems: 'center' },
    calloutTitle: { fontWeight: 'bold', fontSize: 14 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: '#666' },
    fab: {
        position: 'absolute', bottom: 40, right: 20,
        backgroundColor: '#007AFF', width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center', elevation: 6
    }
});