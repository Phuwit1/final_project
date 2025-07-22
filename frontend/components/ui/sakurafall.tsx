import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SakuraPetal() {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(Math.random() * width)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const startFalling = () => {
    translateY.setValue(-50);
    translateX.setValue(Math.random() * width);
    rotate.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height + 50,
        duration: 8000 + Math.random() * 4000,
        // delay: Math.random() * 3000, // staggered start
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 1,
        duration: 8000 + Math.random() * 4000,
        useNativeDriver: true,
      }),
    ]).start(() => startFalling()); // infinite loop
  };

  useEffect(() => {
    startFalling();
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.Image
      source={require('@/assets/images/sakura.png')}
      style={[
        styles.petal,
        {
          transform: [
            { translateY },
            { translateX },
            { rotate: rotateInterpolate },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  petal: {
    position: 'absolute',
    width: 24,
    height: 24,
    opacity: 0.7,
  },
});
