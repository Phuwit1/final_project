import React from 'react';
import { View, Button, StyleSheet, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

export default function HomeScreen() {
  const db = useSQLiteContext();

  // 1. ฟังก์ชันสำหรับเพิ่มข้อมูล (Insert) - เหมือนเดิม
  const addTrip = async () => {
    try {
      await db.runAsync(
        `INSERT INTO TripPlan (name_group, creator_id, start_plan_date, end_plan_date, day_of_trip) 
         VALUES (?, ?, ?, ?, ?)`,
        ['hihihi', 1, '2025-12-01', '2025-12-07', 7]
      );
      Alert.alert('Success', 'เพิ่มข้อมูลทริปเรียบร้อยแล้ว!');
    } catch (error) {
      console.error('Error adding trip:', error);
      Alert.alert('Error', 'ไม่สามารถเพิ่มข้อมูลได้');
    }
  };

  // 2. ฟังก์ชันดึงข้อมูล TripPlan
  const logTrips = async () => {
    try {
      const allRows = await db.getAllAsync('SELECT * FROM TripPlan');
      console.log('--- [TripPlan] รายชื่อทริปทั้งหมด ---');
      console.log(JSON.stringify(allRows, null, 2));
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  // 3. ฟังก์ชันดึงข้อมูล TripSchedule (เพิ่มใหม่)
  const logSchedules = async () => {
    try {
      const allRows = await db.getAllAsync('SELECT * FROM TripSchedule');
      
      console.log('--- [TripSchedule] ข้อมูลแผนการเดินทาง ---');
      
      // วนลูปเพื่อ parse JSON ในคอลัมน์ payload ให้กลับมาเป็น Object ก่อนพิมพ์
      const formattedData = allRows.map((row: any) => ({
        ...row,
        payload: JSON.parse(row.payload) // แปลงจาก string กลับเป็น array/object
      }));

      console.log(JSON.stringify(formattedData, null, 2));

      if (allRows.length === 0) {
        console.log('ยังไม่มีข้อมูลในตาราง TripSchedule');
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      Alert.alert('Error', 'ไม่สามารถดึงข้อมูล Schedule ได้ (อาจยังไม่มีการ Download)');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonWrapper}>
        <Button title="1. Add Trip" onPress={addTrip} color="#4CAF50"/>
      </View>
      
      <View style={styles.buttonWrapper}>
        <Button title="2. Log TripPlan" onPress={logTrips} color="#2196F3" />
      </View>

      {/* เพิ่มปุ่มใหม่ตรงนี้ */}
      <View style={styles.buttonWrapper}>
        <Button title="3. Log TripSchedule" onPress={logSchedules} color="#FF9800" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10
  },
  buttonWrapper: {
    width: '100%',
    marginVertical: 5
  }
});
