import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet, Dimensions,
  Keyboard, Platform, Animated, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import dayjs from 'dayjs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- ชนิดที่ DailyPlanTabs ต้องการ ---
type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
type DailyPlan = {
  day: number;
  date: string;                                   // YYYY-MM-DD
  items: Partial<Record<TimeSlot, string[]>>;     // ข้อความกิจกรรม (ผมใส่ "HH:mm ชื่อกิจกรรม")
};
// --- ชนิดข้อความในแชท ---
type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  kind?: 'itinerary';
  itinerary?: any;                                 // raw LLM itinerary ใช้พรีวิว
};
// --- ชนิดพร็อพ ---
type Props = {
  apiBaseUrl: string;
  dayCount: number;
  onNavigateToDay: (index: number) => void;
  startDate: string;                 // ISO e.g. "2025-10-05"
  endDate: string;                   // ISO
  itineraryData?: any;               // อาจเป็น raw LLM หรือ DailyPlan[] ก็ได้ (เราจะตรวจรูปแบบ)
  onPatchItinerary?: (newPlans: DailyPlan[]) => void; // ส่งเวอร์ชันแปลงแล้วให้หน้า DailyPlanTabs
  fabBottom?: number;
  fabRight?: number;
};

const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.75);

// ===== Utils =====
const parseDayIntent = (text: string): number | null => {
  const m =
    /(?:ไป\s*วันที่|ไป\s*วัน|วันที่|วัน|day)\s*(\d{1,2})/i.exec(text) ||
    /(?:go\s*to\s*day)\s*(\d{1,2})/i.exec(text) ||
    /(?:ไป)\s*(\d{1,2})\b/i.exec(text);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  return Number.isNaN(d) ? null : d;
};
const ddmmyyyy = (iso: string) => {
  const d = dayjs(iso);
  return d.isValid() ? d.format('DD/MM/YYYY') : iso;
};
const isRawLLMItinerary = (x: any) =>
  x && typeof x === 'object' && Array.isArray(x.itinerary);

// เวลา → slot
const timeToSlot = (time: string): TimeSlot => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  if (!m) return 'MORNING';
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const minOfDay = h * 60 + parseInt(m[2], 10);
  if (minOfDay >= 5 * 60 && minOfDay < 12 * 60) return 'MORNING';
  if (minOfDay >= 12 * 60 && minOfDay < 17 * 60) return 'AFTERNOON';
  if (minOfDay >= 17 * 60 && minOfDay < 21 * 60) return 'EVENING';
  return 'NIGHT';
};

// แปลง raw LLM itinerary -> DailyPlan[]
const mapLLMToDailyPlans = (raw: any, startIso: string, endIso: string): DailyPlan[] => {
  if (!isRawLLMItinerary(raw)) return [];
  const daysArr: any[] = raw.itinerary || [];

  // ทำ index day: จาก label "Day x" ถ้าไม่มีใช้ตำแหน่ง
  const getDayIndex = (dayLabel: any, i: number): number => {
    if (typeof dayLabel === 'string') {
      const m = /day\s*(\d+)/i.exec(dayLabel);
      if (m) {
        const d = parseInt(m[1], 10);
        if (!Number.isNaN(d) && d > 0) return d;
      }
    }
    return i + 1;
  };

  const start = dayjs(startIso);
  const end = dayjs(endIso);
  const total = Math.max(1, end.diff(start, 'day') + 1);

  // เตรียมโครงว่างตามจำนวนวันทริปทั้งหมด (ให้ต่อเนื่อง)
  const blank: DailyPlan[] = Array.from({ length: total }, (_, idx) => ({
    day: idx + 1,
    date: start.add(idx, 'day').format('YYYY-MM-DD'),
    items: {},
  }));

  // อัดข้อมูลลงโครง
  daysArr.forEach((d, i) => {
    const idx = getDayIndex(d?.day, i) - 1;
    if (idx < 0 || idx >= blank.length) return;
    // วันที่: ถ้า LLM ให้มาก็ใช้, ไม่งั้นใช้คำนวณจาก start
    const dateStr = typeof d?.date === 'string' && dayjs(d.date).isValid()
      ? dayjs(d.date).format('YYYY-MM-DD')
      : blank[idx].date;

    const items: Partial<Record<TimeSlot, string[]>> = { ...blank[idx].items };
    (Array.isArray(d?.schedule) ? d.schedule : []).forEach((s: any) => {
      const t: string = s?.time ?? '';
      const act: string = s?.activity ?? '';
      if (!act) return;
      const slot = timeToSlot(t);
      const line = t ? `${t} ${act}` : act; // ให้เห็นเวลาในลิสต์
      items[slot] = [...(items[slot] ?? []), line];
    });

    blank[idx] = { day: idx + 1, date: dateStr, items };
  });

  return blank;
};

// สรุปเพื่อพรีวิวในบับเบิล
const summarizeItinerary = (raw: any): string[] => {
  if (!isRawLLMItinerary(raw)) return [];
  const days = raw.itinerary || [];
  return days.map((d: any, i: number) => {
    const label = typeof d?.day === 'string' ? d.day : `Day ${i + 1}`;
    const date = d?.date ? `(${d.date})` : '';
    const first3 = Array.isArray(d?.schedule)
      ? d.schedule.slice(0, 3).map((s: any) => `${s?.time ?? ''} ${s?.activity ?? ''}`.trim()).filter(Boolean).join(' • ')
      : '';
    return `${label} ${date} — ${first3}`;
  });
};

export default function FloatingChat({
  apiBaseUrl, dayCount, onNavigateToDay,
  startDate, endDate, itineraryData, onPatchItinerary,
  fabBottom, fabRight,
}: Props) {

  // UI state
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'sys-hello', role: 'assistant', content: 'สวัสดีค่ะ ฉันคือผู้ช่วยทริป ✈️\nลองพิมพ์: "ไปวันที่ 2" หรือ "แก้วัน 2 ให้ไปวัดตอนเช้า"' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // เก็บ raw LLM ล่าสุดไว้ส่งให้ /ai/chat ตอนขอ "แก้แผน"
  const [latestRawItinerary, setLatestRawItinerary] = useState<any | null>(
    isRawLLMItinerary(itineraryData) ? itineraryData : null
  );

  // list & fab
  const listRef = useRef<FlatList<Msg>>(null);
  const insets = useSafeAreaInsets();
  const baseBottom = (fabBottom ?? 24) + insets.bottom;
  const bottomAnim = useRef(new Animated.Value(baseBottom)).current;

  useEffect(() => { if (visible) listRef.current?.scrollToEnd({ animated: true }); }, [messages.length, visible]);
  useEffect(() => { Animated.timing(bottomAnim, { toValue: baseBottom, duration: 0, useNativeDriver: false }).start(); }, [baseBottom]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e: any) => {
      const kb = e?.endCoordinates?.height ?? 0;
      Animated.timing(bottomAnim, { toValue: baseBottom + kb + 12, duration: Platform.OS === 'ios' ? 250 : 150, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      Animated.timing(bottomAnim, { toValue: baseBottom, duration: Platform.OS === 'ios' ? 250 : 150, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [bottomAnim, baseBottom]);

  const clampIndex = (i: number) => Math.max(0, Math.min(i, dayCount - 1));

  // เลือก itinerary_data ที่จะส่งให้ /ai/chat (อยากได้ "raw" ก่อน)
  const pickRawItineraryForServer = (): any | null => {
    if (isRawLLMItinerary(itineraryData)) return itineraryData;
    if (latestRawItinerary) return latestRawItinerary;
    return null;
  };

  // build payload with history
  const makeChatPayload = (lastUserText: string) => {
    const compactHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .concat({ id: `u-${Date.now()}`, role: 'user' as const, content: lastUserText });

    return {
      start_date: ddmmyyyy(startDate),
      end_date: ddmmyyyy(endDate),
      messages: compactHistory.map(({ role, content }) => ({ role, content })),
      itinerary_data: pickRawItineraryForServer(),
    };
  };

  const sendToAI = async (userText: string) => {
    const token = await AsyncStorage.getItem('access_token');
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = `http://192.168.1.45:8000/ai/chat`;
    const payload = makeChatPayload(userText);
    const res = await axios.post(url, payload, { headers, timeout: 30000 });
    return res.data as { reply?: string; action?: { type: string; day?: number }; itinerary?: any };
  };

  const pushAssistant = (content: string) => {
    setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content }]);
  };

  const applyItinerary = (raw: any) => {
  try {
    const mapped = mapLLMToDailyPlans(raw, startDate, endDate);
    onPatchItinerary?.(mapped);
    pushAssistant('ใส่ลงแผนให้แล้วค่ะ ✅');
  } catch (e) {
    pushAssistant('ใส่ลงแผนไม่สำเร็จ ลองใหม่อีกครั้งนะคะ');
  }
};

  const onSend = async (textFromQuick?: string) => {
    const text = (textFromQuick ?? input).trim();
    if (!text || sending) return;

    setErrorText(null);
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    if (!textFromQuick) setInput('');

    // client-side intent
    const direct = parseDayIntent(text);
    if (direct) {
      const idx = clampIndex(direct - 1);
      pushAssistant(`ไปวันที่ ${direct} ให้แล้วค่ะ`);
      onNavigateToDay(idx);
      setVisible(false);
      return;
    }

    try {
      setSending(true);
      const result = await sendToAI(text);

      // server-side intent
      if (result?.action?.type === 'goto_day' && result.action.day) {
        const d = Number(result.action.day);
        const idx = clampIndex(d - 1);
        pushAssistant(result.reply ?? `ไปวันที่ ${d} นะคะ`);
        onNavigateToDay(idx);
        setVisible(false);
        return;
      }

      if (result?.itinerary) {
        // เก็บ raw LLM ไว้ใช้ต่อ
        setLatestRawItinerary(result.itinerary);

        // โชว์พรีวิวในบับเบิล
        setMessages(prev => [
          ...prev,
          { id: `it-${Date.now()}`, role: 'assistant', kind: 'itinerary', itinerary: result.itinerary, content: result.reply ?? 'นี่คือร่างแผนทริปค่ะ' },
        ]);

        // แปลง → DailyPlan[] แล้วส่งให้หน้าแผน
        if (onPatchItinerary) {
          try {
            const mapped = mapLLMToDailyPlans(result.itinerary, startDate, endDate);
            onPatchItinerary(mapped);
          } catch {}
        }
      } else {
        pushAssistant(result?.reply ?? 'รับทราบค่ะ');
      }
    } catch (e: any) {
      console.error('chat error:', e?.response?.data ?? e?.message ?? e);
      setErrorText(
        e?.code === 'ECONNABORTED'
          ? 'การเชื่อมต่อช้าเกินไป ลองใหม่อีกครั้งนะคะ'
          : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบเครือข่ายหรือ CORS'
      );
      pushAssistant('ขอโทษค่ะ เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSending(false);
    }
  };

  const quicks = useMemo(() => {
    const arr: string[] = [];
    const days = Math.min(dayCount, 5);
    for (let i = 1; i <= days; i++) arr.push(`ไปวันที่ ${i}`);
    arr.push('สร้างแผนใหม่ให้หน่อย', 'แก้วัน 2 ให้ไปวัดตอนเช้า');
    return arr;
  }, [dayCount]);

  return (
    <>
      {/* FAB */}
      <Animated.View
        pointerEvents={visible ? 'none' : 'auto'}
        style={[
          styles.fabContainer,
          { right: fabRight ?? 16, bottom: bottomAnim, opacity: visible ? 0 : 1 },
        ]}
      >
        <TouchableOpacity style={styles.fab} onPress={() => setVisible(true)} activeOpacity={0.85}>
          <Text style={styles.fabText}>💬</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Overlay */}
      {visible && (
        <View style={styles.overlay} pointerEvents="auto">
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>ผู้ช่วยทริป</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.close}>ปิด</Text>
              </TouchableOpacity>
            </View>

            {/* Quick actions */}
            <View style={styles.quickRow}>
              <FlatList
                data={quicks}
                keyExtractor={(t, i) => `${i}-${t}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.quickChip} onPress={() => onSend(item)}>
                    <Text style={styles.quickText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* Messages */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                if (item.kind === 'itinerary' && item.itinerary) {
                  const lines = summarizeItinerary(item.itinerary);
                  return (
                    <View style={[styles.bubble, styles.bubbleBot]}>
                      {!!item.content && (
                        <Text style={[styles.bubbleText, { marginBottom: 6 }]}>{item.content}</Text>
                      )}

                      {lines.slice(0, 8).map((line, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={{ paddingVertical: 4 }}
                          onPress={() => { onNavigateToDay(idx); setVisible(false); }}
                        >
                          <Text style={styles.itinLine}>• {line}</Text>
                        </TouchableOpacity>
                      ))}

                      {/* ปุ่มกดใส่ลงแผน + ดูวันแรก */}
                      <View style={styles.ctaRow}>
                        <TouchableOpacity
                          style={[styles.ctaBtn, styles.ctaPrimary]}
                          onPress={() => applyItinerary(item.itinerary)}
                        >
                          <Text style={styles.ctaTextPrimary}>ใส่ลงแผน</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.ctaBtn, styles.ctaSecondary]}
                          onPress={() => { onNavigateToDay(0); setVisible(false); }}
                        >
                          <Text style={styles.ctaTextSecondary}>ดูวันแรก</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }


                return (
                  <View
                    style={[
                      styles.bubble,
                      item.role === 'user' ? styles.bubbleUser : styles.bubbleBot,
                    ]}
                  >
                    <Text style={styles.bubbleText}>{item.content}</Text>
                  </View>
                );
              }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />

            {!!errorText && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="พิมพ์ข้อความ... เช่น ไปวันที่ 2 หรือ แก้วัน 2 ให้ไปวัดตอนเช้า"
                placeholderTextColor="#888"
                style={styles.input}
                editable={!sending}
                onSubmitEditing={() => onSend()}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={() => onSend()} disabled={sending} style={styles.sendBtn}>
                {sending ? <ActivityIndicator /> : <Text style={styles.sendText}>ส่ง</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // FAB
  fabContainer: { position: 'absolute', zIndex: 9999, elevation: 12 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#111827',
    justifyContent: 'center', alignItems: 'center',
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 4 },
  },
  fabText: { fontSize: 24, color: '#fff' },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 9998, elevation: 9998, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    width: '100%', height: SHEET_HEIGHT, backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb',
    flexDirection: 'row', justifyContent: 'space-between',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#111' },
  close: { color: '#2563eb', fontWeight: '600' },

  quickRow: { paddingVertical: 8 },
  quickChip: {
    backgroundColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, marginHorizontal: 4,
  },
  quickText: { color: '#111', fontSize: 14 },

  bubble: { padding: 10, borderRadius: 12, marginVertical: 4, maxWidth: '90%' },
  bubbleUser: { backgroundColor: '#e5e7eb', alignSelf: 'flex-end' },
  bubbleBot: { backgroundColor: '#eef2ff', alignSelf: 'flex-start' },
  bubbleText: { fontSize: 14, color: '#111' },
  itinLine: { fontSize: 14, color: '#111' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, padding: 10, color: '#111',
  },
  sendBtn: { paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: '#2563eb', fontWeight: '700' },

  errorBox: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 6, margin: 8 },
  errorText: { color: '#991b1b', fontSize: 12 },

  ctaRow: {
  flexDirection: 'row',
  gap: 8,
  marginTop: 10,
},
ctaBtn: {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
},
ctaPrimary: {
  backgroundColor: '#2563eb',
},
ctaSecondary: {
  backgroundColor: '#F1F5F9',
},
ctaTextPrimary: {
  color: '#fff',
  fontWeight: '700',
},
ctaTextSecondary: {
  color: '#111',
  fontWeight: '600',
},

});
