import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
const GOOGLE_API_KEY = "AIzaSyA73tpAfskui7aqX9GXabfGLU0OZ5HLC-U";

interface InfoCardProps {
    title: string;
    imageRef: string; 
    rating?: number; 
    description?: string; 
}

export default function InfoCard({ title, imageRef, rating, description }: InfoCardProps) {
    const [expanded, setExpanded] = useState(false);


    // const imageUrl = imageRef 
    //     ? `https://places.googleapis.com/v1/${imageRef}/media?maxHeightPx=400&maxWidthPx=400&key=${GOOGLE_API_KEY}`
    //     : 'https://via.placeholder.com/300x200.png?text=No+Image'; 

   
    const safeDescription = description || "ไม่มีคำอธิบายเพิ่มเติม";
    

    const displayText = expanded 
        ? safeDescription 
        : (safeDescription.length > 60 ? `${safeDescription.slice(0, 80)}...` : safeDescription);

    const handleExpand = () => {
        setExpanded(!expanded);
    };

    return (
        <View style={styles.card}>
            <View style={styles.container}>
{/*                 
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.infoimage}
                    resizeMode="cover"
                /> */}
                <Text style={styles.placeTitle} numberOfLines={1}>
                    {title || "ชื่อสถานที่"}
                </Text>
                {rating && (
                    <Text style={styles.rating}>⭐ {rating}</Text>
                )}
                <Text style={styles.description}>{displayText}</Text>
            </View> 
        </View>
    );
}

const styles = StyleSheet.create({
    infoimage: {
        width: '100%',
        height: 120, // เพิ่มความสูงนิดหน่อยให้สวยขึ้น
        borderRadius: 10,
        marginBottom: 8,
        backgroundColor: '#eee', // สีพื้นหลังเผื่อโหลดรูปไม่ทัน
    },
    container: {
        flex: 1,
        flexDirection: 'column',
        gap: 5,
        
    },
    card: {
        backgroundColor: '#fff',
        width: 170,
        height: 290, // ปรับลดนิดหน่อยเผื่อ padding ของหน้าจอ
        padding: 12,
        borderRadius: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1, // ลดเงาลงนิดหน่อยให้ดู Modern
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        marginBottom: 10, // เว้นระยะห่างด้านล่างเวลาขึ้นบรรทัดใหม่
        justifyContent: 'flex-start',
    },
    seeMore: {
        color: '#1e90ff',
        marginTop: 4,
        fontWeight: 'bold',
        fontSize: 12,
    },
    readMoreBtn: {
        marginTop: 'auto' 
    },
    placeTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    rating: {
        fontSize: 12,
        color: '#f5a623', // สีส้มทอง
        fontWeight: 'bold',
    },
    description: {
        fontSize: 12, // ลดขนาดลงนิดนึงสำหรับการ์ด
        lineHeight: 18,
        color: '#666',
    },
});