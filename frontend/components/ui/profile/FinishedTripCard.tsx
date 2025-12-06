import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FinishedTripCardProps = {
  name: string;
  date: string;
  budget: number;
  people: number;
  city?: string; // ทำให้เป็น optional เผื่อไม่มีข้อมูลเมือง
};

export default function FinishedTripCard({ name, date, budget, people, city }: FinishedTripCardProps) {
  return (
    <View style={styles.card}>
      {/* ส่วนหัว: ชื่อทริป และ เมือง */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        {city && (
          <View style={styles.cityBadge}>
            <Ionicons name="location-sharp" size={10} color="#666" />
            <Text style={styles.cityText}>{city}</Text>
          </View>
        )}
      </View>

      {/* วันที่เดินทาง */}
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={14} color="#6b7280" />
        <Text style={styles.date}>{date}</Text>
      </View>
      
      {/* ข้อมูลเงินและคน */}
      <View style={styles.metaContainer}>
        <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>งบประมาณ</Text>
            <Text style={styles.metaValue}>฿{budget.toLocaleString()}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>จำนวนคน</Text>
            <Text style={styles.metaValue}>{people} คน</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // เพิ่มเงาเล็กน้อยให้นูนขึ้นมา
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  cityText: {
    fontSize: 10,
    color: '#4b5563',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  date: {
    fontSize: 12,
    color: '#6b7280',
  },
  metaContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff', // พื้นหลังสีขาวในกล่องข้อมูล
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    alignItems: 'center',
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  metaDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e5e7eb',
  },
});