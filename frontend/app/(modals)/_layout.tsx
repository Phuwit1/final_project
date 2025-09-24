import { Stack } from 'expo-router';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';


export default function ModalLayout() {
  return (
    <BottomSheetModalProvider>
    <Stack screenOptions={{ presentation: 'modal' }}>
    </Stack>
    </BottomSheetModalProvider>
  );
}
