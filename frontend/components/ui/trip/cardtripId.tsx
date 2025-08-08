import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

interface TripCardProps {
  name: string;
  date: string;
  duration: string;
  status: 'On Trip' | 'Upcoming' | 'Trip Ended';
  people: number;
  image: string;
  budget?: number; // เพิ่ม budget แบบ optional
  tripId?: string; // สำหรับส่ง id ไปหน้า budget ถ้าต้องใช้
}

const TripCardID: React.FC<TripCardProps> = ({name, date, duration, status, people, image, budget = 0, tripId,}) => {
    const navigation = useNavigation<any>();
    const router = useRouter();
    console.log('tripId from props:', tripId);
    const [isPressed, setIsPressed] = useState(false);


    const goToBudget = () => {
      router.push(`/trip/${tripId}/budget`); // ให้คุณตั้งชื่อหน้านี้ไว้ใน navigation
    };

    const handleCreateGroup = () => {
    console.log('สร้างกลุ่มสำหรับ Trip ID:', tripId);
    // เรียก API หรือไปหน้า Create Group ได้เลย
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.tripName}>{name}</Text>
         <TouchableOpacity
            style={[
              styles.createGroupButton,
              isPressed && styles.createGroupButtonPressed,
            ]}
            onPressIn={() => setIsPressed(true)}
            onPressOut={() => {
              setIsPressed(false);
              handleCreateGroup();
            }}
          >
            <Text
              style={[
                styles.createGroupText,
                isPressed && styles.createGroupTextPressed,
              ]}
            >
              + สร้างกลุ่ม
            </Text>
          </TouchableOpacity>
      </View>

      <View style={styles.imageRow}>
        <Image source={{ uri: image }} style={styles.image} />
        <View style={styles.details}>
          <Text style={styles.detailText}>วันที่ {date}</Text>
          <Text style={styles.detailText}>{duration}</Text>
          <Text style={styles.detailText}>{people} คน</Text>
          <View style={styles.budgetRow}>
            <Text style={styles.detailText}>💰 Budget: ฿{budget}</Text>
            <TouchableOpacity style={styles.budgetButton} onPress={goToBudget}>
                <Text style={styles.budgetText}>✏️</Text>
            </TouchableOpacity>
            </View>

           
        </View>
        
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
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
    width: 130,
    height: 80,
    backgroundColor: '#ccc',
    borderRadius: 8,
  },
  details: {
    flex: 1,
    marginLeft: 12,
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
budgetButton: {
  marginLeft: 8,
  backgroundColor: '#f0f0f0',
  paddingVertical: 2,
  paddingHorizontal: 6,
  borderRadius: 6,
},
  budgetText: {
    fontSize: 14,
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
});

export default TripCardID;
