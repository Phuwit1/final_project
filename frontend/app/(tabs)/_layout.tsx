import { Link, Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
    <BottomSheetModalProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              // Use a transparent background on iOS to show the blur effect
              position: 'absolute',
            },
            default: {},
          }),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
          }}
        />
        <Tabs.Screen
          name="mytrip"
          options={{
            title: 'Trip',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="suitcase.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          }}
        />
      
        
      </Tabs>

      <View style={styles.fabContainer}>
        {open && (
          <View style={styles.actionButtons}>
            <Link href="/trip/after-create" asChild>
              <TouchableOpacity style={styles.actionButtonLeft}>
                <Text style={styles.actionText}>Create Trip</Text>
              </TouchableOpacity>
            </Link>
            <TouchableOpacity 
              style={styles.actionButtonRight}
              onPress={() => {
                setOpen(false); // ปิดเมนู
                router.push('/(modals)/join-trip'); // เปิดหน้า Join Trip (Popup)
              }}
            >
              <Text style={styles.actionText}>Join Trip</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setOpen(!open)}
        >
          <Text style={styles.fabIcon}>{open ? '×' : '+'}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModalProvider>

    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1e90ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 32,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    width: '80%',
  },
  actionButtonLeft: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionButtonRight: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionText: {
    color: '#1e90ff',
    fontWeight: 'bold',
  },
});


// import React, { useRef, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Animated,
//   Pressable,
//   Dimensions,
// } from 'react-native';
// import { Tabs } from 'expo-router';
// import { IconSymbol } from '@/components/ui/IconSymbol';
// import { Colors } from '@/constants/Colors';
// import { useColorScheme } from '@/hooks/useColorScheme';

// const { width, height } = Dimensions.get('window');

// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   const [open, setOpen] = useState(false);
//   const animation = useRef(new Animated.Value(0)).current;

//   const toggleFab = () => {
//     const toValue = open ? 0 : 1;
//     setOpen(!open);
//     Animated.timing(animation, {
//       toValue,
//       duration: 300,
//       useNativeDriver: true,
//     }).start();
//   };

//   const backdropOpacity = animation.interpolate({
//     inputRange: [0, 1],
//     outputRange: [0, 0.5],
//   });

//   const buttonTranslate = animation.interpolate({
//     inputRange: [0, 1],
//     outputRange: [20, 0],
//   });

//   return (
//     <>
//       <Tabs
//         screenOptions={{
//           headerShown: false,
//           tabBarShowLabel: false,
//           tabBarStyle: {
//             height: 60,
//             position: 'absolute',
//           },
//         }}
//       >
//         <Tabs.Screen
//           name="index"
//           options={{
//             title: 'Home',
//             tabBarIcon: ({ color }) => (
//               <IconSymbol name="house.fill" size={28} color={color} />
//             ),
//           }}
//         />
//         <Tabs.Screen
//           name="explore"
//           options={{
//             title: 'Explore',
//             tabBarIcon: ({ color }) => (
//               <IconSymbol name="paperplane.fill" size={28} color={color} />
//             ),
//           }}
//         />
//         <Tabs.Screen name="blank" options={{ href: null }} />
//       </Tabs>

//       {/* BACKDROP */}
//       {open && (
//         <Pressable style={StyleSheet.absoluteFill} onPress={toggleFab}>
//           <Animated.View
//             style={[
//               styles.backdrop,
//               { opacity: backdropOpacity },
//             ]}
//           />
//         </Pressable>
//       )}

//       {/* FAB and Actions */}
//       <View style={styles.fabContainer}>
//         <Animated.View
//           style={[
//             styles.actionButtons,
//             {
//               opacity: animation,
//               transform: [{ translateY: buttonTranslate }],
//             },
//           ]}
//         >
//           <TouchableOpacity style={styles.actionButtonLeft}>
//             <Text style={styles.actionText}>Create Trip</Text>
//           </TouchableOpacity>
//           <TouchableOpacity style={styles.actionButtonRight}>
//             <Text style={styles.actionText}>Join Trip</Text>
//           </TouchableOpacity>
//         </Animated.View>

//         <TouchableOpacity style={styles.fab} onPress={toggleFab}>
//           <Text style={styles.fabIcon}>{open ? '×' : '+'}</Text>
//         </TouchableOpacity>
//       </View>
//     </>
//   );
// }
// const styles = StyleSheet.create({
//   fabContainer: {
//     position: 'absolute',
//     bottom: 30,
//     left: 0,
//     right: 0,
//     alignItems: 'center',
//     justifyContent: 'center',
//     zIndex: 20,
//   },
//   backdrop: {
//     backgroundColor: '#000',
//     ...StyleSheet.absoluteFillObject,
//     zIndex: 10,
//   },
//   fab: {
//     width: 60,
//     height: 60,
//     borderRadius: 30,
//     backgroundColor: '#1e90ff',
//     justifyContent: 'center',
//     alignItems: 'center',
//     zIndex: 20,
//   },
//   fabIcon: {
//     color: '#fff',
//     fontSize: 32,
//   },
//   actionButtons: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 12,
//     width: '80%',
//   },
//   actionButtonLeft: {
//     backgroundColor: '#fff',
//     paddingVertical: 8,
//     paddingHorizontal: 16,
//     borderRadius: 20,
//     shadowColor: '#000',
//     shadowOpacity: 0.2,
//     shadowOffset: { width: 0, height: 2 },
//     elevation: 2,
//   },
//   actionButtonRight: {
//     backgroundColor: '#fff',
//     paddingVertical: 8,
//     paddingHorizontal: 16,
//     borderRadius: 20,
//     shadowColor: '#000',
//     shadowOpacity: 0.2,
//     shadowOffset: { width: 0, height: 2 },
//     elevation: 2,
//   },
//   actionText: {
//     color: '#1e90ff',
//     fontWeight: 'bold',
//   },
// });
