import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';

export default function TripListSkeleton() {
  // สร้าง Animation กะพริบจางๆ (Pulse Effect)
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim]);

  // Component ย่อยสำหรับวาดบล็อกแต่ละก้อน
  const SkeletonBlock = ({ width, height, borderRadius = 4, style }: any) => (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E2E8F0', // สีเทาอ่อน
          opacity: fadeAnim,
        },
        style,
      ]}
    />
  );

  // วาดโครงสร้างให้เหมือน TripCard ของคุณ
  const SkeletonCard = () => (
    <View style={styles.card}>
      {/* ส่วนหัว: ชื่อทริป และ ปุ่ม/สถานะ */}
      <View style={styles.header}>
        <SkeletonBlock width="60%" height={24} borderRadius={6} />
        <SkeletonBlock width={60} height={24} borderRadius={12} />
      </View>

      {/* ส่วนเนื้อหา: รูปภาพซ้าย รายละเอียดขวา */}
      <View style={styles.body}>
        <SkeletonBlock width={130} height={110} borderRadius={8} />
        <View style={styles.details}>
          <SkeletonBlock width="80%" height={14} style={{ marginBottom: 12 }} />
          <SkeletonBlock width="60%" height={14} style={{ marginBottom: 12 }} />
          <SkeletonBlock width="70%" height={14} style={{ marginBottom: 12 }} />
          <SkeletonBlock width="50%" height={14} />
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
      {/* วาดการ์ดหลอกๆ สัก 3-4 ใบเพื่อให้เต็มหน้าจอ */}
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    // เพิ่มเงาเบาๆ
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  body: {
    flexDirection: 'row',
  },
  details: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
});