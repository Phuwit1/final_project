import React from 'react';
import { View, Text, StyleSheet, Image, Switch } from 'react-native';

interface TripCardProps {
  name: string;
  city: string;
  date: string;
  duration: string;
  status: 'On Trip' | 'Upcoming' | 'Trip Ended';
  people: number;
  image: string;
}

const TripCard: React.FC<TripCardProps> = ({name,city,date,duration,status,people,image,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.tripName}>{name}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>

      <Text style={styles.city}>{city}</Text>

      <View style={styles.imageRow}>
        <Image source={{ uri: image }} style={styles.image} />
        <View style={styles.details}>
          <Text style={styles.detailText}>วันที่ {date}</Text>
          <Text style={styles.detailText}>{duration}</Text>
          <Text style={styles.detailText}>{people} คน</Text>
          <View style={styles.peopleRow}>
            
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
  city: {
    marginVertical: 4,
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
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  peopleText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

export default TripCard;
