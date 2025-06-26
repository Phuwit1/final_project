import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function TopBar() {
  return (
    <View style={styles.container}>
     
      <View style={styles.topBar}>
        <Image
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  topBar: {
    height: 45,
    backgroundColor: '#fff', 
    marginTop: 20,
    justifyContent: 'flex-start',
    elevation: 3, 
    shadowColor: '#000', 
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  logo: {
    height: 40,
    width: 120,
    borderRadius: 10,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
