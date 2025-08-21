import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

export default function AfterCreateChoose() {
  const router = useRouter();
  const { plan_id, trip_id, start_plan_date, end_plan_date } = useLocalSearchParams<{
    plan_id?: string; trip_id?: string; start_plan_date?: string; end_plan_date?: string;
  }>();

  const onAI = () => {
    router.push({
      pathname: '/trip/create-ai',
      params: { plan_id, trip_id, start_plan_date, end_plan_date },
    });
  };

  const onManual = () => {
    // ไปหน้าที่คุณมีอยู่แล้ว
    router.push({ pathname: '/(modals)/Createtrip', params: { trip_id } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>สร้างแผนทริป</Text>
      <Text style={styles.sub}>คุณอยากให้สร้างทริปแบบไหน?</Text>

      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onAI}>
        <Text style={styles.btnPrimaryText}>✨ สร้างโดย AI</Text>
        <Text style={styles.caption}>ให้ AI สร้าง Daily Trip ให้อัตโนมัติ</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onManual}>
        <Text style={styles.btnGhostText}>✍️ สร้างเอง</Text>
        <Text style={styles.caption}>ไปหน้าทริป แล้วจัดเองได้เลย</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, justifyContent:'center', padding:20, gap:16 },
  title:{ fontSize:24, fontWeight:'800' },
  sub:{ color:'#555', marginBottom:16 },
  btn:{ padding:16, borderRadius:16, borderWidth:1, borderColor:'#e5e7eb' },
  btnPrimary:{ backgroundColor:'#111827', borderColor:'#111827' },
  btnPrimaryText:{ color:'#fff', fontSize:18, fontWeight:'700' },
  btnGhost:{ backgroundColor:'#fff' },
  btnGhostText:{ color:'#111827', fontSize:18, fontWeight:'700' },
  caption:{ marginTop:6, color:'#9ca3af' },
});
