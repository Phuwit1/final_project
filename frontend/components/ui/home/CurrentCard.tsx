// components/WelcomeCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'react-native';

// type CurrentCardProps = {
//     trip?: string;
//     image?: any;
// }

//{trip = 'Currenttrip', image}: CurrentCardProps

export default function CurrentCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardText}>ทริปล่าสุด</Text>
      <View style={styles.info}> 
        <Image
            source={require('@/assets/images/home/fuji-view.jpg')}
            style={styles.cardImage}
        />
        <View>
            <Text style={styles.cardText}>ทริปที่ 1</Text>
            <Text>วันที่ 1-2</Text>
            <Text>สถานที่: ฟูจิ</Text>
        </View>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    width: '80%',
    height: '50%',
    padding: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  info :{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardImage: {
    width: 150,
    height: 100,
    borderRadius: 10,
  },
  cardText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
