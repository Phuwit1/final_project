import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';

export default function ProfileSkeleton() {
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

  // Component ย่อยสำหรับก้อน Skeleton แต่ละอัน
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

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SkeletonBlock width={150} height={28} borderRadius={8} />
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        {/* Avatar */}
        <SkeletonBlock width={110} height={110} borderRadius={55} style={styles.avatar} />
        
        {/* Name */}
        <SkeletonBlock width={180} height={24} style={styles.centerBlock} />
        
        {/* Join Date */}
        <SkeletonBlock width={120} height={14} style={[styles.centerBlock, { marginTop: 10, marginBottom: 20 }]} />

        {/* Section Title */}
        <SkeletonBlock width={100} height={20} style={{ marginTop: 16, marginBottom: 12 }} />

        {/* Contact Info: Email */}
        <View style={styles.inputGroup}>
          <SkeletonBlock width={50} height={14} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={'70%'} height={18} />
        </View>

        {/* Contact Info: Phone */}
        <View style={styles.inputGroup}>
          <SkeletonBlock width={80} height={14} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={'50%'} height={18} />
        </View>

        {/* Contact Info: Birth Date */}
        <View style={styles.row}>
          <SkeletonBlock width={60} height={14} style={{ marginBottom: 6 }} />
          <SkeletonBlock width={'60%'} height={18} style={{ marginBottom: 8 }} />
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#eee', marginTop: 4 }} />
        </View>
      </View>

      {/* Trip Section */}
      <View style={styles.tripSection}>
        <View style={styles.tripHeader}>
          <SkeletonBlock width={140} height={20} />
          <SkeletonBlock width={20} height={20} borderRadius={10} />
        </View>

        {/* Trip Card Skeletons */}
        <View style={styles.tripList}>
          <SkeletonBlock width={'100%'} height={100} borderRadius={12} style={{ marginBottom: 10 }} />
          <SkeletonBlock width={'100%'} height={100} borderRadius={12} />
        </View>
      </View>

      {/* Logout Button Skeleton */}
      <SkeletonBlock width={'100%'} height={50} borderRadius={25} style={{ marginTop: 30, marginBottom: 40 }} />
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdff',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 15,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatar: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  centerBlock: {
    alignSelf: 'center',
    marginBottom: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    marginBottom: 16,
  },
  tripSection: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  tripList: {
    gap: 10,
  },
});