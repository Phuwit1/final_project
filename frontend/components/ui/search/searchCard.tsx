import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { API_URL } from '@/api.js'

const GOOGLE_API_KEY = 'AIzaSyA73tpAfskui7aqX9GXabfGLU0OZ5HLC-U'; 


interface SearchCardProps {
    title: string;
    photo_ref: string | null;
    rating?: number | null; 
    onPress?: () => void;
    style?: object;     
}

export default function SearchCard({ title, photo_ref, rating, onPress, style } : SearchCardProps) {

    let imageUrl;
    if (photo_ref?.startsWith('/static')) {
        imageUrl = `${API_URL}${photo_ref}`;
    } else if (photo_ref && !photo_ref.startsWith('http')) {
        imageUrl = 'https://via.placeholder.com/300x300.png?text=No+Image'
        // imageUrl = `https://places.googleapis.com/v1/${photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key=${GOOGLE_API_KEY}`;
    } else if (photo_ref?.startsWith('http')) {
        imageUrl = photo_ref;
    } else {
 
        imageUrl = 'https://via.placeholder.com/300x300.png?text=No+Image';
    }

    return (
        <TouchableOpacity 
            style={[styles.card, style]} 
            onPress={onPress} 
            activeOpacity={0.8}
        >
          
            <Image 
                source={{ uri: imageUrl }} 
                style={styles.image} 
                resizeMode="cover" 
            />

      
            <View style={styles.infoContainer}>
               
                <Text style={styles.title} numberOfLines={1}>
                    {title || "Unknown Place"}
                </Text>

     
                {rating ? (
                    <View style={styles.ratingContainer}>
                        <Text style={styles.star}>⭐</Text>
                        <Text style={styles.ratingText}>{rating}</Text>
                    </View>
                ) : (
                    <Text style={styles.noRating}>-</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: 140,      
        height: 180,     
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        
    
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        marginBottom: 5,
    },
    image: {
        width: '100%',
        height: 120,   
        backgroundColor: '#eee',
    },
    infoContainer: {
        padding: 8,
        flex: 1,
        justifyContent: 'center', 
    },
    title: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    star: {
        fontSize: 12,
        marginRight: 4,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#555',
    },
    noRating: {
        fontSize: 12,
        color: '#999',
    }
});