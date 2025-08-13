import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  day: number;           // 1-based
  date: string;          // 'YYYY-MM-DD'
  items: {
    [key in TimeSlot]?: string[];
  };
};

type Itinerary = {
  itinerary: Array<{
    date: string; // 'YYYY-MM-DD'
    day: string;  // 'Day 1' ...
    schedule: Array<{ time: string; activity: string; lat?: number; lng?: number }>;
  }>;
  comments?: string;
};

export type DailyPlanTabsHandle = {
  setActiveDay: (index: number) => void; // 0-based
};

type DailyPlanTabsProps = {
  startDate: string;             // ISO เช่น '2025-10-05'
  endDate: string;               // ISO
  plans?: DailyPlan[];           // แผนรูปแบบเดิมของคุณ (ช่วงเวลา)
  itineraryData?: Itinerary;     // แผนจาก LLM (มี time ชัดเจน)
  onPlansChange?: (plans: DailyPlan[]) => void;
};

const DailyPlanTabs = forwardRef<DailyPlanTabsHandle, DailyPlanTabsProps>(function DailyPlanTabs(
  { startDate, endDate, plans: initialPlans = [], itineraryData, onPlansChange },
  ref
) {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  // จำนวนวันจากช่วงวันที่
  const tripDaysRange = Math.max(1, end.diff(start, 'day') + 1);
  // ถ้ามี itineraryData แต่อยู่ยาว/สั้นกว่า ให้เลือกค่ามากสุดเพื่อแสดงแท็บครบ
  const tripDays = Math.max(tripDaysRange, itineraryData?.itinerary?.length ?? 0, initialPlans.length);

  const [selectedDay, setSelectedDay] = useState(1);
  const [plans, setPlans] = useState<DailyPlan[]>(() =>
    initialPlans.length ? initialPlans : makeEmptyPlansForTrip(start, tripDays)
  );

  useImperativeHandle(ref, () => ({
    setActiveDay: (index: number) => {
      const clamped = clamp(index, 0, tripDays - 1);
      setSelectedDay(clamped + 1);
    },
  }));

  // เมื่อ itineraryData มา/เปลี่ยน → map เข้าเป็น plans (MORNING/AFTERNOON/EVENING/NIGHT)
  useEffect(() => {
    if (!itineraryData?.itinerary?.length) return;

    const mapped = mapItineraryToTimeSlots(start, tripDays, itineraryData);
    setPlans(mapped);
    onPlansChange?.(mapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(itineraryData)]);

  // ถ้า initialPlans เปลี่ยน (เช่น โหลดจาก DB) ก็อัปเดต
  useEffect(() => {
    if (!initialPlans.length) return;
    setPlans(initialPlans);
    onPlansChange?.(initialPlans);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialPlans)]);

  const currentDateLabel = start.add(selectedDay - 1, 'day').format('D MMMM');
  const currentPlan = plans.find((p) => p.day === selectedDay);

  // ----- modal state (เพิ่มกิจกรรม) -----
  const [modalVisible, setModalVisible] = useState(false);
  const [newTime, setNewTime] = useState<TimeSlot>('MORNING');
  const [newDescription, setNewDescription] = useState('');

  const handleDeleteActivity = (slot: TimeSlot, indexToDelete: number) => {
    const updated = structuredClone(plans);
    const dayIndex = updated.findIndex((p) => p.day === selectedDay);
    if (dayIndex === -1) return;

    const slotItems = updated[dayIndex].items[slot] || [];
    updated[dayIndex].items[slot] = slotItems.filter((_, idx) => idx !== indexToDelete);
    setPlans(updated);
    onPlansChange?.(updated);
  };

  const handleAddActivity = () => {
    const desc = newDescription.trim();
    if (!desc) return;

    const updated = structuredClone(plans);
    let dayIndex = updated.findIndex((p) => p.day === selectedDay);

    if (dayIndex === -1) {
      updated.push({
        day: selectedDay,
        date: start.add(selectedDay - 1, 'day').format('YYYY-MM-DD'),
        items: { [newTime]: [desc] },
      });
    } else {
      const target = updated[dayIndex];
      const exist = target.items[newTime] || [];
      target.items[newTime] = [...exist, desc];
    }

    setPlans(updated);
    onPlansChange?.(updated);
    setNewDescription('');
    setNewTime('MORNING');
    setModalVisible(false);
  };

  return (
    <View>
      {/* ปุ่ม Day 1..N */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayButtonContainer}>
        {Array.from({ length: tripDays }).map((_, i) => {
          const day = i + 1;
          const date = start.add(i, 'day').format('D MMM');
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayButton, selectedDay === day && styles.dayButtonSelected]}
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
        <Text style={styles.planTitle}>📅 แผนวันที่ {currentDateLabel}</Text>

        {timeSlotOrder.map((slot) => {
          const slotItems = currentPlan?.items?.[slot] ?? [];
          return (
            <View key={slot} style={styles.planItem}>
              <Text style={styles.planTime}>{slot}</Text>
              {slotItems.length > 0 ? (
                slotItems.map((desc, index) => (
                  <View key={`${slot}-${index}`} style={styles.itemRow}>
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
        <TouchableOpacity style={styles.newListButton} onPress={() => setModalVisible(true)}>
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
                  style={[styles.slotButton, newTime === slot && styles.slotSelected]}
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
});

export default DailyPlanTabs;

/* ---------- Helpers ---------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function timeToSlot(timeStr: string): TimeSlot {
  // รองรับ 'HH:mm' (24h). ถ้า parse ไม่ได้ -> MORNING
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!m) return 'MORNING';
  const h = Number(m[1]);
  if (h >= 5 && h <= 11) return 'MORNING';
  if (h >= 12 && h <= 16) return 'AFTERNOON';
  if (h >= 17 && h <= 20) return 'EVENING';
  return 'NIGHT'; // 21-4
}

function makeEmptyPlansForTrip(start: dayjs.Dayjs, tripDays: number): DailyPlan[] {
  return Array.from({ length: tripDays }).map((_, i) => ({
    day: i + 1,
    date: start.add(i, 'day').format('YYYY-MM-DD'),
    items: {},
  }));
}

function mapItineraryToTimeSlots(
  start: dayjs.Dayjs,
  tripDays: number,
  itineraryData: Itinerary
): DailyPlan[] {
  const base = makeEmptyPlansForTrip(start, tripDays);

  itineraryData.itinerary.forEach((d, idx) => {
    const dayIndex = clamp(idx, 0, base.length - 1);
    const plan = base[dayIndex];
    // ถ้ามีวันที่จาก LLM ก็แทนให้ตรง
    if (d.date) plan.date = d.date;

    d.schedule?.forEach((s) => {
      const slot = timeToSlot(s.time || '');
      const label = s.time ? `${s.time} — ${s.activity}` : s.activity;
      plan.items[slot] = [...(plan.items[slot] || []), label];
    });
  });

  return base;
}

/* ---------- Styles ---------- */
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
