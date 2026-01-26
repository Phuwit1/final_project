// components/ui/Avatar.tsx
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';

interface AvatarProps {
  uri?: string | null;      // URL ของรูป (อาจจะเป็น null)
  name?: string;            // ชื่อคน (เอาไว้ทำตัวย่อ กรณีไม่มีรูป)
  size?: number;            // ขนาด (Default 50)
  style?: ViewStyle;        // Style เพิ่มเติม (เช่น margin)
}

export default function Avatar({ uri, name = "User", size = 50, style }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  // คำนวณ Style ตามขนาด
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2, // ทำให้กลมดิ๊ก
    backgroundColor: '#E0E0E0', // สีพื้นหลังกรณีไม่มีรูป
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
    overflow: 'hidden' as 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...style,
  };

  // ดึงตัวอักษรย่อ (เช่น "John Doe" -> "JD")
  const getInitials = (n: string) => {
    const parts = n.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  // Logic: ถ้ามี URI และโหลดไม่ error -> โชว์รูป / ถ้าไม่มี -> โชว์ตัวหนังสือ
  if (uri && !imgError) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          onError={() => setImgError(true)} // ถ้ารูปเสีย ให้ fallback ไปใช้ตัวหนังสือ
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={{ fontSize: size * 0.4, fontWeight: 'bold', color: '#666' }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}