import { Stack } from 'expo-router';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';


export default function ModalLayout() {
  return (
    <BottomSheetModalProvider>
    <Stack screenOptions={{ presentation: 'modal' }}>
      <Stack.Screen name="Login" />
      <Stack.Screen name="Register" />
      <Stack.Screen name="Createtrip" />
      <Stack.Screen name="Hometrip" />
    </Stack>
    </BottomSheetModalProvider>
  );
}
