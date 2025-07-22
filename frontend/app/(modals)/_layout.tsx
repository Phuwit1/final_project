import { Stack } from 'expo-router';

export default function ModalLayout() {
  return (
    <Stack screenOptions={{ presentation: 'modal' }}>
      <Stack.Screen name="Login" />
      <Stack.Screen name="Register" />
      <Stack.Screen name="Createtrip" />
      <Stack.Screen name="Hometrip" />
    </Stack>
  );
}
