
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'react-native';

export default function InfoCard() {
    const [expanded, setExpanded] = useState(false);

    const description = "รายละเอียดตัวอย่างของเนื้อหาที่จะถูกแสดงในตำแหน่งนี้ ใช้เพื่อทดสอบการแสดงผลหรือแทนข้อมูลจริงในขณะที่ยังไม่มีการกรอกข้อมูลจริงเข้ามา";
    
    const handleExpand = () => {
        setExpanded(!expanded);
    };
    
    return (
        <View style={styles.card}>
            <View style={styles.container}>

            
            <Image
                source={require('@/assets/images/home/fuji-view.jpg')}
                style={styles.infoimage}
            />

            <Text> ชื่อสถานที่ </Text>
            <Text> { expanded ? description : description.slice(0, 100) +  '...'}</Text>
             <TouchableOpacity onPress={handleExpand}>
                <Text style={styles.seeMore}>
                {expanded ? 'ดูน้อยลง' : 'ดูเพิ่มเติม'}
                </Text>
            </TouchableOpacity>

            </View>

                
            
        </View>
    )
}

const styles = StyleSheet.create({
    infoimage:{
        width: '100%',
        height: 100,
        borderRadius: 10,
        marginBottom: 8,
    },
    container:{
        flexDirection: 'column',
        gap: 10,
    },
    card: {
        backgroundColor: '#fff',
        width: 180,
        padding: 16,
        borderRadius: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        },
    seeMore: {
        color: '#1e90ff',
        marginTop: 8,
        fontWeight: 'bold',
    },
})