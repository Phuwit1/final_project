import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, Alert, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { API_URL } from '@/api.js'
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
    tripData: any;
    planId: number;
}

type DisplayItem = {
  schedule_id: number;
  hhmm: string;           // "HH:mm"
  activity: string;
  description: string;
};

type DailyData = {
  day: number;            // 1-based
  dateISO: string;        // 'YYYY-MM-DD'
  items: DisplayItem[];   // เรียงเวลาแล้ว
};


export default function DownloadTripButton({ tripData, planId }: Props) {
  const db = useSQLiteContext();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
        const token = await AsyncStorage.getItem('access_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const url = `${API_URL}/trip_schedule/${planId}`;
        const res = await axios.get(url, { headers, timeout: 30000 });
        const tripSchedule = res.data?.payload;

        const packed: DailyData[] = tripSchedule.itinerary.map((day: any, idx: number) => {
            const items: DisplayItem[] = (day.schedule ?? []).map((s: any, i: number) => ({
                schedule_id: `${idx}-${i}`, // ไม่มี id จริง เอา index ทำ key
                hhmm: s.time,
                activity: s.activity,
                description: s.specific_location_name ?? "",
            }));

            return {
                day: idx + 1,
                dateISO: day.date,
                items,
            };
        });
        console.log(packed)

      // 1. บันทึกลงตาราง TripPlan
      await db.runAsync(
        `INSERT OR REPLACE INTO TripPlan (plan_id, name_group, creator_id, start_plan_date, end_plan_date, day_of_trip) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tripData.plan_id, 
          tripData.name_group, 
          tripData.creator_id, 
          tripData.start_plan_date, 
          tripData.end_plan_date, 
          tripData.day_of_trip || 0
        ]
      );

      // 2. บันทึกลงตาราง Schedule
         await db.runAsync(
           `INSERT OR REPLACE INTO TripSchedule (plan_id, payload) VALUES (?, ?)`,
           [tripData.plan_id, JSON.stringify(packed)]
         );

      Alert.alert('สำเร็จ', 'บันทึกข้อมูลทริปไว้ดูออฟไลน์เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Download Error:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลลงเครื่องได้');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <TouchableOpacity 
      onPress={handleDownload} 
      disabled={isDownloading}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 8, borderRadius: 8 }}
    >
      {isDownloading ? (
        <ActivityIndicator size="small" color="#f03f3f" />
      ) : (
        <>
          <Ionicons name="cloud-download-outline" size={20} color="#f03f3f" />
          <Text style={{ marginLeft: 5, color: '#f03f3f', fontWeight: 'bold' }}>Offline</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
