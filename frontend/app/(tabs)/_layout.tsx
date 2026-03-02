import { Link, Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Image } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import JoinTripModal from '../(modals)/join-trip';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

const CustomHeaderTitle = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Image 
      source={require('../../assets/images/icon.png')} 
      style={{ width: 30, height: 30, borderRadius: 15, marginRight: 3 }} 
      resizeMode="contain"
    />
    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f03f3fff' }}>
      TabiGo
    </Text>
  </View>
);

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <>
    <BottomSheetModalProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FF6B6B', 
          tabBarInactiveTintColor: '#999',
          tabBarActiveBackgroundColor: '#FF9EAE',  
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
           tabBarItemStyle: {
            borderRadius: 18,
            marginHorizontal: 6,
          },
          tabBarStyle: Platform.select({
              ios: {
                position: 'absolute',
                height: 78,
                paddingBottom: 20,
              },
              default: {
                height: 70,
                paddingTop: 10,
              },
            }),

        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeBackground]}>
               <IconSymbol size={28} name="house.fill" color={color} />
            </View>
          ),
          }}
          listeners={{
            tabPress: () => setOpen(false),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeBackground]}>
               <IconSymbol size={28} name="magnifyingglass" color={color} />
            </View>
            ),
            headerShown: true,
            headerTitle: () => <CustomHeaderTitle />,

        }}
          listeners={{
            tabPress: () => setOpen(false),
          }}
        />
       <Tabs.Screen
          name="add_place"
          options={{
            title: 'Create', 
            tabBarIcon: ({ color }) => (
              <Ionicons 
                name={open ? "close-circle" : "add-circle"} 
                size={30}
                color={open ? "#FF6B6B" : color}
              />
            ),
            tabBarLabel: ({ color }) => (
              <Text style={{ 
                fontSize: 10, 
                fontWeight: '500',
                textAlign: 'center',
                color: open ? "#FF9EAE" : color 
              }}>
                Create
              </Text>
            ),
          }}
          listeners={{
             tabPress: (e) => {
               e.preventDefault(); 
               setOpen(!open);    
             },
           }}
        />
        <Tabs.Screen
          name="mytrip"
          options={{
            title: 'Trip',
            tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeBackground]}>
               <IconSymbol size={28} name="suitcase.fill" color={color} />
            </View>
            ),
         
          }}
          listeners={{
            tabPress: () => setOpen(false),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeBackground]}>
               <IconSymbol size={28} name="person.fill" color={color} />
            </View>
            ),         
           }}
          listeners={{
            tabPress: () => setOpen(false),
          }}
        />

        <Tabs.Screen
          name="test"
          options={{
            href: null,
            title: 'test',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            headerShown: false,
          }}
        />
      
        
      </Tabs>

      {open && (
        <View style={styles.menuContainer}>
           {/* ปุ่มซ้าย: Create Trip */}
          <Link href="/trip/after-create" asChild>
            <TouchableOpacity style={styles.actionButtonLeft} onPress={() => setOpen(false)}>
              <Ionicons name="create-outline" size={20} color="white" />
              <Text style={styles.actionText}>Create Trip</Text>
            </TouchableOpacity>
          </Link>

          {/* ปุ่มขวา: Join Trip */}
          <View>
              <TouchableOpacity onPress={() => setShowJoinModal(true)} style={styles.actionButtonRight}>
                  <Ionicons name="people-outline" size={20} color="white" />
                  <Text style={styles.actionText}>Join Trip</Text>
              </TouchableOpacity>

              {/* แปะ Modal ไว้ล่างสุด */}
              {showJoinModal && (
                  <JoinTripModal 
                    isVisible={showJoinModal} 
                    onClose={() => setShowJoinModal(false)} 
                  />
              )}
            </View>
        </View>
      )}
    </BottomSheetModalProvider>

    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 30, // ยกสูงขึ้นจากขอบล่าง (ปรับตามความสวยงามและ TabBar height)
    left: '50%', // กึ่งกลางแนวนอน
    transform: [{ translateX: -30 }], // เลื่อนกลับครึ่งหนึ่งของความกว้าง (60/2 = 30) เพื่อให้กลางเป๊ะ
    alignItems: 'center',
    zIndex: 10, // ให้อยู่เหนือ TabBar
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B', // สีปุ่มหลัก
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 32,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 70, // อยู่เหนือปุ่มหลักขึ้นไป
    flexDirection: 'row',
    gap: 20, // ระยะห่างระหว่างปุ่มซ้ายขวา
    alignItems: 'center',
    justifyContent: 'center',
    width: 200, // กำหนดความกว้างเพื่อให้จัดกึ่งกลางได้
    transform: [{ translateX: 0 }], // (ไม่ต้องเลื่อนแล้วเพราะ container กลางอยู่แล้ว)
  },
  
  // สไตล์ปุ่มลูก (Create / Join)
  actionButtonLeft: {
    backgroundColor: '#c25700', // สีเขียว
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: "#000", shadowOffset: {width:0, height:2}, shadowOpacity:0.25, elevation:5
  },
  actionButtonRight: {
    backgroundColor: '#FF6B6B', // สีฟ้า
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: "#000", shadowOffset: {width:0, height:2}, shadowOpacity:0.25, elevation:5
  },
  actionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  menuContainer: {
    position: 'absolute',
    bottom: 90, // ปรับความสูงตามต้องการ (ให้อยู่เหนือ Tab Bar)
    alignSelf: 'center', // จัดกึ่งกลางจอ
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconContainer: {
    width: 50,  // กำหนดความกว้างพื้นที่รอบๆ
    height: 35, // กำหนดความสูง
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20, // ทำมุมมน (ให้เป็นวงรี)
  },
  activeBackground: {
    backgroundColor: '#FFE5EA', // 🌸 สีชมพูอ่อนๆ (Sakura Pink Light)
  },
});
