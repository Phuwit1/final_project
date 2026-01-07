import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GoogleSignin } from "@react-native-google-signin/google-signin" 
import FlashMessage from "react-native-flash-message";
import 'react-native-reanimated';
import './globals.css';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; 
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Image, View, Text } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SQLiteProvider } from 'expo-sqlite';
import { migrateDbIfNeeded } from '@/database/db-setup';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const CustomHeaderTitle = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Image 
      source={require('../assets/images/icon.png')} 
      style={{ width: 30, height: 30, borderRadius: 15, marginRight: 3 }} 
      resizeMode="contain"
    />
    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f03f3fff' }}>
      TabiGo
    </Text>
  </View>
);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
      const configureGoogleSignin = async () => {
      try {
        GoogleSignin.configure({
          webClientId: "1061030412176-tmtkq6rgmr4biqpr8ir1sk902od0mu1e.apps.googleusercontent.com",
          offlineAccess: true,
        });
        console.log('Google Sign-In configured successfully');
      } catch (error) {
        console.error('Google Sign-In configuration error:', error);
      }
    };
    configureGoogleSignin();

    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
      <SQLiteProvider databaseName="tabigo.db" onInit={migrateDbIfNeeded}>     
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(modals)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />

          <Stack.Screen name="trip/[trip_id]" options={{headerTitle: () => (<CustomHeaderTitle/>)}} />
          <Stack.Screen name="trip/[trip_id]/budget" options={{headerTitle: () => (<CustomHeaderTitle/>)}} />
          <Stack.Screen name="trip/[trip_id]/editschedule" options={{headerTitle: () => (<CustomHeaderTitle/>)}} />
          <Stack.Screen name="trip/after-create" options={{headerTitle: () => (<CustomHeaderTitle/>)}} />
          <Stack.Screen name="trip/[trip_id]/member" options={{headerTitle: () => (<CustomHeaderTitle/>)}} />
          <Stack.Screen name="trip/scheduledetail" options={{headerTitle: () => (<CustomHeaderTitle/>)}} />


          {/* <Stack.Screen name="Login" />
          <Stack.Screen name="Register" /> */}
        </Stack>
        <StatusBar style="auto" />
        <FlashMessage position="top" />
      </ThemeProvider>
      </SQLiteProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
