import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import dayjs from 'dayjs';

const timeSlotOrder = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] as const;
type TimeSlot = (typeof timeSlotOrder)[number];

type DailyPlan = {
  day: number;
  date: string;
  items: {
    [key in TimeSlot]?: string[];
  };
};

type DailyPlanTabsProps = {
  startDate: string;
  endDate: string;
  plans: DailyPlan[];
};

export default function DailyPlanTabs({
  startDate,
  endDate,
  plans: initialPlans = [],
}: DailyPlanTabsProps) {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const tripDays = end.diff(start, 'day') + 1;

  const [selectedDay, setSelectedDay] = useState(1);
  const [plans, setPlans] = useState<DailyPlan[]>(initialPlans);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTime, setNewTime] = useState<TimeSlot>('MORNING');
  const [newDescription, setNewDescription] = useState('');

  const currentDate = start.add(selectedDay - 1, 'day').format('D MMMM');
  const currentPlans = plans.find((p) => p.day === selectedDay)?.items || {};

  const handleDeleteActivity = (slot: TimeSlot, indexToDelete: number) => {
    const updatedPlans = [...plans];
    const dayIndex = updatedPlans.findIndex((p) => p.day === selectedDay);

    if (dayIndex !== -1) {
      const slotItems = updatedPlans[dayIndex].items[slot] || [];
      slotItems.splice(indexToDelete, 1);
      updatedPlans[dayIndex].items[slot] = [...slotItems];
      setPlans(updatedPlans);
    }
  };

  const handleAddActivity = () => {
    if (!newDescription.trim()) return;

    const updatedPlans = [...plans];
    const dayIndex = updatedPlans.findIndex((p) => p.day === selectedDay);

    if (dayIndex !== -1) {
      const dayPlan = updatedPlans[dayIndex];
      const existingSlot = dayPlan.items[newTime] || [];
      dayPlan.items[newTime] = [...existingSlot, newDescription.trim()];
    } else {
      updatedPlans.push({
        day: selectedDay,
        date: start.add(selectedDay - 1, 'day').format('YYYY-MM-DD'),
        items: { [newTime]: [newDescription.trim()] },
      });
    }

    setPlans(updatedPlans);
    setNewDescription('');
    setNewTime('MORNING');
    setModalVisible(false);
  };

  return (
    <View>
      {/* ปุ่ม Day 1, 2, 3 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayButtonContainer}
      >
        {[...Array(tripDays)].map((_, i) => {
          const day = i + 1;
          const date = start.add(i, 'day').format('D MMM');
          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayButton,
                selectedDay === day && styles.dayButtonSelected,
              ]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={styles.dayButtonText}>{`Day ${day}`}</Text>
              <Text style={styles.dayDate}>{date}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* แผนประจำวัน */}
      <View style={styles.planContainer}>
        <Text style={styles.planTitle}>📅 แผนวันที่ {currentDate}</Text>

        {timeSlotOrder.map((slot) => {
          const slotItems = currentPlans[slot] || [];
          return (
            <View key={slot} style={styles.planItem}>
              <Text style={styles.planTime}>{slot}</Text>
              {slotItems.length > 0 ? (
                slotItems.map((desc, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text style={styles.planText}>📝 {desc}</Text>
                    <TouchableOpacity onPress={() => handleDeleteActivity(slot, index)}>
                      <Text style={{ color: 'red', fontWeight: 'bold' }}>ลบ</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.planText}>-</Text>
              )}
            </View>
          );
        })}

        {/* ปุ่ม New List */}
        <TouchableOpacity
          style={styles.newListButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.newListText}>+ New list</Text>
        </TouchableOpacity>
      </View>

      {/* Modal เพิ่มกิจกรรม */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>เพิ่มกิจกรรม</Text>

            <Text style={styles.modalLabel}>Time Slot:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {timeSlotOrder.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotButton,
                    newTime === slot && styles.slotSelected,
                  ]}
                  onPress={() => setNewTime(slot)}
                >
                  <Text>{slot}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Description:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="ใส่กิจกรรม..."
              value={newDescription}
              onChangeText={setNewDescription}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pressable style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={{ color: 'gray' }}>ยกเลิก</Text>
              </Pressable>
              <Pressable style={styles.confirmButton} onPress={handleAddActivity}>
                <Text style={{ color: 'white' }}>เพิ่ม</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dayButtonContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dayButtonSelected: {
    backgroundColor: '#FF6B6B',
  },
  dayButtonText: {
    fontWeight: '600',
    color: '#000',
    fontSize: 16,
  },
  dayDate: {
    fontSize: 12,
    color: '#555',
  },
  planContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    marginHorizontal: 12,
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  planItem: {
    marginBottom: 12,
  },
  planTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  planText: {
    fontSize: 15,
    color: '#333',
    paddingLeft: 8,
  },
  newListButton: {
    marginTop: 16,
    backgroundColor: '#FFD6D6',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  newListText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D60000',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  slotButton: {
    padding: 10,
    backgroundColor: '#EEE',
    borderRadius: 8,
    marginRight: 8,
  },
  slotSelected: {
    backgroundColor: '#4C9EF1',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  cancelButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  confirmButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    flex: 1,
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 8,
  },
});
