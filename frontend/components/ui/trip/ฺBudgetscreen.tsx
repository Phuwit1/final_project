import React, { useRef, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { FontAwesome } from '@expo/vector-icons';

const categories = [
  { name: 'อาหาร', icon: 'cutlery' },
  { name: 'เดินทาง', icon: 'bus' },
  { name: 'ช้อปปิ้ง', icon: 'shopping-bag' },
  { name: 'ที่พัก', icon: 'bed' },
];

export default function BudgetScreen() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['1%', '60%'], []);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const openSheet = () => {
    console.log("เปิด bottom sheet");
  bottomSheetRef.current?.expand();
  };

  const closeSheet = () => {
    bottomSheetRef.current?.close();
  };

  return (
    <View style={styles.container}>
      {/* ปุ่มเพิ่มค่าใช้จ่าย */}
      <TouchableOpacity style={styles.addButton} onPress={openSheet}>
        <Text style={styles.addButtonText}>+ เพิ่มค่าใช้จ่าย</Text>
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <BottomSheet ref={bottomSheetRef} index={-1} snapPoints={snapPoints}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>เพิ่มค่าใช้จ่าย</Text>

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

          <Text style={{ marginBottom: 10 }}>เลือกหมวดหมู่</Text>
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

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              console.log({ amount, description, selectedCategory });
              closeSheet();
              setAmount('');
              setDescription('');
              setSelectedCategory(null);
            }}
          >
            <Text style={styles.saveButtonText}>💾 บันทึก</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    elevation: 5,
    position: 'absolute',
    bottom: 40,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sheetContent: {
    padding: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
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
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
