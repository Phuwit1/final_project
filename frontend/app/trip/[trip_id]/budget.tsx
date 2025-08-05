import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, FlatList, TextInput, Modal, Animated } from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const categories: { name: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }[] = [
  { name: 'อาหาร', icon: 'cutlery' },
  { name: 'เดินทาง', icon: 'bus' },
  { name: 'ช้อปปิ้ง', icon: 'shopping-bag' },
  { name: 'ที่พัก', icon: 'bed' },
];

interface Expense {
  expense_id: number;
  category: string;
  description: string;
  amount: number;
}


export default function TripBudgetScreen() {
  const { trip_id } = useLocalSearchParams();

  // Modal states
  const [isModalVisible, setModalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  
  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  //budeget edit
  const [editBudgetAmount, setEditBudgetAmount] = useState('');
  const [isEditBudgetModalVisible, setEditBudgetModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current; 
  

  const [trip, setTrip] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const totalSpent = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  //expense edit
  const [isEditing, setIsEditing] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);


  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrip = async () => {
      if (!trip_id) return;

      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;

        const [tripRes, budgetRes] = await Promise.all([
          axios.get(`http://192.168.1.45:8000/trip_plan/${trip_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`http://192.168.1.45:8000/budget/plan/${trip_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setTrip(tripRes.data);
        setBudget(budgetRes.data);
        setExpenses(budgetRes.data?.expenses || []);

      } catch (error) {
        console.error('Error fetching trip:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [trip_id]);

  const openEditBudgetModal = () => {
  setEditBudgetAmount(String(budget));
  setEditBudgetModalVisible(true);
  Animated.timing(slideAnim, {
    toValue: 0,
    duration: 250,
    useNativeDriver: true,
  }).start();
};

const closeEditBudgetModal = () => {
  Animated.timing(slideAnim, {
    toValue: 300,
    duration: 200,
    useNativeDriver: true,
  }).start(() => {
    setEditBudgetModalVisible(false);
  });
};


  const openEditExpenseModal = (expense: Expense) => {
    setIsEditing(true);
    setEditingExpenseId(expense.expense_id); // หรือ id field ของ expense
    setAmount(expense.amount.toString());
    setDescription(expense.description);
    setSelectedCategory(expense.category);
    setModalVisible(true);
  };

  const openAddExpenseModal = () => {
    setIsEditing(false);
    setEditingExpenseId(null);
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    setModalVisible(true);
};

  const openModal = () => {
    console.log('📌 เปิด Modal');
    setModalVisible(true);
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

//Add expense handler
const handleSave = async () => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    if (!token || !trip?.budget?.budget_id) return;

     const data = {
      budget_id: trip.budget.budget_id,
      category: selectedCategory,
      description,
      amount: parseInt(amount, 10),
    };

    if (isEditing && editingExpenseId) {
      // แก้ไข expense
      await axios.put(
        `http://192.168.1.45:8000/expense/${editingExpenseId}`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } else {
      // เพิ่ม expense ใหม่
      await axios.post(
        `http://192.168.1.45:8000/expense`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
    );
  }

    // setExpenses(prev => [...prev, expenses.data]);

    // รีเซ็ตฟอร์ม
    setAmount('');
    setDescription('');
    setSelectedCategory(null);

    closeModal();
  } catch (error) {
    console.error("Error adding expense:", error);
  }
};

   const handleSaveBudget = async () => {
  
    const budgetId = budget.budget_id;

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      await axios.put(
        `http://192.168.1.45:8000/budget/${budgetId}`,
        { total_budget: parseInt(editBudgetAmount, 10),
          plan_id : trip_id
         },
        { headers: { Authorization: `Bearer ${token}` } }
      );

       setBudget((prev: any) => ({
        ...prev,
        total_budget: Number(editBudgetAmount)
      }));

      closeEditBudgetModal();
    } catch (error) {
      console.error('Error updating budget:', error);
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    const found = categories.find(cat => cat.name === categoryName);
    return found ? found.icon : 'question-circle'; // ถ้าไม่เจอใช้ icon question-circle
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://picsum.photos/800/600' }}
        style={styles.headerImage}
      >
        <Text style={styles.tripName}>{trip ? trip.name_group : 'กำลังโหลด...'}</Text>

        <View style={styles.budgetRow}>
          <Text style={styles.budgetText}>งบ</Text>
          <Text style={styles.budgetAmount}> {budget ? budget.total_budget : 'กำลังโหลด...'} THB </Text>
          <TouchableOpacity onPress={openEditBudgetModal}>
            <Ionicons name="create-outline" size={20} color="black" />
          </TouchableOpacity>
        </View>

         <Modal
            visible={isEditBudgetModalVisible}
            transparent
            animationType="none" // ปิด animation default
            onRequestClose={closeEditBudgetModal}
          >
            <TouchableOpacity
              style={styles.modalOverlayBudget}
              activeOpacity={1}
              onPress={closeEditBudgetModal}
            >
              <Animated.View
                style={[
                  styles.bottomSheetBudget,
                  { transform: [{ translateY: slideAnim }] },
                ]}
              >
                <Text style={styles.modalTitleBudget}>แก้ไขงบประมาณ</Text>
                <TextInput
                  keyboardType="numeric"
                  style={styles.inputBudget}
                  value={budget ? budget.total_budget : '0'}
                  onChangeText={setEditBudgetAmount}
                />
                <View style={styles.modalButtonsBudget}>
                  <TouchableOpacity onPress={closeEditBudgetModal} style={styles.cancelButtonBudget}>
                    <Text style={styles.cancelButtonText}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveBudget} style={styles.saveButtonBudget}>
                    <Text style={styles.saveButtonText}>บันทึก</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableOpacity>
          </Modal>
      </ImageBackground>

      <View style={styles.semiCircleWrapper}>
        <View style={styles.semiCircle}>
          <Text style={styles.spentText}>ใช้ {totalSpent} THB</Text>
        </View>
      </View>

      <View style={styles.curvedSection}>
        <Text style={styles.sectionTitle}>ค่าใช้จ่าย</Text>

        <FlatList
            data={expenses}
            keyExtractor={(item) => item.expense_id.toString()}
            renderItem={({ item }) => (
              <View style={styles.expenseItem}>
                <FontAwesome
                    name={getCategoryIcon(item.category)}
                    size={24}
                    style={styles.expenseIcon}
                  />
                <View style={styles.expenseDetail}>
                  <Text style={styles.expenseCategory}>{item.category}</Text>
                  <Text style={styles.expenseCreator}>
                    {item.description || "No description"}
                  </Text>
                  <Text style={styles.expenseCreator}>create by Kin</Text>
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

 modalOverlayBudget: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'flex-end',
},
bottomSheetBudget: {
  backgroundColor: 'white',
  padding: 20,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  minHeight: 200,
},
modalTitleBudget: {
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 12,
},
inputBudget: {
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 8,
  padding: 10,
  fontSize: 16,
  marginBottom: 16,
},
modalButtonsBudget: {
  flexDirection: 'row',
  justifyContent: 'space-between',
},
cancelButtonBudget: {
  backgroundColor: '#ddd',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
},
saveButtonBudget: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
},



  // Modal Styles
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
   modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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