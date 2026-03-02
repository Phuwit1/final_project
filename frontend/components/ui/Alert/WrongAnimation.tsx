
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

interface WrongAnimationProps {
  size?: number;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function WrongAnimation({ 
  size = 100, 
  loop = false, 
  style 
}: WrongAnimationProps) {
  return (
    <LottieView
      source={require('@/assets/images/alert/wrong.json')} // เปลี่ยน path ให้ตรงกับที่เก็บไฟล์จริง
      autoPlay
      loop={loop}
      style={[{ width: size, height: size }, style]}
    />
  );
}