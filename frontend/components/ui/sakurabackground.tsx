// components/SakuraBackground.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import SakuraPetal from './sakurafall';

export default function SakuraBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: 25 }).map((_, i) => (
        <SakuraPetal key={i} />
      ))}
    </View>
  );
}
