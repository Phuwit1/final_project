import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, FlatList, TextInput, Modal, Animated } from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState, useRef } from 'react';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const categories: { name: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }[] = [
  { name: 'อาหาร', icon: 'cutlery' },
  { name: 'เดินทาง', icon: 'bus' },
  { name: 'ช้อปปิ้ง', icon: 'shopping-bag' },
  { name: 'ที่พัก', icon: 'bed' },
];

const dummyExpenses = [
  {
    id: '1',
    category: 'ค่าอาหาร',
    creator: 'Kinny',
    amount: 2000,
    icon: 'restaurant',
  },
];

export default function TripBudgetScreen() {
  const { trip_id } = useLocalSearchParams();
  const tripName = 'เที่ยวไหนก็เที่ยว';
  const totalBudget = 5000;
  const spent = 2000;
  
  // Modal states
  const [isModalVisible, setModalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  
  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const openModal = () => {
    console.log('📌 เปิด Modal');
    setModalVisible(true);
    // รีเซ็ต animation
    translateY.setValue(0);
  };

  const closeModal = () => {
    console.log('📌 ปิด Modal');
    // Animation ปิด
    Animated.timing(translateY, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      translateY.setValue(0);
    });
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    const { translationY, velocityY, state } = event.nativeEvent;

    if (state === State.END) {
      // ถ้าเลื่อนลงเกิน 100px หรือความเร็วเกิน 500
      if (translationY > 100 || velocityY > 500) {
        closeModal();
      } else {
        // กลับไปตำแหน่งเดิม
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const handleSave = () => {
    console.log('💾 บันทึก:', { amount, description, selectedCategory });
    // รีเซ็ตฟอร์ม
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    // ปิด Modal
    closeModal();
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://picsum.photos/800/600' }}
        style={styles.headerImage}
      >
        <Text style={styles.tripName}>เที่ยวไหนก็เที่ยว</Text>

        <View style={styles.budgetRow}>
          <Text style={styles.budgetText}>งบ</Text>
          <Text style={styles.budgetAmount}> 5000 THB </Text>
          <TouchableOpacity>
            <Ionicons name="create-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <View style={styles.semiCircleWrapper}>
        <View style={styles.semiCircle}>
          <Text style={styles.spentText}>ใช้ 2000 THB</Text>
        </View>
      </View>

      <View style={styles.curvedSection}>
        <Text style={styles.sectionTitle}>ค่าใช้จ่าย</Text>

        <FlatList
          data={dummyExpenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.expenseItem}>
              <Ionicons name={item.icon as any} size={24} style={styles.expenseIcon} />
              <View style={styles.expenseDetail}>
                <Text style={styles.expenseCategory}>{item.category}</Text>
                <Text style={styles.expenseCreator}>create by {item.creator}</Text>
              </View>
              <Text style={styles.expenseAmount}>{item.amount} THB</Text>
            </View>
          )}
        />

        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Text style={styles.addButtonText}>+ เพิ่มค่าใช้จ่าย</Text>
        </TouchableOpacity>
      </View>

      {/* Modal สำหรับเพิ่มค่าใช้จ่าย */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
          >
            <Animated.View 
              style={[
                styles.modalContent,
                {
                  transform: [{ translateY: translateY }]
                }
              ]}
            >
              {/* Drag Handle */}
              <View style={styles.dragHandle} />
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>เพิ่มค่าใช้จ่าย</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="จำนวนเงิน"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                style={styles.input}
              />

              <TextInput
                placeholder="คำอธิบาย"
                value={description}
                onChangeText={setDescription}
                style={styles.input}
              />

              <Text style={styles.categoryLabel}>เลือกหมวดหมู่</Text>
              <View style={styles.categoryContainer}>
                {categories.map((cat, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.categoryItem,
                      selectedCategory === cat.name && styles.selectedCategory,
                    ]}
                    onPress={() => setSelectedCategory(cat.name)}
                  >
                    <FontAwesome name={cat.icon} size={24} color="#fff" />
                    <Text style={styles.categoryText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                  <Text style={styles.cancelButtonText}>ยกเลิก</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>💾 บันทึก</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative'
  },
  semiCircleWrapper: {
    position: 'absolute',
    top: 200,
    width: '100%',
    alignItems: 'center',
    zIndex: 0,
  },
  semiCircle: {  
    width: 450,
    height: 150,
    marginTop: 20,
    backgroundColor: 'white',
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  headerImage: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  curvedSection: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 55,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  tripName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  budgetText: {
    fontSize: 16,
    color: 'white',
  },
  budgetAmount: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  spentText: {
    marginTop: 8,
    fontSize: 16,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  expenseIcon: {
    marginRight: 12,
  },
  expenseDetail: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expenseCreator: {
    fontSize: 12,
    color: '#888',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#ff5c5c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignSelf: 'center',
    marginBottom: 55,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  input: {
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  categoryLabel: {
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  categoryItem: {
    backgroundColor: '#aaa',
    padding: 10,
    borderRadius: 50,
    alignItems: 'center',
    width: 80,
    height: 80,
    margin: 5,
    justifyContent: 'center',
  },
  selectedCategory: {
    backgroundColor: '#4CAF50',
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#ddd',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});